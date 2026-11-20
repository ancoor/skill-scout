#!/usr/bin/env node
// skill-scout: detect the tech stack of a repository (monorepo-aware).
//
// Usage:
//   node detect-stack.mjs [repoRoot] [--out profile.json] [--format json|text]
//                         [--no-global] [--max-queries 45]
//
// Prints a JSON profile (default) or a short text summary. No dependencies,
// no network access. Reads manifests and a few config files only.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  SIGNALS, SIGNAL_BY_ID, LIFECYCLE_QUERIES, CATEGORY_BUCKET, BUCKET_LABELS, CORE_CATS,
} from './lib/signals.mjs';

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt = { root: '.', out: null, format: 'json', global: true, maxQueries: 45 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out') opt.out = argv[++i];
  else if (a === '--format') opt.format = argv[++i];
  else if (a === '--no-global') opt.global = false;
  else if (a === '--max-queries') opt.maxQueries = Number(argv[++i]) || opt.maxQueries;
  else if (a === '-h' || a === '--help') {
    console.log('Usage: node detect-stack.mjs [repoRoot] [--out file] [--format json|text] [--no-global] [--max-queries N]');
    process.exit(0);
  } else if (!a.startsWith('-')) opt.root = a;
}
const ROOT = path.resolve(opt.root);
if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
  console.error(`Not a directory: ${ROOT}`);
  process.exit(2);
}

// ---------------------------------------------------------------- helpers
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', 'target', '.next', '.nuxt',
  '.svelte-kit', '.turbo', '.cache', 'coverage', '.gradle', '.idea', '.vscode', '.venv', 'venv',
  'env', '__pycache__', '.mypy_cache', '.pytest_cache', '.tox', 'vendor', 'third_party',
  'Pods', 'DerivedData', '.terraform', 'bin', 'obj', '.dart_tool', '_build', 'deps',
]);
// Paths that hold sample/test projects rather than real ones.
const SKIP_SEGMENTS = new Set(['fixtures', '__fixtures__', 'testdata', 'test-data', 'node_modules', 'vendor', 'third_party']);

const MAX_READ = 1024 * 1024; // 1 MB per file
function readText(rel) {
  try {
    const abs = path.join(ROOT, rel);
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > MAX_READ) return '';
    return fs.readFileSync(abs, 'utf8');
  } catch { return ''; }
}
function readJSON(rel) {
  try { return JSON.parse(readText(rel)); } catch { return null; }
}
const posix = (p) => p.split(path.sep).join('/');
const dirOf = (rel) => { const d = path.posix.dirname(rel); return d === '.' ? '' : d; };
const segs = (rel) => rel.split('/');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function listFiles() {
  // Prefer git so .gitignore is respected.
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: ROOT, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8');
    const files = out.split('\0').filter(Boolean)
      .filter((f) => !segs(f).some((s) => IGNORE_DIRS.has(s)));
    if (files.length) return { files: files.slice(0, 300000), via: 'git', truncated: files.length > 300000 };
  } catch { /* not a git repo */ }
  const files = [];
  const LIMIT = 80000;
  let truncated = false;
  (function walk(dir, depth) {
    if (truncated || depth > 10) return;
    let entries = [];
    try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= LIMIT) { truncated = true; return; }
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) walk(rel, depth + 1); }
      else if (e.isFile()) files.push(rel);
    }
  })('', 0);
  return { files, via: 'walk', truncated };
}

// ---------------------------------------------------------------- manifests
const MANIFEST_ECO = {
  'package.json': 'npm', 'pom.xml': 'maven', 'build.gradle': 'gradle', 'build.gradle.kts': 'gradle',
  'requirements.txt': 'pypi', 'pyproject.toml': 'pypi', 'Pipfile': 'pypi', 'setup.py': 'pypi',
  'setup.cfg': 'pypi', 'environment.yml': 'pypi', 'go.mod': 'go', 'Cargo.toml': 'cargo',
  'Gemfile': 'gem', 'composer.json': 'composer', 'pubspec.yaml': 'pub', 'mix.exs': 'hex',
  'Package.swift': 'swift', 'build.sbt': 'sbt', 'deno.json': 'npm',
};
// maven and gradle share the "maven" signal keys
const ECO_KEY = { npm: 'npm', maven: 'maven', gradle: 'maven', sbt: 'maven', pypi: 'pypi', go: 'go', cargo: 'cargo', gem: 'gem', composer: 'composer', nuget: 'nuget', pub: 'pub', hex: 'hex', swift: null };
const ECO_LANG = { maven: 'java', gradle: 'java', sbt: 'scala', pypi: 'python', go: 'go', cargo: 'rust', gem: 'ruby', composer: 'php', nuget: 'csharp', pub: 'dart', hex: 'elixir', swift: 'swift' };

