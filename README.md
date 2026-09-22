<div align="center">

# OPM

**Design it. Prove it. Ship it.**

An engineering workflow for [Claude Code](https://claude.com/claude-code) that
refuses to call anything done without evidence.

[![tests](https://github.com/harshadmadaye/OPM/actions/workflows/tests.yml/badge.svg)](https://github.com/harshadmadaye/OPM/actions/workflows/tests.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757.svg)](https://docs.claude.com/en/docs/claude-code/plugins)

</div>

```bash
npx opm-core@latest
```

That installs the plugin and copies the coding rules into your repo. Two
commands if you prefer the native route:

```bash
claude plugin marketplace add harshadmadaye/OPM
claude plugin install opm@opm
```

## What it is

A coding agent will tell you the tests pass. Sometimes it did not run them.
It will tell you a feature is finished when one branch of it was never
written. The failure is rarely in the code it produces; it is in the claims it
makes about that code, and in what falls out of a context window that has been
filling up for an hour.

OPM is one opinionated loop that fixes both. Long work runs in fresh subagents
so nothing important depends on a context window surviving. And nothing is
called done, fixed or passing without command output to show for it. A
reviewer reads every task's diff before the next one starts, a progress ledger
on disk survives compaction, and hooks stop the shortcuts, starting with
`git commit --no-verify`.

Fourteen skills, five reviewer subagents, six hooks. The always-on cost is
about two thousand tokens; everything else loads only when it is needed.

## How it works

1. **Brew** the idea, if it is not settled yet. Four agents argue it from the product, engineering, skeptic and market angles, and a judge ranks what to build.
2. **Design** it. One question at a time, scaled to the size of the job. Nothing gets written until you agree the shape.
3. **Plan** it. The spec becomes bite-sized tasks, each with a failing test, an implementation and a commit.
4. **Execute** it. One fresh subagent per task, a reviewer gate after each, a ledger that survives compaction.
5. **Verify** it. Build, types, lint, tests, secrets scan. Real output, or it did not happen.
6. **Capture** what was non-obvious, so the next project starts from it.

Each step is a skill you can invoke on its own. You do not have to run the
whole loop to get value from any one of them.

## Quickstart

Install, then open Claude Code in your project and say what you want.

```
/opm:brainstorming add a CSV export to the reports page
```

It will ask what matters, propose an approach, and wait for your yes before
writing anything.

Two other good places to start:

```
/opm:brew-idea      an idea you have not settled yet: four agents argue it out
/opm:jump-start     a whole new project from one prompt
```

Nothing here phones home and nothing runs a model behind your back.

## Install in detail

`npx opm-core@latest` takes options if you want to skip a step:

```bash
npx opm-core@latest --rules typescript,react   # no questions
npx opm-core@latest --plugin-only              # skip the rules
npx opm-core@latest --rules-only ../other-repo # rules for another repo
```

The rules are plain markdown that Claude Code loads from
`<repo>/.claude/rules/opm/`. A plugin cannot ship them, which is why they are
copied per repository. Keep `common/` small: it loads in every session.

This repository is public, so no GitHub credentials are needed. Upgrading from
an older install? Run `claude plugin marketplace remove opm` first, otherwise
you keep pulling from wherever it pointed before. If `/opm:` commands are not
recognised afterwards, run `/reload-plugins`. If your git reaches GitHub over
SSH and that fails, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`.

## Skills

All 14 skills, invoked as `/opm:<name>` or picked up automatically when their
description matches the task.

**The loop**

| Skill | What it does |
|---|---|
| `using-opm` | Injected at session start. Tells Claude to check for an applicable skill before any other action and maps the workflow below. |
| `brew-idea` | Before brainstorming, when the idea itself is not settled. Four agents argue from product, engineering, skeptic and market angles; one judge ranks features and writes a plan. Writes `docs/specs/` and a readable page in `docs/brew/`. |
| `brainstorming` | No code before the design is agreed. One question at a time, scaled to spike, bounded or architectural work. Writes `docs/specs/`. |
| `writing-plans` | Turns an approved spec into bite-sized tasks, each with a failing test, implementation and commit. Writes `docs/plans/`. |
| `executing-plans` | Runs a plan with one fresh subagent per task and a reviewer gate after each. Progress ledger survives compaction. |
| `verification-before-completion` | No "done", "fixed" or "passing" without fresh command output as evidence. |
| `compound-learnings` | Captures non-obvious fixes as short docs in `docs/solutions/` with validated frontmatter, and reads them back before planning. |

**Bigger scope**

| Skill | What it does |
|---|---|
| `milestone-planning` | Multi-week or greenfield work: roadmap, short STATE digest, phased PLAN files with wave scheduling for parallel subagents, deviation rules. |
| `jump-start` | A whole project from one prompt. See the next section. |

**Engineering**

| Skill | What it does |
|---|---|
| `tdd-workflow` | Strict red, green, refactor with runner detection, a "fails for the right reason" gate, checkpoint commits and an evidence report. |
| `verification-loop` | Build, types, lint, tests, secrets scan and diff review for Node, Python and Flutter projects, with a pass or fail report. |

**Stack patterns**

| Skill | What it does |
|---|---|
| `react-patterns` | React 18/19 and Next.js App Router: hooks discipline, composition, server and client boundaries, data fetching, measured performance work. |
| `python-patterns` | Modern Python: typing, dataclasses and pydantic at boundaries, pathlib, context managers, async basics, uv, ruff and pytest layout. |
| `flutter-patterns` | Flutter and Dart 3: widget composition, state management choice, immutability, async and streams, Firebase usage, widget and integration tests. |

## Jump-start and brew-idea

```
/opm:jump-start my-app A field-sales app for our reps: visit planning, GPS check-in, order capture synced to our ERP, manager dashboard on web. Android first, offline capable.
```

Jump-start parses the brief, brainstorms only the gaps that would change the
architecture, and publishes a design artifact with flows, wireframes, the data
model and the stack. After you approve it, it plans the milestone, builds it
wave by wave with parallel subagents, runs the reviewers and the verification
loop, then starts the app and hands you a URL or launches it on a device.

For the build to run unattended, switch Claude Code to auto mode with
Shift+Tab when it asks. OPM never changes your permission mode itself.

```
/opm:brew-idea A field-sales app for our reps: visit planning, GPS check-in, order capture synced to the ERP.
```

Brew-idea is the step before that, when you have an idea but not a design. Run
it inside the project and it reads the code if there is any. One workflow runs
a scout, four angle agents that propose and then rebut each other, and a judge
that marks every feature keep, improve, add or cut with the reason and who
argued for it. You get a spec and a plain-language page to approve. Needs the
Workflow tool.

## Agents

All 5 subagents. Claude dispatches them on its own when a task matches, or
you can ask for one by name.

| Agent | Model | Use it for |
|---|---|---|
| `planner` | opus | Turning an agreed spec into an implementation plan, then handing off to `writing-plans` |
| `code-reviewer` | sonnet | Diff review with a confidence gate, reviewer lenses chosen by risk, and an explicit false-positive list |
| `typescript-reviewer` | sonnet | TypeScript and Node specifics: types, async pitfalls, tsconfig selection, merge readiness |
| `security-reviewer` | sonnet | OWASP checks, dependency audits for npm, Python and Dart, Firebase rules review |
| `silent-failure-hunter` | sonnet | Swallowed errors, empty catches, misleading fallbacks, with per-language grep patterns |

## Hooks

All 6 hooks. Dependency-free Node scripts that never call a model or the
network, never throw, and exit silently on internal error.

| Event | Script | Effect |
|---|---|---|
| SessionStart | `session-start.js` | Injects the `using-opm` skill as context on startup, `/clear` and compaction |
| PreToolUse on Bash | `block-no-verify.js` | Denies `git commit --no-verify`, `HUSKY=0` and other hook bypasses |
| PreToolUse on Edit/Write | `config-protection.js` | Asks before editing lint, format, typecheck or `.husky` config files |
| PostToolUse on Edit/Write | `post-edit-accumulator.js` | Records edited files per session for the Stop hooks |
| Stop | `stop-format-typecheck.js` | Formats edited files, runs tsc, ruff or dart on their project, blocks on type errors |
| Stop | `check-console-log.js` | Warns about leftover `console.log`, `print` or `debugPrint` in edited files |

Set `OPM_HOOKS_DISABLED=1` to turn all of them off. Per-hook switches are
`OPM_ALLOW_CONFIG_EDITS`, `OPM_SKIP_FORMAT` and `OPM_SKIP_TYPECHECK`; see
`hooks/README.md`.

## Layout

```
.claude-plugin/   plugin.json, marketplace.json
agents/           5 subagents
skills/           14 skills (SKILL.md plus templates/scripts where needed)
hooks/            hooks.json and 6 dependency-free Node scripts
rules/            copied into <repo>/.claude/rules/opm/ by the installer
bin/              the npx installer
scripts/          install-rules.sh, dev-server.sh
tests/            node --test tests/*.test.js
docs/             design notes and the source review
```

## Contributing

- Skills: `name` equals the directory, description in third person with "Use when" triggers, body under 400 lines, no first person.
- Agents: frontmatter `name`, `description`, `tools`, `model`; under 250 lines.
- Hooks: builtin Node only, never throw, exit 0 on internal error, add a test.
- Run `node --test tests/*.test.js` and `claude plugin validate .` before opening a PR.

Adapted material is credited in `THIRD_PARTY_NOTICES.md`.
