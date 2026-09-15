# OPM

First Economy's private Claude Code plugin. One opinionated engineering loop, a
handful of sharp reviewers, stack patterns for the things we actually build,
and five light safety hooks. Nothing phones home, nothing runs a model behind
your back, and the always-on context cost is under ten kilobytes, roughly two thousand tokens.

## Install

```
/plugin marketplace add fe-techTeam/OPM
/plugin install opm@opm
```

The repository is private inside the `fe-techTeam` GitHub organisation. Before
installing, make sure you are a member of the organisation with read access to
this repo, and that git can authenticate to GitHub on your machine (for example
`gh auth login`), because Claude Code clones the marketplace with your git
credentials.

Then, once per repository, copy the rules you want into the repo so they load
automatically (plugins cannot ship rules themselves):

```
sh ~/.claude/plugins/cache/opm/opm/<version>/scripts/install-rules.sh --langs typescript,react <path-to-repo>
```

Or clone this repo and run `scripts/install-rules.sh` from it. Rules land in
`<repo>/.claude/rules/opm/`. Keep `common/` small: it is loaded in every session.

## Skills

All 13 skills, invoked as `/opm:<name>` or picked up automatically when their
description matches the task.

**The loop**

| Skill | What it does |
|---|---|
| `using-opm` | Injected at session start. Tells Claude to check for an applicable skill before any other action and maps the workflow below. |
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

## Jump-start: a whole project from one prompt

```
/opm:jump-start my-new-project A field-sales app for our reps: visit planning, check-in with GPS, order capture that syncs to our ERP, manager dashboard on web. Android first, offline capable.
```

The skill parses the name and brief, brainstorms only for gaps that would change
the architecture, and publishes a design artifact: flows, wireframes, data
model, architecture, stack. It asks for approval after every revision. Once you
approve and confirm the build, it plans the milestone, builds it wave by wave
with parallel subagents under `opm:executing-plans` and `opm:tdd-workflow`,
runs reviewers and the verification loop, then starts the app and hands you
the local URL, or launches it on a connected device or simulator.

For the build to run unattended, switch Claude Code to auto mode (Shift+Tab)
when the skill asks, or start `claude --permission-mode bypassPermissions`
inside the project in a sandbox. OPM does not change permissions itself. The
detached process is managed by `scripts/dev-server.sh` (start, stop, status).

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
skills/           13 skills (SKILL.md plus templates/scripts where needed)
hooks/            hooks.json and 6 dependency-free Node scripts
rules/            copy into <repo>/.claude/rules/ with scripts/install-rules.sh
scripts/          install-rules.sh, dev-server.sh
tests/            node --test tests/
docs/             design notes and the source review
```

## Contributing

- Skills: `name` equals the directory, description in third person with "Use when" triggers, body under 400 lines, no first person.
- Agents: frontmatter `name`, `description`, `tools`, `model`; under 250 lines.
- Hooks: builtin Node only, never throw, exit 0 on internal error, add a test.
- Run `node --test tests/` and `claude plugin validate .` before opening a PR.

Adapted material is credited in `THIRD_PARTY_NOTICES.md`.