function manifestEco(rel) {
  const base = path.posix.basename(rel);
  if (MANIFEST_ECO[base]) return MANIFEST_ECO[base];
  if (/^requirements[-_.].*\.txt$/i.test(base)) return 'pypi';
  if (/\.(csproj|fsproj|vbproj)$/i.test(base)) return 'nuget';
  return null;
}
function projectDirFor(rel) {
  const d = dirOf(rel);
  // requirements/base.txt style -> the parent dir is the project
  if (/(^|\/)requirements$/.test(d) && rel.endsWith('.txt')) return dirOf(d);
  return d;
}

// ---------------------------------------------------------------- matching
function textMatcher(text) {
  const t = text.toLowerCase().replace(/_/g, '-');
  return (needle) => {
    if (needle.startsWith('re:')) return new RegExp(needle.slice(3), 'i').test(t);
    const n = needle.toLowerCase().replace(/_/g, '-');
    return new RegExp(`(^|[^a-z0-9])${escapeRe(n)}`).test(t);
  };
}
function npmMatcher(names) {
  return (needle) => {
    if (needle.endsWith('*')) { const p = needle.slice(0, -1); return [...names].some((n) => n.startsWith(p)); }
    return names.has(needle);
  };
}

// ---------------------------------------------------------------- main scan
const { files, via, truncated } = listFiles();
const fileSet = new Set(files);

const projects = new Map(); // dir -> project
function getProject(dir) {
  if (!projects.has(dir)) {
    projects.set(dir, {
      path: dir || '.', dir, name: dir ? path.posix.basename(dir) : path.basename(ROOT),
      ecosystems: new Set(), manifests: [], tags: new Map(), npmNames: new Set(), texts: {},
      role: 'project', notes: [],
    });
  }
  return projects.get(dir);
}

for (const f of files) {
  if (segs(f).some((s) => SKIP_SEGMENTS.has(s))) continue;
  const eco = manifestEco(f);
  if (!eco) continue;
  const p = getProject(projectDirFor(f));
  p.ecosystems.add(eco);
  p.manifests.push(f);
  if (eco === 'npm') {
    const j = readJSON(f) || {};
    for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const n of Object.keys(j[k] || {})) p.npmNames.add(n);
    }
    if (j.workspaces) p.notes.push('npm-workspaces');
    if (j.name && f === `${p.dir ? p.dir + '/' : ''}package.json`) p.pkgName = j.name;
  } else {
    const key = ECO_KEY[eco];
    if (key) p.texts[key] = (p.texts[key] || '') + '\n' + readText(f);
    if (eco === 'maven') {
      const t = readText(f);
      if (/<modules>/.test(t)) p.notes.push('maven-modules');
      if (/<packaging>\s*pom\s*<\/packaging>/.test(t)) p.notes.push('maven-pom-packaging');
      const m = t.match(/<artifactId>([^<]+)<\/artifactId>/);
      if (m && !p.pkgName) p.pkgName = m[1];
    }
    if (eco === 'cargo') {
      const t = readText(f);
      if (/^\s*\[workspace\]/m.test(t)) p.notes.push('cargo-workspace');
      if (!/^\s*\[package\]/m.test(t)) p.notes.push('cargo-no-package');
    }
  }
}

function addTag(p, id, why) {
  if (!SIGNAL_BY_ID[id]) return;
  if (!p.tags.has(id)) p.tags.set(id, new Set());
  if (why) p.tags.get(id).add(why);
}

