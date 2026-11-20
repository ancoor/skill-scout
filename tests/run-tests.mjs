#!/usr/bin/env node
// Offline tests: detector on fixture repos + search/rank/plan against a mock API.
// Usage: node tests/run-tests.mjs
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const S = path.join(here, '..', 'skills', 'skill-scout', 'scripts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-scout-test-'));
// Work on a copy of the fixtures, and add an "installed" skill there (kept out
// of the repo so skill installers never mistake it for one of our skills).
const FX = path.join(tmp, 'fixtures');
fs.cpSync(path.join(here, 'fixtures'), FX, { recursive: true });
fs.mkdirSync(path.join(FX, 'turbo-shop/.claude/skills/frontend-design'), { recursive: true });
fs.writeFileSync(path.join(FX, 'turbo-shop/.claude/skills/frontend-design/SKILL.md'), '---\nname: frontend-design\ndescription: UI design\n---\nbody\n');
const PORT = 4600 + Math.floor(Math.random() * 300);
const env = { ...process.env, SKILLS_API_URL: `http://127.0.0.1:${PORT}` };

const node = (args, opts = {}) => execFileSync(process.execPath, args, { env, encoding: 'utf8', ...opts });
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
}

const mock = spawn(process.execPath, [path.join(here, 'mock-skills-api.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => mock.stdout.once('data', r));

try {
  const detect = (name) => {
    const out = path.join(tmp, `${name}.json`);
    node([path.join(S, 'detect-stack.mjs'), path.join(FX, name), '--no-global', '--out', out]);
    return { file: out, p: JSON.parse(fs.readFileSync(out, 'utf8')) };
  };
  const groupWith = (p, proj) => p.stackGroups.find((g) => g.projects.includes(proj));

  const turbo = detect('turbo-shop');
  test('turbo: monorepo tools', () => {
    assert.equal(turbo.p.isMonorepo, true);
    assert.deepEqual(turbo.p.monorepoTools.sort(), ['pnpm-workspaces', 'turborepo']);
  });
  test('turbo: web and mobile are separate stacks', () => {
    assert.ok(groupWith(turbo.p, 'apps/web').stack.includes('nextjs'));
    assert.ok(groupWith(turbo.p, 'apps/mobile').stack.includes('react-native'));
    assert.notEqual(groupWith(turbo.p, 'apps/web').id, groupWith(turbo.p, 'apps/mobile').id);
  });
  test('turbo: prisma schema provider → postgres', () => {
    assert.ok(turbo.p.technologies.some((t) => t.id === 'postgres'));
  });
  test('turbo: installed skill + rules file found', () => {
    assert.ok(turbo.p.installedSkills.some((s) => s.name === 'frontend-design'));
    assert.ok(turbo.p.agentRules.includes('CLAUDE.md'));
  });

  const fin = detect('fintech-platform');
  test('fintech: maven parent is a workspace root, not a project', () => {
    assert.ok(fin.p.workspaceRoots.includes('.'));
    assert.ok(!fin.p.projects.some((p) => p.path === '.'));
  });
  test('fintech: both Spring services grouped together', () => {
    const g = groupWith(fin.p, 'services/payments-api');
    assert.ok(g.projects.includes('services/ledger'));
    assert.ok(g.stack.includes('spring-boot'));
  });
  test('fintech: python + react groups, data + infra signals', () => {
    assert.ok(groupWith(fin.p, 'services/risk-ml').stack.includes('fastapi'));
    assert.ok(groupWith(fin.p, 'frontend').stack.includes('react'));
    const ids = fin.p.technologies.map((t) => t.id);
    for (const id of ['kafka', 'flyway', 'redis', 'kubernetes', 'terraform', 'jenkins', 'testcontainers']) assert.ok(ids.includes(id), id);
  });
  test('fintech: lifecycle queries always present (incl. grilling)', () => {
    assert.ok(fin.p.queries.some((q) => q.q === 'grill me'));
  });

  const go = detect('go-svc');
  test('go: single project', () => {
    assert.equal(go.p.isMonorepo, false);
    assert.deepEqual(go.p.stackGroups[0].stack.sort(), ['gin', 'go']);
  });

  const search = (profile, extra = []) => JSON.parse(node([path.join(S, 'search-skills.mjs'), '--profile', profile, '--no-cli-fallback', '--audit', ...extra.flatMap((e) => ['--extra', e])]));
  const finRes = search(fin.file, ['payments']);
  const all = (r) => r.buckets.flatMap((b) => b.top);
  test('search: per-group stack buckets in a monorepo', () => {
    assert.ok(finRes.buckets.some((b) => b.id.startsWith('stack:g')));
    assert.ok(finRes.buckets.find((b) => b.id === 'quality').top.length > 0);
    assert.ok(finRes.buckets.find((b) => b.id === 'domain'));
  });
  test('search: near misses (react native for a web app) are excluded', () => {
    assert.ok(!all(finRes).some((r) => r.name === 'react-native-best-practices'));
    assert.ok(finRes.nearMisses.some((r) => r.notInRepo === 'react-native'));
  });
  test('search: forks deduplicated, low-install noise dropped', () => {
    assert.equal(all(finRes).filter((r) => r.name === 'spring-boot').length <= 1, true);
    assert.ok(!all(finRes).some((r) => r.name === 'random-thing'));
  });
  test('search: audit attached', () => {
    assert.ok(all(finRes).every((r) => r.audit && r.audit.status));
  });

  const turboRes = search(turbo.file);
  test('search: next skill goes to the web group, expo to mobile', () => {
    const web = groupWith(turbo.p, 'apps/web').id;
    const mob = groupWith(turbo.p, 'apps/mobile').id;
    const b = (id) => turboRes.buckets.find((x) => x.id === `stack:${id}`)?.top.map((r) => r.name) || [];
    assert.ok(b(web).includes('next-best-practices'));
    assert.ok(b(mob).includes('building-native-ui'));
  });

  test('plan: grouped by source, dry run, safe ids only', () => {
    const out = node([path.join(S, 'plan-install.mjs'), '--select', 'obra/superpowers@a,obra/superpowers@b', '--select', 'x/y@c', '--global']);
    assert.match(out, /npx -y skills add obra\/superpowers --skill a b --agent claude-code -y -g/);
    assert.match(out, /dry run/);
    assert.throws(() => node([path.join(S, 'plan-install.mjs'), '--select', 'x/y@c;rm -rf ~'], { stdio: 'pipe' }));
  });
  test('plan: --save writes record', () => {
    const rec = path.join(tmp, 'rec.json');
    node([path.join(S, 'plan-install.mjs'), '--select', 'x/y@c', '--save', rec, '--profile', fin.file]);
    const r = JSON.parse(fs.readFileSync(rec, 'utf8'));
    assert.deepEqual(r.skills, ['x/y@c']);
    assert.equal(r.stack.isMonorepo, true);
  });
  test('info: reports bundled scripts', () => {
    const r = JSON.parse(node([path.join(S, 'skill-info.mjs'), 'mattpocock/skills@grill-me']));
    assert.deepEqual(r.bundledScripts, ['scripts/run.sh']);
  });
  test('search: unreachable API gives a clear error', () => {
    let out = '';
    try { node([path.join(S, 'search-skills.mjs'), '--q', 'react', '--no-cli-fallback'], { env: { ...env, SKILLS_API_URL: 'http://127.0.0.1:1' }, stdio: 'pipe' }); }
    catch (e) { out = e.stdout; }
    assert.match(out, /Every search failed/);
  });
} finally {
  mock.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
