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

## The loop

| Step | Skill | What it enforces |
|---|---|---|
| 1 | `opm:brainstorming` | No code before the design is agreed. One question at a time. Writes `docs/specs/`. |
| 2 | `opm:writing-plans` | Bite-sized tasks, each with a failing test, implementation and commit. Writes `docs/plans/`. |
| 3 | `opm:executing-plans` | One fresh subagent per task, reviewer gate after each, progress ledger survives compaction. |
| 4 | `opm:verification-before-completion` | No "done" without fresh evidence: test output, build output, a diff. |
| 5 | `opm:compound-learnings` | Non-obvious fixes get a short doc in `docs/solutions/` that future plans read first. |

For multi-week or greenfield scope use `opm:milestone-planning`, which adds a
roadmap, phased plans with wave scheduling, and a short STATE digest.

Supporting skills: `opm:tdd-workflow`, `opm:verification-loop`,
`opm:react-patterns`, `opm:python-patterns`, `opm:flutter-patterns`.
`opm:using-opm` is injected at session start and tells Claude to check for an
applicable skill before acting.

## Agents

| Agent | Use it for |
|---|---|
| `planner` | Turning an agreed spec into an implementation plan |
| `code-reviewer` | Diff review with a confidence gate and an explicit false-positive list |
| `typescript-reviewer` | TS/Node specifics: types, async pitfalls, tsconfig, merge readiness |
| `security-reviewer` | OWASP checks, dependency audits, Firebase rules review |
| `silent-failure-hunter` | Swallowed errors, empty catches, misleading fallbacks |

## Hooks

| Event | Script | Effect |
|---|---|---|
| SessionStart | `session-start.js` | Injects `using-opm` |
| PreToolUse Bash | `block-no-verify.js` | Denies `--no-verify` and hook bypasses |
| PreToolUse Edit/Write | `config-protection.js` | Asks before editing lint/format/tsconfig files |
| PostToolUse Edit/Write | `post-edit-accumulator.js` | Records edited files for the Stop hooks |
| Stop | `stop-format-typecheck.js` | Formats edited files, runs tsc/ruff/dart on their project, blocks on type errors |
| Stop | `check-console-log.js` | Warns about leftover debug output in edited files |

Set `OPM_HOOKS_DISABLED=1` to turn all of them off. See `hooks/README.md` for
per-hook switches.

## Layout

```
.claude-plugin/   plugin.json, marketplace.json
agents/           5 subagents
skills/           12 skills (SKILL.md plus templates/scripts where needed)
hooks/            hooks.json and 6 dependency-free Node scripts
rules/            copy into <repo>/.claude/rules/ with scripts/install-rules.sh
tests/            node --test tests/
docs/             design notes and the source review
```

## Contributing

- Skills: `name` equals the directory, description in third person with "Use when" triggers, body under 400 lines, no first person.
- Agents: frontmatter `name`, `description`, `tools`, `model`; under 250 lines.
- Hooks: builtin Node only, never throw, exit 0 on internal error, add a test.
- Run `node --test tests/` and `claude plugin validate .` before opening a PR.

Adapted material is credited in `THIRD_PARTY_NOTICES.md`.
