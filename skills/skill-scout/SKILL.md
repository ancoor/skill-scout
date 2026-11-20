---
name: skill-scout
description: "Analyse the current repository (including monorepos with several stacks), work out its tech stack, architecture and business domain, search skills.sh for the best matching agent skills (languages, frameworks, databases, infra, testing, code review, grilling, architecture, lifecycle), and let the user install all of them or pick which ones. Use when the user asks to find, recommend, suggest or set up skills for this repo or project, \"what skills should I install\", \"scout skills\", or runs /skill-scout."
---

# Skill Scout

Recommend and install the best skills.sh skills for the repo you are in.

The flow: **detect → understand → search → shortlist → let the user choose → install → save**.

All scripts are in `scripts/` next to this file. In the commands below `<skill-dir>` is the
directory that contains this SKILL.md. Use the OS temp directory for working files
(`$TMPDIR` or `/tmp`; on Windows `%TEMP%`), never the user's repo, except for the
optional `.skill-scout.json` record at the end. Scripts need Node 18+ and have no dependencies.
Installing needs `npx skills`, which needs Node 22.20+.

## 1. Detect the stack

Run from the repo root:

```bash
node <skill-dir>/scripts/detect-stack.mjs . --out /tmp/skill-scout-profile.json
```

It prints a short summary and writes a JSON profile with:
- `isMonorepo`, `monorepoTools`: Turborepo, Nx, pnpm/npm workspaces, Maven modules, Gradle, Go and Cargo workspaces, Bazel
- `stackGroups`: projects that share a stack (language plus framework). A monorepo with 15 Spring Boot services and 2 React apps gives two groups, not 17
- `technologies`: every detected technology, where it's used and in which group
- `shared`: repo-wide things (CI, Terraform, Kubernetes, docker-compose services)
- `installedSkills`, `lockedSkills`: skills already installed in this project or globally
- `agentRules`: CLAUDE.md, AGENTS.md, .cursorrules and similar files
- `readme.excerpt` and `queries`: the search queries to run, each tied to a bucket and group

If the script fails, read the main manifests yourself and carry on. Never stop here.

## 2. Understand the repo (your judgment, 1–2 minutes)

The script finds technologies. You add what it can't:

1. **Business domain.** Read `readme.excerpt`, and skim a few domain-heavy names (top-level
   folders, service names, main entities or models). Write 1–3 short domain phrases,
   e.g. `payments`, `double entry ledger`, `healthcare fhir`, `ecommerce checkout`.
2. **Architecture style**, if it is clear: `microservices`, `event driven architecture`,
   `domain driven design`, `hexagonal architecture`, `serverless`, `micro frontends`.
   Use at most 2, and only with evidence: several services and a broker means event-driven; folders named `domain/`, `application/` and `infrastructure/` mean hexagonal or DDD.
3. **Rules files.** If `agentRules` lists files, read them. Note conventions a skill must not
   contradict (package manager, test framework, commit style).
4. **Large monorepos.** If there are more than 4 stack groups, ask the user which areas
   they care about (multi-select over the groups) before searching. Drop the queries whose
   `groups` are all deselected. Keep repo-wide and lifecycle queries.

Show the user a compact profile before searching, for example:

> **Monorepo** (Turborepo + pnpm), 3 stacks
> - **Next.js · React** (apps/web): Prisma, PostgreSQL, Auth.js, Tailwind, Playwright
> - **Expo · React Native** (apps/mobile): Zustand, Jest
> - **React shared packages** (packages/ui): Storybook, Radix
> - Repo-wide: GitHub Actions, Turborepo
> - Domain: handmade-goods marketplace, payments
> - Already installed: frontend-design

## 3. Search skills.sh

```bash
node <skill-dir>/scripts/search-skills.mjs --profile /tmp/skill-scout-profile.json \
  --extra "payments" --extra "event driven architecture" \
  --audit --out /tmp/skill-scout-results.json
```

- Pass each domain or architecture phrase from step 2 as `--extra`.
- The script queries the same public search endpoint the `skills` CLI uses, falls back to
  `npx skills find`, removes duplicates, scores (relevance, then installs, then an official-vendor bonus) and
  splits results into **buckets**: one per stack group in a monorepo (`stack:g1` …), then
  `data`, `infra`, `quality` (testing, review, grilling, debugging, architecture), `domain`.
- Each bucket has `top` (up to 4) and `reserve` (the next 6). `nearMisses` are skills for technology
  the repo doesn't use (React Native skills for a web-only React app). Don't recommend them.