// Dependency-based signals.
for (const p of projects.values()) {
  const npmM = npmMatcher(p.npmNames);
  const textM = Object.fromEntries(Object.entries(p.texts).map(([k, v]) => [k, textMatcher(v)]));
  for (const s of SIGNALS) {
    if (s.npm && p.npmNames.size && s.npm.some(npmM)) addTag(p, s.id, 'package.json');
    for (const key of ['maven', 'pypi', 'go', 'cargo', 'gem', 'composer', 'nuget', 'pub', 'hex']) {
      if (s[key] && textM[key] && s[key].some(textM[key])) addTag(p, s.id, key === 'maven' ? 'pom/gradle' : key);
    }
  }
  // Languages from ecosystems.
  for (const eco of p.ecosystems) {
    if (eco === 'npm') {
      const ts = p.npmNames.has('typescript') || fileSet.has(`${p.dir ? p.dir + '/' : ''}tsconfig.json`);
      addTag(p, ts ? 'typescript' : 'javascript', 'package.json');
    } else if (ECO_LANG[eco]) addTag(p, ECO_LANG[eco], eco);
  }
}

// Nearest project for any file (by longest dir prefix).
const projectDirs = [...projects.keys()].sort((a, b) => b.length - a.length);
function ownerOf(rel) {
  for (const d of projectDirs) if (d === '' || rel === d || rel.startsWith(d + '/')) return projects.get(d);
  return null;
}

// Repo-level ("shared") tags that are not inside any project.
const shared = { tags: new Map() };
function addShared(id, why) {
  if (!SIGNAL_BY_ID[id]) return;
  if (!shared.tags.has(id)) shared.tags.set(id, new Set());
  if (why) shared.tags.get(id).add(why);
}
function addFileTag(rel, id) {
  const p = ownerOf(rel);
  if (p) addTag(p, id, rel); else addShared(id, rel);
}

const IMAGE_SIGNALS = SIGNALS.filter((s) => s.images);
let k8sChecked = 0;
const langStats = {};
const EXT_LANG = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript',
  '.java': 'Java', '.kt': 'Kotlin', '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby',
  '.php': 'PHP', '.cs': 'C#', '.dart': 'Dart', '.ex': 'Elixir', '.exs': 'Elixir', '.swift': 'Swift',
  '.scala': 'Scala', '.vue': 'Vue', '.svelte': 'Svelte', '.sql': 'SQL', '.tf': 'Terraform',
  '.c': 'C', '.cpp': 'C++', '.h': 'C/C++', '.sh': 'Shell',
};

