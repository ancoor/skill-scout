#!/usr/bin/env node
// skill-scout: search skills.sh for every query in a stack profile, then
// de-duplicate, score and bucket the results.
//
// Usage:
//   node search-skills.mjs --profile profile.json [--extra "payments"]... [--out results.json]
//                          [--per-bucket 4] [--min-installs 20] [--format json|text]
//                          [--include-installed] [--audit]
//   node search-skills.mjs --q "spring boot" --q "postgres"     # ad-hoc queries
//
// Search source: the public endpoint the `skills` CLI itself uses
// (GET https://skills.sh/api/search?q=...). If that fails, it falls back to
// parsing `npx -y skills find <query>`. Override the host with SKILLS_API_URL.

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { BUCKET_LABELS } from './lib/signals.mjs';

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt = { profile: null, extra: [], q: [], out: null, perBucket: 4, minInstalls: 20, format: 'json', includeInstalled: false, audit: false, cli: 'auto' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--profile') opt.profile = argv[++i];
  else if (a === '--extra') opt.extra.push(argv[++i]);
  else if (a === '--q') opt.q.push(argv[++i]);
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--per-bucket') opt.perBucket = Number(argv[++i]) || 4;
  else if (a === '--min-installs') opt.minInstalls = Number(argv[++i]) || 0;
  else if (a === '--format') opt.format = argv[++i];
  else if (a === '--include-installed') opt.includeInstalled = true;
  else if (a === '--audit') opt.audit = true;
  else if (a === '--no-cli-fallback') opt.cli = 'never';
  else if (a === '--cli-only') opt.cli = 'only';
  else if (a === '-h' || a === '--help') {
    console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1, 14).join('\n'));
    process.exit(0);
  }
}
const API = (process.env.SKILLS_API_URL || 'https://skills.sh').replace(/\/$/, '');

let profile = null;
if (opt.profile) profile = JSON.parse(fs.readFileSync(opt.profile, 'utf8'));
let queries = profile ? profile.queries.map((q) => ({ ...q })) : [];
for (const q of opt.q) queries.push({ q, bucket: 'stack', category: 'adhoc', tags: [], groups: [] });
for (const q of opt.extra) queries.push({ q, bucket: 'domain', category: 'domain', tags: [], groups: [], reason: 'business domain' });
if (!queries.length) { console.error('Nothing to search. Pass --profile or --q.'); process.exit(2); }
// de-duplicate queries (extra may repeat a profile query)
queries = [...new Map(queries.map((q) => [q.q.toLowerCase(), q])).values()];

