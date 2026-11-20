# skill-scout

[![skills.sh](https://skills.sh/b/ancoor/skill-scout)](https://skills.sh/ancoor/skill-scout)

**Find and install the best agent skills for the repo you're in.**

`skill-scout` is an [Agent Skill](https://agentskills.io) that:

1. **Analyses your repo**: languages, frameworks, databases, messaging, infra, CI, testing,
   architecture style and business domain.
2. **Understands monorepos.** It finds every project (Turborepo, Nx, pnpm/npm workspaces,
   Maven modules, Gradle, Go/Cargo workspaces, Bazel) and groups them by stack, so 15 Spring
   Boot services and 2 React apps give you two sets of recommendations, not 17.
3. **Searches [skills.sh](https://skills.sh)** for each part of the stack, plus lifecycle
   skills: grilling or design review, code review, TDD, debugging, security, architecture, git.
4. **Ranks and shortlists** by relevance, popularity, official vendor and security audit. It skips
   skills you already have and filters out near misses (no React Native skills for a web-only
   React app).
5. **Lets you choose**: install all, tick the ones you want, or read about any skill first.
6. **Installs in one go** with `npx skills add`, one command per source repo.

Works with Claude Code, Cursor, Codex, OpenCode, Windsurf, Gemini CLI, GitHub Copilot and
any other agent the [`skills` CLI](https://github.com/vercel-labs/skills) supports.

## Install

```bash
npx skills add ancoor/skill-scout
```

Install it globally so it's available in every repo:

```bash
npx skills add ancoor/skill-scout -g
```

## Use

Open your agent in any repo and say:

> Find the best skills for this repo

or `/skill-scout`. You'll see something like:

```
Monorepo (Maven multi-module), 3 stacks
- Java · Spring Boot (services/payments-api, services/ledger): JPA, PostgreSQL, Flyway, Kafka, Redis, Testcontainers
- TypeScript · React (frontend): Vite, Redux, MUI, Cypress
- Python · FastAPI (services/risk-ml): PyTorch, pandas, SQLAlchemy, pytest
- Repo-wide: Jenkins, Kubernetes, Terraform, docker-compose
- Domain: payments, double-entry ledger, fraud scoring

How do you want to proceed?
  ○ Install all 12 (Recommended)
  ○ Let me pick
  ○ Read about some first
  ○ Just show the commands
```

## How it works

| Step | Script | What it does |
|------|--------|--------------|
| Detect | `scripts/detect-stack.mjs` | Reads manifests and config files (`package.json`, `pom.xml`, `build.gradle`, `pyproject.toml`, `go.mod`, `Cargo.toml`, docker-compose, Terraform, k8s, Prisma schema, CI files…). Uses `git ls-files`, so `.gitignore` is respected. No network access. |
| Understand | the agent | Infers business domain and architecture style from the README and structure, and reads `CLAUDE.md`/`AGENTS.md` for conventions. |
| Search | `scripts/search-skills.mjs` | Queries the public skills.sh search (the same one `npx skills find` uses), with the CLI as fallback. Deduplicates, scores and buckets results. Optional security audits. |
| Read more | `scripts/skill-info.mjs` | Shows a skill's SKILL.md and bundled scripts without installing it. |
| Install | `scripts/plan-install.mjs` | Groups the selection by source repo and runs `npx skills add … --skill … --agent … -y`. Dry run by default. Can save `.skill-scout.json`. |

### What leaves your machine

Only search queries: technology names like `spring boot` or `postgres`, and short
domain phrases like `payments`. No code or file contents are sent.

### `.skill-scout.json`

When you agree, skill-scout writes a small record of the detected stack and the chosen
skills to the repo root. Commit it so teammates can see why those skills are there.

## Requirements

- Node.js 18+ for the scripts. They have no dependencies.
- Node.js 22.20+ for installing, which the `skills` CLI requires.
- Network access to `skills.sh` and GitHub.

## Development

```bash
node tests/run-tests.mjs
```

The tests run the detector on fixture repos (a Turborepo JS monorepo, a polyglot
Java/Python/React platform and a single Go service) and run search, ranking and install
planning against a local mock of the skills.sh API.

To add a technology, add an entry to `skills/skill-scout/scripts/lib/signals.mjs` with how
to detect it and what to search for.

## Limitations

- Ranking is heuristic. The agent reviews the shortlist before showing it to you, but check the
  "why" column.
- skills.sh ranks by installs, not quality. Audit status is shown when available, so still
  glance at skills that bundle scripts.
- Detection covers the most common ecosystems. Unusual build setups may need a quick look by
  the agent, which the skill tells it to do.

## License

MIT