- `--audit` adds the skills.sh security audit status where available (`pass`, `warn`, `fail`,
  `not-audited`, `unavailable`).
- If the output has `error` (every search failed), tell the user skills.sh couldn't be
  reached, suggest checking network or proxy, and offer to retry. **Never invent skills.**

## 4. Build the shortlist (your judgment)

Go through `top` and `reserve` of every bucket and make the final list:

- Drop anything that doesn't fit the repo even though it scored well (wrong framework
  version or flavour, conflicts with the rules files, or a duplicate of an installed skill
  under another name).
- Promote a `reserve` item if it fits better than a `top` one.
- Keep **at most 4 per bucket** and roughly 8–16 in total. Fewer, sharper picks beat a long list.
- Always try to include at least one from **quality and lifecycle** (for example a grilling, review, TDD or debugging skill) when good ones exist.
- For each pick, write a one-line reason tied to the repo, such as "you use Flyway + Postgres in
  services/payments-api". In a monorepo, say which part it serves (`servesGroup`, `alsoServes`).

Present it as a table per bucket:

| # | Skill | For | Installs | Audit | Why |
|---|-------|-----|----------|-------|-----|
| 1 | `spring-io/agent-skills@spring-boot-best-practices` | services/* | 4.2K | pass | Spring Boot 3 services |

Number the rows continuously across buckets (1…N) so the text fallback works.
Mention skipped installed skills in one line.

## 5. Let the user choose

**If you have a multiple-choice question tool** (e.g. AskUserQuestion), ask both questions in one call:

1. *"How do you want to proceed?"* (single select)
   - `Install all N (Recommended)`
   - `Let me pick`
   - `Read about some first`
   - `Just show the commands`
2. *"Where should they be installed?"* (single select)
   - `This repo only (Recommended)`: committed with the project, shared with teammates
   - `Globally`: available in all your projects

Then:

- **Let me pick:** one multi-select question per bucket. The question tool allows at most
  4 questions per call and 4 options per question, which is why buckets hold 4. Header is
  the short bucket or group name (≤12 chars). Option label is the skill name. Option description
  is `For · installs · why`. With more than 4 buckets, ask a second round. If the user selects
  nothing in a bucket, install nothing from it.
- **Read about some first:** ask which ones (multi-select), then for each:
  ```bash
  node <skill-dir>/scripts/skill-info.mjs owner/repo@skill
  ```
  Summarise in 3–4 bullets: what it does, when it activates, bundled scripts (`bundledScripts`),
  audit status. Do **not** run any of its scripts. Then go back to *Let me pick* or *Install all*.
  If `skill-info` fails, fetch the skill's skills.sh page with your web tool, or give the link.
- **Just show the commands:** run step 6 without `--execute` and stop.

**If you have no question tool**, use plain text with the numbered table:
> Reply `all`, numbers like `1,3,5`, `more 2` to read about #2, or `none`. Add `global` to install for all projects.

## 6. Install

Check before installing. If any selected skill has audit `warn` or `fail`, or bundles
executable scripts and was not audited, name it and get an explicit yes for that skill.
Choosing it from the list is not enough.

```bash
node <skill-dir>/scripts/plan-install.mjs \
  --select owner/repo@skill-a,owner/repo@skill-b --select other/repo@skill-c \
  --agent claude-code [--global] --execute \
  --save .skill-scout.json --profile /tmp/skill-scout-profile.json
```

- Run from the repo root. In a monorepo, install at the root so every package sees the skills.
- `--agent`: always pass the agent you are running in, because without it the skills CLI prompts
  interactively and hangs. Use `claude-code`, `cursor`, `codex`, `opencode`, `windsurf`,
  `gemini-cli`, `github-copilot` and so on. Pass several `--agent` flags if the user wants more.
- The script groups skills by source repo, so each repo is fetched once.
- Leave out `--save` if the user doesn't want the `.skill-scout.json` record. It lists the
  detected stack and chosen skills, so teammates can reproduce the setup.

## 7. Report

Keep the report short: what was installed (✓/✗ per skill, with errors), where it was installed (project or global), and that the agent
session may need a restart to load new skills. Offer one next step: commit `.claude/skills` or
`.agents/skills` and `.skill-scout.json`, or re-run skill-scout later when the stack changes.

## Rules

- Install only what the user chose. Never run a recommended skill's scripts while evaluating it.
- Every recommendation must come from this run's search results, never from memory.
- Respect the repo's rules files. A skill that contradicts them doesn't get recommended.
- Only search queries (technology names and short domain phrases) leave the machine; no code
  or file contents are sent. Keep domain phrases generic (`payments`, not a client name).