// ---------------------------------------------------------------- search backends
async function apiSearch(q) {
  const url = `${API}/api/search?${new URLSearchParams({ q })}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'skill-scout' } });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.skills || []).map((s) => ({ slug: s.id, name: s.name, installs: Number(s.installs) || 0, source: s.source || '' }));
    } catch (e) {
      clearTimeout(t);
      if (attempt === 1) throw e;
    }
  }
}

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
function parseCount(s) {
  if (!s) return 0;
  const m = s.match(/([\d.]+)\s*([KM]?)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(m[2].toUpperCase() === 'M' ? n * 1e6 : m[2].toUpperCase() === 'K' ? n * 1e3 : n);
}
function cliSearch(q) {
  const r = spawnSync('npx', ['-y', 'skills', 'find', q], {
    encoding: 'utf8', timeout: 60000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', DISABLE_TELEMETRY: '1' },
  });
  if (r.error) throw r.error;
  const lines = (r.stdout || '').replace(ANSI, '').split('\n');
  const out = [];
  let partial = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^(No skills matched every term|Partial matches)/.test(line)) { partial = true; continue; }
    const m = line.match(/^([\w.-]+\/[\w.-]+)@(\S+?)(?:\s+([\d.]+[KM]?)\s+installs?)?$/i);
    if (!m) continue;
    const link = (lines[i + 1] || '').replace(ANSI, '').match(/https:\/\/skills\.sh\/(\S+)/);
    out.push({ slug: link ? link[1] : `${m[1]}/${m[2]}`, source: m[1], name: m[2], installs: parseCount(m[3]), partial });
  }
  if (!out.length && r.status !== 0) throw new Error((r.stderr || '').trim().split('\n').pop() || `exit ${r.status}`);
  return out;
}

const backendUsed = new Set();
const errors = [];
async function search(q) {
  if (opt.cli !== 'only') {
    try { const r = await apiSearch(q); backendUsed.add('api'); return r; }
    catch (e) { if (opt.cli === 'never') { errors.push({ q, error: String(e.message || e) }); return []; } }
  }
  try { const r = cliSearch(q); backendUsed.add('cli'); return r; }
  catch (e) { errors.push({ q, error: String(e.message || e) }); return []; }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

// ---------------------------------------------------------------- scoring
// Owners that publish the official skills for a technology. Heuristic only.
const VENDOR_OWNERS = {
  nextjs: ['vercel-labs', 'vercel'], react: ['vercel-labs', 'facebook', 'reactjs'], 'ai-sdk': ['vercel-labs', 'vercel'],
  vercel: ['vercel-labs', 'vercel'], supabase: ['supabase', 'supabase-community'], prisma: ['prisma'],
  mongodb: ['mongodb', 'mongodb-labs'],
  redis: ['redis'], 'spring-boot': ['spring-projects', 'spring-io'], expo: ['expo'], 'react-native': ['expo', 'callstackincubator', 'callstack'],
  cloudflare: ['cloudflare'], terraform: ['hashicorp'], 'anthropic-sdk': ['anthropics'], mcp: ['anthropics', 'modelcontextprotocol'],
  stripe: ['stripe'], aws: ['aws', 'awslabs', 'aws-samples'], azure: ['microsoft', 'azure'], gcp: ['google', 'googlecloudplatform'],
  flutter: ['flutter'], angular: ['angular'], playwright: ['microsoft'], firebase: ['firebase'], clerk: ['clerk'],
  'better-auth': ['better-auth'], nx: ['nrwl'], turborepo: ['vercel', 'vercel-labs'], tailwind: ['tailwindlabs'],
};
const WELL_KNOWN = new Set(['anthropics', 'vercel-labs', 'vercel', 'microsoft', 'google', 'cloudflare', 'supabase', 'expo', 'obra', 'mattpocock']);
const CAT_WEIGHT = { framework: 1, frontend: 1, mobile: 1, database: 1, orm: 1, messaging: 1, cache: 0.95, search: 0.95, migrations: 0.95,
  api: 0.9, auth: 0.9, ai: 0.95, 'frontend-lib': 0.85, styling: 0.85, testing: 0.9, infra: 0.85, cloud: 0.85, ci: 0.8, monorepo: 0.85,
  build: 0.7, language: 0.75, lifecycle: 0.9, domain: 1, adhoc: 1 };

// A skill named after a technology the repo does NOT use is probably a near
// miss (a "react" search returning React Native skills for a web app).
const MISMATCH_TOKENS = {
  native: 'react-native', expo: 'expo', next: 'nextjs', nextjs: 'nextjs', nuxt: 'nuxt', vue: 'vue', angular: 'angular',
  svelte: 'svelte', sveltekit: 'svelte', remix: 'remix', astro: 'astro', flutter: 'flutter', django: 'django', flask: 'flask',
  fastapi: 'fastapi', rails: 'rails', laravel: 'laravel', symfony: 'symfony', nestjs: 'nestjs', prisma: 'prisma',
  drizzle: 'drizzle', supabase: 'supabase', firebase: 'firebase', mongodb: 'mongodb', mongo: 'mongodb', mysql: 'mysql',
  tailwind: 'tailwind', kotlin: 'kotlin', swiftui: 'swiftui', android: 'android', quarkus: 'quarkus', micronaut: 'micronaut',
  neon: '__vendor', planetscale: '__vendor', convex: '__vendor', turso: '__vendor',
};
const repoTech = new Set((profile?.technologies || []).map((t) => t.id));
function mismatchOf(name) {
  if (!profile) return null;
  const toks = name.toLowerCase().split(/[^a-z0-9]+/);
  for (const t of toks) {
    const tag = MISMATCH_TOKENS[t];
    if (tag && !repoTech.has(tag)) return tag === '__vendor' ? t : tag;
  }
  return null;
}

const installedNames = new Set([
  ...((profile?.installedSkills) || []).map((s) => s.name.toLowerCase()),
  ...((profile?.installedSkills) || []).map((s) => (s.dir || '').toLowerCase()),
  ...((profile?.lockedSkills) || []).map((s) => s.name.toLowerCase()),
].filter(Boolean));

function termRatio(q, item) {
  const hay = `${item.source} ${item.name}`.toLowerCase().replace(/[-_/]/g, ' ');
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return 1;
  const hit = terms.filter((t) => hay.includes(t) || (t === 'golang' && /\bgo\b/.test(hay)) || (t.endsWith('s') && hay.includes(t.slice(0, -1)))).length;
  return hit / terms.length;
}

const results = await pool(queries, 4, (q) => search(q.q));
const cands = new Map();
queries.forEach((q, qi) => {
  const list = results[qi] || [];
  list.slice(0, 15).forEach((item, rank) => {
    if (!item.source || !item.name) return;
    const id = `${item.source}@${item.name}`;
    const tr = termRatio(q.q, item);
    const hit = (CAT_WEIGHT[q.category] ?? 0.8) * (1 / (1 + 0.15 * rank)) * (0.35 + 0.65 * tr) * (item.partial ? 0.6 : 1);
    if (!cands.has(id)) cands.set(id, { id, name: item.name, source: item.source, slug: item.slug, installs: item.installs, hits: [] });
    const c = cands.get(id);
    c.installs = Math.max(c.installs, item.installs);
    c.hits.push({ q: q.q, bucket: q.bucket, category: q.category, tags: q.tags || [], groups: q.groups || [], rank, score: hit, reason: q.reason });
  });
});

const ranked = [];
for (const c of cands.values()) {
  c.hits.sort((a, b) => b.score - a.score);
  const best = c.hits[0];
  const relevance = Math.min(1.3, best.score + 0.25 * c.hits.slice(1).reduce((s, h) => s + h.score, 0));
  const popularity = Math.min(1, Math.log10(c.installs + 1) / 5);
  const owner = c.source.split('/')[0].toLowerCase();
  const tagIds = [...new Set(c.hits.flatMap((h) => h.tags))];
  const official = tagIds.some((t) => (VENDOR_OWNERS[t] || []).includes(owner));
  const bonus = (official ? 0.15 : 0) + (WELL_KNOWN.has(owner) ? 0.05 : 0);
  const mismatch = best.bucket === 'quality' || best.bucket === 'domain' ? null : mismatchOf(c.name);
  const score = +((0.65 * relevance + 0.35 * popularity + bonus) * (mismatch ? 0.45 : 1)).toFixed(4);
  const installed = installedNames.has(c.name.toLowerCase());
  ranked.push({
    id: c.id,
    name: c.name,
    source: c.source,
    installs: c.installs,
    url: `https://skills.sh/${c.slug || `${c.source}/${c.name}`}`,
    score,
    bucket: best.bucket,
    groups: [...new Set(c.hits.flatMap((h) => h.groups))],
    matchedQueries: c.hits.map((h) => h.q),
    matchedTags: tagIds,
    official,
    installed,
    ...(mismatch ? { mismatch } : {}),
  });
}
ranked.sort((a, b) => b.score - a.score);

