#!/usr/bin/env node
// skill-scout: fetch a skill's SKILL.md (and file list) without installing it,
// so the user can "read more" before choosing.
//
// Usage: node skill-info.mjs owner/repo@skill [--max-chars 6000]
//
// Tries, in order:
//   1. skills.sh detail API  GET /api/v1/skills/{owner}/{repo}/{skill}
//      (uses SKILLS_SH_TOKEN or VERCEL_OIDC_TOKEN if set)
//   2. `npx -y skills use owner/repo@skill`  (prints the skill without installing)
// and reports which bundled files are executable scripts, so risk can be flagged.

import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith('-'));
const mi = argv.indexOf('--max-chars');
const MAX = mi >= 0 ? Number(argv[mi + 1]) || 6000 : 6000;
if (!id || !/^[\w.-]+\/[\w.-]+@[\w.:-]+$/.test(id)) {
  console.error('Usage: node skill-info.mjs owner/repo@skill');
  process.exit(2);
}
const at = id.lastIndexOf('@');
const source = id.slice(0, at);
const name = id.slice(at + 1);
const API = (process.env.SKILLS_API_URL || 'https://skills.sh').replace(/\/$/, '');
const SCRIPT_RE = /\.(sh|bash|zsh|py|js|mjs|cjs|ts|rb|pl|ps1|bat|cmd|exe|bin)$/i;

async function viaApi() {
  const token = process.env.SKILLS_SH_TOKEN || process.env.VERCEL_OIDC_TOKEN;
  const res = await fetch(`${API}/api/v1/skills/${source}/${name}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if (!d.files) throw new Error('no snapshot');
  const skillMd = d.files.find((f) => /(^|\/)SKILL\.md$/i.test(f.path));
  return {
    via: 'api', installs: d.installs, files: d.files.map((f) => f.path),
    skillMd: skillMd ? skillMd.contents : '',
  };
}
function viaCli() {
  const r = spawnSync('npx', ['-y', 'skills', 'use', id], {
    encoding: 'utf8', timeout: 90000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', DISABLE_TELEMETRY: '1' },
  });
  if (r.error || r.status !== 0 || !r.stdout.trim()) throw new Error((r.stderr || '').trim().split('\n').pop() || 'skills use failed');
  const text = r.stdout.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const files = [...new Set([...text.matchAll(/[\w./-]+\.(?:md|sh|py|js|mjs|ts|json|ya?ml|txt)\b/g)].map((m) => m[0]))].slice(0, 50);
  return { via: 'skills use', files, skillMd: text };
}

let info = null;
const errs = [];
try { info = await viaApi(); } catch (e) { errs.push(`api: ${e.message}`); }
if (!info) { try { info = viaCli(); } catch (e) { errs.push(`cli: ${e.message}`); } }

if (!info) {
  console.log(JSON.stringify({ id, ok: false, errors: errs, url: `https://skills.sh/${source}/${name}`,
    hint: 'Open the URL (or fetch it with a web tool) to read the skill page.' }, null, 2));
  process.exit(1);
}
const scripts = info.files.filter((f) => SCRIPT_RE.test(f));
const fm = info.skillMd.match(/^---\n([\s\S]*?)\n---/);
console.log(JSON.stringify({
  id, ok: true, via: info.via, url: `https://skills.sh/${source}/${name}`,
  installs: info.installs, files: info.files, bundledScripts: scripts,
  frontmatter: fm ? fm[1] : null,
  skillMd: info.skillMd.length > MAX ? info.skillMd.slice(0, MAX) + `\n…[truncated, ${info.skillMd.length} chars]` : info.skillMd,
}, null, 2));
