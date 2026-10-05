---
phase: 03-first-mod
plan: 01
requires: []
provides:
  - bin/lib/ledger.mjs: pure ES module with parseLedger(text, planText?), parseMilestoneState(text), formatStatus(...), formatResumeLine(...)
  - npx opm-core status (bin/status.js exports findOpenLedger(repoRoot, parser?) and loadParser())
  - SessionStart one-line resume note when a plan ledger is open
affects: [03-02, 03-06]
key_files: [bin/lib/ledger.mjs, bin/status.js, bin/install.js, hooks/scripts/session-start.js, tests/ledger.test.js, tests/status.test.js]
key_decisions:
  - "a malformed or unreadable ledger counts as open so its error reaches the user"
  - "the fix-round line shows only while that task's round is open; otherwise the last ruling"
  - "times are local YYYY-MM-DD HH:MM; any hook failure leaves the context exactly as before"
  - "tasksTotal falls back to the ledger's 'Mode: ... (N tasks)' line when the plan file is gone"
  - "status never reads a plan path that points outside the repo"
issues_created: [ISS-009]
completed: 2026-10-05
---

# 03-01 Summary

One shared ledger parser now feeds the status CLI and the SessionStart resume line, with no extra start-up text when no ledger is open.

## Task commits
- 5bb65a7 feat(03-01): shared ledger parser
- af68ae8 feat(03-01): npx opm-core status and the SessionStart resume line

## Verification
npm test 215 pass on the worktree (223 after merge); npm run tokens unchanged at 2,379; the hook takes about 65 ms; no fs, path, process or import in bin/lib/ledger.mjs.

## Deviations
- tests/token-budget.test.js now runs the hook with cwd set to tests/fixtures, so an open ledger in the repo cannot change the measured text.
- On the first red run, install.js treated "status" as a target and ran the installer once from the test (harmless).