// Same skill name from several repos (forks, mirrors): keep the best one.
const byName = new Map();
const deduped = [];
for (const r of ranked) {
  const k = r.name.toLowerCase();
  if (byName.has(k)) { const keep = byName.get(k); (keep.alternatives ||= []).push({ id: r.id, installs: r.installs }); continue; }
  byName.set(k, r);
  deduped.push(r);
}

const alreadyInstalled = deduped.filter((r) => r.installed);
const nearMisses = deduped.filter((r) => r.mismatch && !r.installed);
let pool2 = deduped.filter((r) => (opt.includeInstalled || !r.installed) && !r.mismatch && (r.installs >= opt.minInstalls || r.official));

// ---------------------------------------------------------------- buckets
// In a monorepo with several stack groups, the stack bucket is split per group.
const groups = profile?.stackGroups || [];
const splitStack = groups.length > 1;
const groupTags = Object.fromEntries(groups.map((g) => [g.id, new Set([...(g.stack || []), ...(g.otherTags || [])])]));
// Which stack group a skill serves:
//  1. if its name names a technology (next, expo, fastapi…) that only some
//     groups use, pick among those;
//  2. otherwise vote: each matched query gives its score to the groups it came
//     from, split evenly, so specific queries ("nextjs") beat shared ones ("react").
function pickGroup(r) {
  const cand = cands.get(r.id);
  const votes = new Map();
  for (const h of cand.hits) for (const g of h.groups) votes.set(g, (votes.get(g) || 0) + h.score / h.groups.length);
  const toks = r.name.toLowerCase().split(/[^a-z0-9]+/);
  const named = toks.map((t) => MISMATCH_TOKENS[t]).filter((t) => t && t !== '__vendor');
  let pool = [...votes.keys()];
  if (named.length) {
    const owners = groups.filter((g) => named.some((t) => groupTags[g.id].has(t))).map((g) => g.id);
    if (owners.length) pool = owners;
  }
  const best = pool.sort((a, b) => (votes.get(b) || 0) - (votes.get(a) || 0))[0];
  const also = [...votes.keys()].filter((g) => g !== best && (!named.length || groups.some((x) => x.id === g && named.some((t) => groupTags[g].has(t)))));
  if (also.length) r.alsoServes = also;
  return best;
}
function bucketKey(r) {
  if (r.bucket === 'stack' && splitStack && r.groups.length) {
    r.servesGroup = pickGroup(r);
    if (r.servesGroup) return `stack:${r.servesGroup}`;
  }
  return r.bucket;
}
const bucketMap = new Map();
for (const r of pool2) {
  const k = bucketKey(r);
  if (!bucketMap.has(k)) bucketMap.set(k, []);
  bucketMap.get(k).push(r);
}
const ORDER = ['stack', ...groups.map((g) => `stack:${g.id}`), 'data', 'infra', 'quality', 'domain'];
const buckets = [...bucketMap.entries()]
  .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
  .map(([id, items]) => {
    let label = BUCKET_LABELS[id] || id;
    if (id.startsWith('stack:')) {
      const g = groups.find((x) => `stack:${x.id}` === id);
      label = g ? `${g.label} — ${g.projects.slice(0, 3).join(', ')}${g.projects.length > 3 ? ', …' : ''}` : id;
    }
    return { id, label, top: items.slice(0, opt.perBucket), reserve: items.slice(opt.perBucket, opt.perBucket + 6) };
  });