for (const f of files) {
  const base = path.posix.basename(f);
  const ext = path.posix.extname(f).toLowerCase();
  if (EXT_LANG[ext]) langStats[EXT_LANG[ext]] = (langStats[EXT_LANG[ext]] || 0) + 1;
  if (segs(f).some((s) => SKIP_SEGMENTS.has(s))) continue;

  if (/^Dockerfile/i.test(base) || ext === '.dockerfile') addFileTag(f, 'docker');
  if (/^(docker-)?compose([.-].*)?\.ya?ml$/i.test(base)) {
    addFileTag(f, 'docker-compose');
    const t = readText(f).toLowerCase();
    for (const m of t.matchAll(/^\s*image:\s*["']?([^\s"'#]+)/gm)) {
      const img = m[1].split('@')[0];
      const name = img.split(':')[0].split('/').pop();
      for (const s of IMAGE_SIGNALS) if (s.images.some((i) => name.startsWith(i))) addFileTag(f, s.id);
    }
  }
  if (ext === '.tf') addFileTag(f, 'terraform');
  if (base === 'Chart.yaml') addFileTag(f, 'helm');
  if (base === 'kustomization.yaml' || base === 'kustomization.yml') addFileTag(f, 'kubernetes');
  if ((ext === '.yaml' || ext === '.yml') && k8sChecked < 60 &&
      /(^|\/)(k8s|kube|kubernetes|manifests|deploy|deployment|deployments|overlays|base|charts|templates)(\/|$)/i.test(dirOf(f))) {
    k8sChecked++;
    const t = readText(f);
    if (/^apiVersion:/m.test(t) && /^kind:\s*(Deployment|Service|StatefulSet|Ingress|CronJob|ConfigMap|DaemonSet)/m.test(t)) addFileTag(f, 'kubernetes');
  }
  if (/^Pulumi\.ya?ml$/.test(base)) addFileTag(f, 'pulumi');
  if (base === 'cdk.json') addFileTag(f, 'aws-cdk');
  if (/^serverless\.(ya?ml|ts|js)$/.test(base)) addFileTag(f, 'serverless');
  if (base === 'vercel.json') addFileTag(f, 'vercel');
  if (/^wrangler\.(toml|json|jsonc)$/.test(base)) addFileTag(f, 'cloudflare');
  if (ext === '.proto') addFileTag(f, 'grpc');
  if (ext === '.graphql' || ext === '.gql') addFileTag(f, 'graphql');
  if (/^(openapi|swagger)[\w.-]*\.(ya?ml|json)$/i.test(base)) addFileTag(f, 'openapi');
  if (base === 'schema.prisma') {
    addFileTag(f, 'prisma');
    const prov = (readText(f).match(/provider\s*=\s*"(postgresql|postgres|mysql|sqlite|mongodb|cockroachdb|sqlserver)"/) || [])[1];
    const map = { postgresql: 'postgres', postgres: 'postgres', cockroachdb: 'postgres', mysql: 'mysql', sqlite: 'sqlite', mongodb: 'mongodb' };
    if (map[prov]) addFileTag(f, map[prov]);
  }
  if (/(^|\/)db\/migration\/V\d+.*\.sql$/i.test(f)) addFileTag(f, 'flyway');
  if (/changelog.*\.(xml|ya?ml|json|sql)$/i.test(base) && /liquibase|changelog/i.test(f)) addFileTag(f, 'liquibase');
  if (base === 'alembic.ini') addFileTag(f, 'alembic');
  if (ext === '.ipynb') addFileTag(f, 'jupyter');
  if (base === 'components.json' && /shadcn/.test(readText(f))) addFileTag(f, 'shadcn');
  if (f === 'supabase/config.toml' || f.endsWith('/supabase/config.toml')) addFileTag(f, 'supabase');
  if (base === 'firebase.json') addFileTag(f, 'firebase');
  if (base === 'AndroidManifest.xml') addFileTag(f, 'android');
  if (f.includes('.xcodeproj/')) addFileTag(f, 'swiftui');
  if (ext === '.kt') { const p = ownerOf(f); if (p && (p.ecosystems.has('gradle') || p.ecosystems.has('maven'))) addTag(p, 'kotlin', 'kotlin sources'); }
  if (/^\.github\/workflows\/.+\.ya?ml$/.test(f)) addShared('github-actions', f);
  if (base === '.gitlab-ci.yml') addShared('gitlab-ci', f);
  if (base === 'Jenkinsfile') addShared('jenkins', f);
  if (f === '.circleci/config.yml') addShared('circleci', f);
  if (base === 'azure-pipelines.yml') addShared('azure-pipelines', f);
}

// Monorepo tooling at the root.
const monorepoTools = [];
function tool(id, why) { monorepoTools.push(id); addShared(id, why); }
if (fileSet.has('turbo.json')) tool('turborepo', 'turbo.json');
if (fileSet.has('nx.json')) tool('nx', 'nx.json');
if (fileSet.has('lerna.json')) tool('lerna', 'lerna.json');
if (fileSet.has('pnpm-workspace.yaml')) tool('pnpm-workspaces', 'pnpm-workspace.yaml');
if (fileSet.has('rush.json')) tool('npm-workspaces', 'rush.json');
if (projects.get('')?.notes.includes('npm-workspaces') && !monorepoTools.includes('pnpm-workspaces')) tool('npm-workspaces', 'package.json workspaces');
if (['WORKSPACE', 'WORKSPACE.bazel', 'MODULE.bazel'].some((f) => fileSet.has(f))) tool('bazel', 'bazel workspace');
if (fileSet.has('go.work')) tool('go-workspace', 'go.work');
if (projects.get('')?.notes.includes('cargo-workspace')) tool('cargo-workspace', 'Cargo.toml [workspace]');
if (projects.get('')?.notes.includes('maven-modules')) tool('maven-multimodule', 'pom.xml <modules>');
for (const s of ['settings.gradle', 'settings.gradle.kts']) {
  if (fileSet.has(s) && /^\s*include\b/m.test(readText(s))) tool('gradle-multiproject', s);
}

// ---------------------------------------------------------------- roles
const projList = [...projects.values()];
function hasChildren(p) {
  return projList.some((q) => q !== p && (p.dir === '' ? q.dir !== '' : q.dir.startsWith(p.dir + '/')));
}
function hasSources(p) {
  const pre = p.dir ? p.dir + '/' : '';
  return files.some((f) => f.startsWith(pre) && /^(src|app|lib|pages|cmd|internal)\//.test(f.slice(pre.length)) &&
    !projectDirs.some((d) => d !== p.dir && d.startsWith(pre) && f.startsWith(d + '/')));
}
for (const p of projList) {
  if (!hasChildren(p)) continue;
  const n = p.notes;
  const isWsRoot = n.includes('npm-workspaces') || n.includes('maven-modules') ||
    (n.includes('cargo-workspace') && n.includes('cargo-no-package')) ||
    (p.dir === '' && monorepoTools.length > 0);
  if (isWsRoot && !hasSources(p)) p.role = 'workspace-root';
}

// Workspace roots: framework/language tags flow down to children of the same
// JVM ecosystem (Maven parent POM / Gradle root build); everything else is shared.
for (const p of projList.filter((x) => x.role === 'workspace-root')) {
  const pre = p.dir ? p.dir + '/' : '';
  const kids = projList.filter((q) => q !== p && q.role !== 'workspace-root' && (p.dir === '' || q.dir.startsWith(pre)));
  for (const [id, why] of p.tags) {
    const cat = SIGNAL_BY_ID[id].cat;
    const jvm = p.ecosystems.has('maven') || p.ecosystems.has('gradle');
    if (jvm && (cat === 'framework' || cat === 'language')) {
      for (const k of kids) if (k.ecosystems.has('maven') || k.ecosystems.has('gradle')) addTag(k, id, `inherited from ${p.path}`);
    } else if (!CORE_CATS.has(cat)) {
      for (const w of why) addShared(id, w);
    }
  }
}

const realProjects = projList.filter((p) => p.role !== 'workspace-root');
const isMonorepo = monorepoTools.length > 0 || realProjects.length >= 2;

// ---------------------------------------------------------------- stack groups
const coreSig = (p) => [...p.tags.keys()].filter((t) => CORE_CATS.has(SIGNAL_BY_ID[t].cat)).sort();
const CAT_ORDER = ['language', 'framework', 'mobile', 'frontend'];
function groupLabel(sig) {
  return [...sig].sort((a, b) => CAT_ORDER.indexOf(SIGNAL_BY_ID[a].cat) - CAT_ORDER.indexOf(SIGNAL_BY_ID[b].cat))
    .map((t) => SIGNAL_BY_ID[t].label).join(' · ') || 'Other';
}

let groups = [];
for (const p of realProjects) {
  const sig = coreSig(p);
  const key = sig.join('|');
  let g = groups.find((x) => x.key === key);
  if (!g) { g = { key, sig, projects: [] }; groups.push(g); }
  g.projects.push(p);
}
// Merging, so a monorepo with 30 packages doesn't produce 30 groups:
//  1. A group with a framework folds into its superset group when there is
//     exactly one (a React UI package used only by the Next.js app). If several
//     apps could own it (web and mobile both use React), it stays its own
//     "shared" group.
//  2. A language-only group (utils, config packages) folds into the largest
//     group with the same language.
const isLangOnly = (g) => g.sig.length > 0 && g.sig.every((t) => SIGNAL_BY_ID[t].cat === 'language');
const supersetsOf = (g) => groups.filter((h) => h !== g && h.sig.length > g.sig.length && g.sig.every((t) => h.sig.includes(t)));
groups.sort((a, b) => b.sig.length - a.sig.length);
for (const g of [...groups].reverse()) {
  if (isLangOnly(g) || !g.sig.length) continue;
  const sups = supersetsOf(g);
  if (sups.length === 1) { sups[0].projects.push(...g.projects); groups = groups.filter((x) => x !== g); }
  else if (sups.length > 1) g.shared = true;
}
for (const g of [...groups]) {
  if (!isLangOnly(g)) continue;
  const host = supersetsOf(g).sort((a, b) => b.projects.length - a.projects.length || b.sig.length - a.sig.length)[0];
  if (host) { host.projects.push(...g.projects); groups = groups.filter((x) => x !== g); }
}
groups.sort((a, b) => b.projects.length - a.projects.length || b.sig.length - a.sig.length);
groups = groups.map((g, i) => {
  const extra = new Map();
  for (const p of g.projects) for (const t of p.tags.keys()) if (!g.sig.includes(t)) extra.set(t, (extra.get(t) || 0) + 1);
  return {
    id: `g${i + 1}`,
    label: groupLabel(g.sig) + (g.shared ? ' (shared packages)' : ''),
    stack: g.sig,
    projects: g.projects.map((p) => p.path),
    otherTags: [...extra.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
  };
});
const groupOfProject = new Map();
for (const g of groups) for (const p of g.projects) groupOfProject.set(p, g.id);

// ---------------------------------------------------------------- tag index
const tagIndex = new Map();
function indexTag(id, where, gid) {
  const s = SIGNAL_BY_ID[id];
  if (!tagIndex.has(id)) tagIndex.set(id, { id, label: s.label, category: s.cat, bucket: CATEGORY_BUCKET[s.cat], where: new Set(), groups: new Set() });
  const e = tagIndex.get(id);
  e.where.add(where);
  if (gid) e.groups.add(gid);
}
for (const p of realProjects) for (const id of p.tags.keys()) indexTag(id, p.path, groupOfProject.get(p.path));
for (const id of shared.tags.keys()) indexTag(id, 'repo', null);

// ---------------------------------------------------------------- installed skills
function readSkillDir(dir, scope) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    const md = path.join(dir, e.name, 'SKILL.md');
    let text = '';
    try { text = fs.readFileSync(md, 'utf8').slice(0, 4000); } catch { continue; }
    const name = (text.match(/^name:\s*["']?([^"'\n]+)/m) || [])[1]?.trim() || e.name;
    const desc = (text.match(/^description:\s*["']?([^\n]+)/m) || [])[1]?.trim().replace(/["']$/, '').slice(0, 200) || '';
    out.push({ name, dir: e.name, scope, location: dir, description: desc });
  }
  return out;
}
const SKILL_DIRS = ['.claude/skills', '.agents/skills', '.cursor/skills', '.codex/skills', '.windsurf/skills', '.opencode/skills', '.github/skills', '.gemini/skills'];
let installed = [];
for (const d of SKILL_DIRS) installed.push(...readSkillDir(path.join(ROOT, d), 'project'));
if (opt.global) {
  const home = os.homedir();
  for (const d of [...SKILL_DIRS, '.config/opencode/skills']) installed.push(...readSkillDir(path.join(home, d), 'global'));
}
const lock = readJSON('skills-lock.json');
const lockedSkills = [];
if (lock && typeof lock === 'object') {
  const coll = lock.skills || lock;
  if (coll && typeof coll === 'object') {
    for (const [k, v] of Object.entries(coll)) {
      if (k === 'version') continue;
      lockedSkills.push({ name: k, source: (v && (v.source || v.repo)) || null });
    }
  }
}
// dedupe by name+scope
installed = [...new Map(installed.map((s) => [`${s.scope}:${s.name}`, s])).values()];

// ---------------------------------------------------------------- rules files, readme
const RULE_RE = /(^|\/)(CLAUDE\.md|AGENTS\.md|GEMINI\.md|\.cursorrules|\.windsurfrules|copilot-instructions\.md)$|^\.cursor\/rules\//;
const agentRules = files.filter((f) => RULE_RE.test(f) && !segs(f).some((s) => SKIP_SEGMENTS.has(s))).slice(0, 40);
const readmeFile = files.find((f) => /^readme(\.md|\.rst|\.txt)?$/i.test(f));
const readmeExcerpt = readmeFile ? readText(readmeFile).replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').slice(0, 1500) : '';

// ---------------------------------------------------------------- queries
const CAT_PRIORITY = { framework: 0, frontend: 0, mobile: 0, orm: 1, database: 1, messaging: 1, cache: 2, search: 2, migrations: 2, api: 2, auth: 2, ai: 1, styling: 3, testing: 3, monorepo: 3, infra: 3, cloud: 3, ci: 4, build: 5, language: 4 };
const qmap = new Map();
for (const t of tagIndex.values()) {
  const s = SIGNAL_BY_ID[t.id];
  for (const q of s.q || []) {
    if (!qmap.has(q)) qmap.set(q, { q, bucket: t.bucket, category: t.category, tags: [], groups: new Set(), priority: CAT_PRIORITY[t.category] ?? 5 });
    const e = qmap.get(q);
    e.tags.push(t.id);
    for (const g of t.groups) e.groups.add(g);
  }
}
let queries = [...qmap.values()].sort((a, b) => a.priority - b.priority);
const reserve = LIFECYCLE_QUERIES.length;
queries = queries.slice(0, Math.max(0, opt.maxQueries - reserve));
for (const l of LIFECYCLE_QUERIES) queries.push({ q: l.q, bucket: 'quality', category: 'lifecycle', tags: [], groups: new Set(), priority: 6, reason: l.reason });
queries = queries.map((q) => ({ ...q, groups: [...q.groups] }));

// ---------------------------------------------------------------- output
const profile = {
  tool: 'skill-scout',
  version: 1,
  generatedAt: new Date().toISOString(),
  root: ROOT,
  scan: { via, files: files.length, truncated },
  isMonorepo,
  monorepoTools,
  stackGroups: groups,
  projects: realProjects.map((p) => ({
    path: p.path, name: p.pkgName || p.name, group: groupOfProject.get(p.path) || null,
    ecosystems: [...p.ecosystems], manifests: p.manifests.slice(0, 6),
    tags: [...p.tags.keys()],
  })),
  workspaceRoots: projList.filter((p) => p.role === 'workspace-root').map((p) => p.path),
  shared: [...shared.tags.keys()],
  technologies: [...tagIndex.values()].map((t) => ({ ...t, where: [...t.where].slice(0, 12), groups: [...t.groups] }))
    .sort((a, b) => (CAT_PRIORITY[a.category] ?? 9) - (CAT_PRIORITY[b.category] ?? 9)),
  languageStats: Object.entries(langStats).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([language, files]) => ({ language, files })),
  installedSkills: installed,
  lockedSkills,
  agentRules,
  readme: readmeFile ? { file: readmeFile, excerpt: readmeExcerpt } : null,
  buckets: BUCKET_LABELS,
  queries,
};

function toText(pr) {
  const L = [];
  const lab = (id) => SIGNAL_BY_ID[id]?.label || id;
  L.push(`Repo: ${pr.root}`);
  L.push(`Type: ${pr.isMonorepo ? 'monorepo' : 'single project'}${pr.monorepoTools.length ? ` (${pr.monorepoTools.map(lab).join(', ')})` : ''} — ${pr.projects.length} project(s), ${pr.scan.files} files`);
  L.push('');
  L.push('Stack groups:');
  for (const g of pr.stackGroups) {
    L.push(`  [${g.id}] ${g.label} — ${g.projects.length} project(s): ${g.projects.slice(0, 6).join(', ')}${g.projects.length > 6 ? ', …' : ''}`);
    if (g.otherTags.length) L.push(`        also: ${g.otherTags.map(lab).join(', ')}`);
  }
  if (pr.shared.length) L.push(`Repo-wide: ${pr.shared.map(lab).join(', ')}`);
  if (pr.agentRules.length) L.push(`Agent rules files: ${pr.agentRules.join(', ')}`);
  if (pr.installedSkills.length) L.push(`Installed skills: ${pr.installedSkills.map((s) => `${s.name} (${s.scope})`).join(', ')}`);
  L.push(`Search queries: ${pr.queries.length}`);
  return L.join('\n');
}

const json = JSON.stringify(profile, null, 2);
if (opt.out) fs.writeFileSync(opt.out, json);
if (opt.format === 'text') console.log(toText(profile));
else if (!opt.out) console.log(json);
else console.log(toText(profile));
