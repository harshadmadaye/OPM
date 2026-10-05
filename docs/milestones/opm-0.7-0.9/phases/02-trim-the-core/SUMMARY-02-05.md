---
phase: 02-trim-the-core
plan: 05
requires: []
provides:
  - Stop hook "OPM checks:" systemMessage per check (ran, skipped and why, tool missing), early stop at 75% of budget, tsc still blocks
  - block-no-verify that inspects only real git invocations and drops heredoc bodies
  - config-protection asks before a .git/config hooksPath edit
  - docs/threat-model.md (says "not a security boundary")
affects: [02-07, 04-evidence]
key_files: [hooks/scripts/stop-format-typecheck.js, hooks/scripts/block-no-verify.js, hooks/scripts/config-protection.js, tests/hooks.test.js, docs/threat-model.md]
key_decisions:
  - "EARLY_STOP_RATIO = 0.75; OPM_STOP_BUDGET_MS may only lower the 60s budget (for tests)"
  - "git counts only in command position or at the start of a substitution; heredoc bodies dropped before parsing"
  - "bash -c, git aliases and GIT_CONFIG_* are out of scope (no arms race)"
issues_created: [ISS-007]
completed: 2026-10-05
---

# 02-05 Summary

The hooks now report honestly: the Stop hook says what it checked, skipped or could not run, and the bypass guard blocks the known evasions without blocking text that only mentions them.

## Task commits
- c893382 feat(02-05): Stop hook reports per language and warns near its budget
- f1acb66 feat(02-05): Known-evasion coverage, look-alike passes, threat model

## Blocked
The short -n flag and clusters; the long hook-skip flag or its prefixes on commit/push/merge/cherry-pick/rebase/am; husky-disabling environment assignments (including export); git -c core.hooksPath; git config core.hooksPath writes; the flag on the git line of a heredoc commit.

## Allowed look-alikes
The 2026-10-05 heredoc plan-file case, commit messages mentioning the flags, echo/printf/grep arguments, an echoed husky assignment, read-only git config --get core.hooksPath.

## Deviations
- The Stop hook now prints a systemMessage whenever a JS/TS, Python or Dart file was edited; one existing test was updated accordingly.
- Husky detection was matching anywhere in the text; now only real assignments.
- Until 0.7.1 is installed, the session's live hook is the 0.6.1 copy, which still blocks heredocs whose text mentions these flags (it blocked the orchestrator twice on 2026-10-05).