// ---------------------------------------------------------------- audits (optional)
async function audit(r) {
  const token = process.env.SKILLS_SH_TOKEN || process.env.VERCEL_OIDC_TOKEN;
  const url = `${API}/api/v1/skills/audit/${r.source}/${r.name}`;
  try {
    const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(10000) });
    if (res.status === 404) return { status: 'not-audited' };
    if (!res.ok) return { status: 'unavailable', http: res.status };
    const d = await res.json();
    const audits = d.audits || [];
    const worst = audits.some((a) => a.status === 'fail') ? 'fail' : audits.some((a) => a.status === 'warn') ? 'warn' : audits.length ? 'pass' : 'not-audited';
    return { status: worst, audits: audits.map((a) => ({ provider: a.provider, status: a.status, riskLevel: a.riskLevel, summary: a.summary })) };
  } catch { return { status: 'unavailable' }; }
}
if (opt.audit) {
  const shortlist = buckets.flatMap((b) => b.top);
  const res = await pool(shortlist, 4, audit);
  shortlist.forEach((r, i) => { r.audit = res[i]; });
}

// ---------------------------------------------------------------- output
const out = {
  tool: 'skill-scout',
  searchedAt: new Date().toISOString(),
  backend: [...backendUsed],
  queries: queries.length,
  failedQueries: errors,
  candidates: deduped.length,
  buckets,
  alreadyInstalled: alreadyInstalled.slice(0, 20).map((r) => ({ id: r.id, name: r.name })),
  nearMisses: nearMisses.slice(0, 10).map((r) => ({ id: r.id, installs: r.installs, notInRepo: r.mismatch })),
};
if (errors.length === queries.length) {
  out.error = 'Every search failed. skills.sh may be unreachable from this machine (network or proxy).';
}

function fmtN(n) { return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n); }
function toText(o) {
  const L = [`Searched ${o.queries} queries via ${o.backend.join('+') || 'nothing'}; ${o.candidates} unique skills.`];
  if (o.error) L.push(`ERROR: ${o.error}`);
  if (o.failedQueries.length) L.push(`Failed queries: ${o.failedQueries.map((f) => f.q).join(', ')}`);
  for (const b of o.buckets) {
    L.push('', `## ${b.label}`);
    b.top.forEach((r, i) => L.push(`  ${i + 1}. ${r.id}  (${fmtN(r.installs)} installs${r.official ? ', official' : ''}${r.audit ? `, audit: ${r.audit.status}` : ''})  ← ${r.matchedQueries.slice(0, 3).join(', ')}`));
    if (b.reserve.length) L.push(`     more: ${b.reserve.map((r) => r.id).join(', ')}`);
  }
  if (o.alreadyInstalled.length) L.push('', `Already installed (skipped): ${o.alreadyInstalled.map((r) => r.name).join(', ')}`);
  if (o.nearMisses.length) L.push(`Near misses (for tech not in this repo): ${o.nearMisses.map((r) => `${r.id} [${r.notInRepo}]`).join(', ')}`);
  return L.join('\n');
}

const json = JSON.stringify(out, null, 2);
if (opt.out) fs.writeFileSync(opt.out, json);
if (opt.format === 'text' || opt.out) console.log(toText(out));
else console.log(json);
if (out.error) process.exitCode = 3;
