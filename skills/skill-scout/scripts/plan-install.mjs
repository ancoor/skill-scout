#!/usr/bin/env node
// skill-scout: turn a selection of skills into `npx skills add` commands,
// grouped so each source repo is fetched once. Dry run by default.
//
// Usage:
//   node plan-install.mjs --select owner/repo@skill [--select ...]
//                         [--agent claude-code] [--agent cursor] [--global] [--copy]
//                         [--execute] [--save .skill-scout.json] [--profile profile.json]
//
//   --select   may be repeated, or given a comma-separated list
//   --agent    target agent(s); default claude-code. Always pass one: without it
//              the skills CLI asks interactively, which hangs inside an agent.
//   --global   install for the user (all projects) instead of this repo
//   --execute  actually run the commands (otherwise only prints them)
//   --save     write a record of the stack and chosen skills (for teammates / re-runs)

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = { select: [], agents: [], global: false, copy: false, execute: false, save: null, profile: null, cwd: process.cwd() };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--select') opt.select.push(...argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
  else if (a === '--agent') opt.agents.push(argv[++i]);
  else if (a === '--global' || a === '-g') opt.global = true;
  else if (a === '--copy') opt.copy = true;
  else if (a === '--execute') opt.execute = true;
  else if (a === '--save') opt.save = argv[++i];
  else if (a === '--profile') opt.profile = argv[++i];
  else if (a === '--cwd') opt.cwd = argv[++i];
  else if (a === '-h' || a === '--help') {
    console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1, 17).join('\n'));
    process.exit(0);
  }
}
if (!opt.agents.length) opt.agents.push('claude-code');
if (!opt.select.length) { console.error('Nothing selected. Pass --select owner/repo@skill.'); process.exit(2); }

const SAFE = /^[\w.-]+\/[\w.-]+@[\w.:-]+$/;
const bad = opt.select.filter((s) => !SAFE.test(s));
if (bad.length) { console.error(`Invalid skill id(s): ${bad.join(', ')} (expected owner/repo@skill)`); process.exit(2); }

// group by source repo
const bySource = new Map();
for (const id of [...new Set(opt.select)]) {
  const at = id.lastIndexOf('@');
  const source = id.slice(0, at);
  const name = id.slice(at + 1);
  if (!bySource.has(source)) bySource.set(source, []);
  bySource.get(source).push(name);
}

const plans = [...bySource.entries()].map(([source, names]) => {
  const args = ['-y', 'skills', 'add', source, '--skill', ...names, '--agent', ...opt.agents, '-y'];
  if (opt.global) args.push('-g');
  if (opt.copy) args.push('--copy');
  return { source, skills: names, args, command: `npx ${args.join(' ')}` };
});

console.log(`${opt.execute ? 'Installing' : 'Plan (dry run)'}: ${opt.select.length} skill(s) from ${plans.length} repo(s), ` +
  `scope=${opt.global ? 'global' : 'project'}, agent=${opt.agents.join(',')}`);
for (const p of plans) console.log(`  ${p.command}`);

const results = [];
if (opt.execute) {
  for (const p of plans) {
    console.log(`\n→ ${p.source}: ${p.skills.join(', ')}`);
    const r = spawnSync('npx', p.args, { cwd: opt.cwd, stdio: 'inherit', timeout: 180000, env: { ...process.env, DISABLE_TELEMETRY: process.env.DISABLE_TELEMETRY || '1' } });
    const ok = r.status === 0 && !r.error;
    results.push({ source: p.source, skills: p.skills, ok, error: ok ? undefined : String(r.error?.message || `exit ${r.status}`) });
  }
  console.log('\nResult:');
  for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.source}: ${r.skills.join(', ')}${r.ok ? '' : `  (${r.error})`}`);
}

if (opt.save) {
  let stack = null;
  if (opt.profile) {
    try {
      const p = JSON.parse(fs.readFileSync(opt.profile, 'utf8'));
      stack = {
        isMonorepo: p.isMonorepo,
        monorepoTools: p.monorepoTools,
        groups: (p.stackGroups || []).map((g) => ({ label: g.label, projects: g.projects })),
        repoWide: p.shared,
      };
    } catch { /* ignore */ }
  }
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(opt.save, 'utf8')); } catch { /* new file */ }
  const okIds = opt.execute
    ? results.filter((r) => r.ok).flatMap((r) => r.skills.map((s) => `${r.source}@${s}`))
    : opt.select;
  const record = {
    tool: 'skill-scout',
    version: 1,
    updatedAt: new Date().toISOString(),
    agents: opt.agents,
    scope: opt.global ? 'global' : 'project',
    stack: stack || prev?.stack || null,
    skills: [...new Set([...(prev?.skills || []), ...okIds])].sort(),
    reinstall: 'npx skills add <source> --skill <names> --agent <agent> -y   (one per source; see "skills")',
  };
  if (!opt.execute) record.note = 'Saved from a dry run: these skills were planned, not installed.';
  fs.writeFileSync(opt.save, JSON.stringify(record, null, 2) + '\n');
  console.log(`\nSaved ${opt.save}`);
}

if (results.some((r) => !r.ok)) process.exitCode = 1;
