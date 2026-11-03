---
title: "Stop hook reformats a repo that never chose prettier"
date: 2026-11-03
category: tooling
problem_type: tooling_decision
symptoms:
  - "whole file rewritten from single to double quotes after an edit"
  - "git diff shows hundreds of changed lines in a file you changed by ten"
  - "subagent reports a file reformatted by something other than me"
root_cause: "The Stop hook ran npx --no-install prettier whenever the root had a package.json, and npx resolves a global prettier, which formats with its defaults when the project has no prettier config"
severity: medium
tags: [stop-hook, prettier, npx, formatter, hooks]
related: []
component: opm
---

# Stop hook reformats a repo that never chose prettier

## Problem

During the OPM 0.10 Phase 1 run, the installed 0.9.1 Stop hook rewrote `tests/hooks.test.js` and `hooks/scripts/stop-format-typecheck.js` in this repo (about 780 changed lines, quotes only) three times, each time right after an edit. The repo has a package.json, no prettier config and no local prettier. Two subagents and the orchestrator each lost time telling the noise apart from real changes.

## Investigation

1. Suspected a subagent running prettier by hand: no tool call did, and the rewrite also hit files edited only by the orchestrator.
2. Suspected the project's own config: there is none, and the repo's style (single quotes) contradicts prettier's defaults.
3. Timestamps matched the end of a turn that edited the file, which pointed at the Stop hook. `npx --no-install prettier --version` printed 3.9.10: a globally installed prettier.

## Root cause

`checkPrettier` fell back to `npx --no-install prettier` whenever the project root had a package.json. `--no-install` only blocks downloads; npx still resolves a global install, and prettier with no config applies its defaults (double quotes). "Has a package.json" was treated as "uses prettier".

## Fix

Prettier now runs only when the project opts in: a local `node_modules/.bin/prettier`, a prettier config file found from the root upward (as prettier itself looks), or a `prettier` key in package.json. Otherwise the hook reports `prettier: skipped (no prettier config or local prettier)`.

```text
if (!fs.existsSync(path.join(root, 'package.json'))) skip  ->  if (!hasPrettierConfig(root)) skip
```

## Prevention

`tests/hooks.test.js` "prettier runs only when the project opts in to it": a fake npx on PATH logs calls; a bare package.json project must get none. Until a user upgrades past 0.9.1, `OPM_SKIP_FORMAT=1` stops the rewrites, and orchestrators should run `git diff --stat` before each commit.

## References

- Commit / PR: 44d97ea (fix), 2620c8f (project-root rooting)
- Issue: found in 0.10 plan 01-03
- Related learnings:
