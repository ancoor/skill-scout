#!/usr/bin/env node
// Offline stand-in for skills.sh used by the tests. Serves:
//   GET /api/search?q=...                      (same shape the skills CLI reads)
//   GET /api/v1/skills/audit/{owner}/{repo}/{skill}
//   GET /api/v1/skills/{owner}/{repo}/{skill}
// Data is made up; it only exercises parsing, scoring and bucketing.
import http from 'node:http';
const S = (source, name, installs, kw) => ({ id: `${source}/${name}`, source, name, installs, kw });
const DB = [
  S('spring-io/agent-skills', 'spring-boot-best-practices', 4200, 'spring boot java'),
  S('someone/java-skills', 'spring-boot', 140, 'spring boot'),
  S('fork/java-skills', 'spring-boot', 12, 'spring boot'),
  S('acme/jvm', 'jpa-hibernate-patterns', 900, 'jpa hibernate java'),
  S('dbtools/skills', 'postgres-best-practices', 21000, 'postgres postgresql database'),
  S('neondatabase/agent-skills', 'neon-postgres', 8000, 'postgres'),
  S('dbtools/skills', 'database-migrations', 3100, 'database migrations flyway'),
  S('streamco/skills', 'kafka-patterns', 2500, 'kafka messaging'),
  S('redis/agent-skills', 'redis-development', 5000, 'redis cache'),
  S('vercel-labs/agent-skills', 'react-best-practices', 90000, 'react nextjs'),
  S('vercel-labs/next-skills', 'next-best-practices', 60000, 'nextjs react'),
  S('expo/skills', 'building-native-ui', 15000, 'expo react native'),
  S('callstackincubator/agent-skills', 'react-native-best-practices', 11000, 'react native'),
  S('prisma/skills', 'prisma-orm', 7000, 'prisma'),
  S('pyguild/skills', 'fastapi-expert', 3000, 'fastapi python'),
  S('pyguild/skills', 'pytest-patterns', 1800, 'pytest python testing'),
  S('mlfolk/skills', 'pytorch-training', 900, 'pytorch'),
  S('microsoft/playwright-skills', 'playwright-testing', 9000, 'playwright testing'),
  S('k8s-folks/skills', 'kubernetes-manifests', 4000, 'kubernetes helm'),
  S('hashicorp/agent-skills', 'terraform-style-guide', 6000, 'terraform'),
  S('mattpocock/skills', 'grill-me', 40000, 'grill me review plan'),
  S('obra/superpowers', 'test-driven-development', 70000, 'tdd testing'),
  S('obra/superpowers', 'systematic-debugging', 65000, 'systematic debugging'),
  S('anthropics/skills', 'code-review', 30000, 'code review'),
  S('someone/skills', 'security-review', 5000, 'security review audit'),
  S('archco/skills', 'software-architecture', 8000, 'software architecture design'),
  S('gitco/skills', 'git-commit', 12000, 'git commit'),
  S('tiny/skills', 'random-thing', 3, 'react'),
  S('vercel/turborepo', 'turborepo', 9000, 'turborepo monorepo'),
  S('payco/skills', 'payments-integration', 600, 'payments stripe'),
];
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (u.pathname === '/api/search') {
    const terms = (u.searchParams.get('q') || '').toLowerCase().split(/\s+/);
    const hits = DB.filter((s) => terms.some((t) => s.kw.includes(t))).sort((a, b) => b.installs - a.installs)
      .map(({ kw, ...s }) => s);
    return send(200, { skills: hits });
  }
  let m = u.pathname.match(/^\/api\/v1\/skills\/audit\/(.+)\/(.+)\/(.+)$/);
  if (m) return m[3] === 'security-review' ? send(200, { audits: [{ provider: 'Mock', status: 'warn', riskLevel: 'MEDIUM', summary: 'Runs shell commands' }] })
    : m[3] === 'random-thing' ? send(404, {}) : send(200, { audits: [{ provider: 'Mock', status: 'pass', riskLevel: 'LOW', summary: 'ok' }] });
  m = u.pathname.match(/^\/api\/v1\/skills\/(.+)\/(.+)\/(.+)$/);
  if (m) return send(200, { id: `${m[1]}/${m[2]}/${m[3]}`, installs: 123, files: [{ path: 'SKILL.md', contents: `---\nname: ${m[3]}\ndescription: Mock skill\n---\n# ${m[3]}\nDo things.` }, { path: 'scripts/run.sh', contents: 'echo hi' }] });
  send(404, {});
}).listen(Number(process.argv[2] || 4599), () => console.log('mock up'));
