# OPM 0.7-0.9 State

**Goal:** a measured, CI-gated, low-token OPM where status, safety and cost checks run as code instead of model turns.
**Current focus:** Phase 2 - Trim and steady the core

## Position

Phase: 2 of 4 (Trim and steady the core)
Plan: 0 of 7 in this phase
Status: Ready to execute
Last activity: 2026-10-05 - Phase 1 complete (0.7.0 on feat/0.7.0-gate-and-measure); Phase 2 planned
Progress: 4 / 11 planned plans

## Recent decisions

- 01-01: ceilings = measured + 10% rounded up to 50: plugin 2,850 (now 2,541), rules/common 1,550 (1,401).
- 01-02: push-via-api.sh untracked in place (writing ~/.opm/bin was denied); ISS-001.
- 01-03: CI test step uses `npm test --script-shell=bash` because cmd.exe does not expand tests/*.test.js.
- 02: brew-idea already has disable-model-invocation: true, so feature 14 needs no change.
- milestone: one PR per phase, stacked on the brew docs branch.

## Open blockers

- Pushing needs the personal `harshadmadaye` gh account; only dev-firsteconomy and harshadmadaye-fe are signed in. Unblock: `gh auth login` as harshadmadaye.
- Phase 3 mods need Claude Code >= 2.1.287; this machine runs 2.1.273. Unblock: update Claude Code, or run a pinned CLI through npx for `claude plugin test`.

## Deferred issues

3 open - see ISSUES.md. Most relevant to the next phase:
- ISS-002: Windows CI parts unverified until the first real run.

## Session continuity

Last session: 2026-10-05
Stopped at: Phase 2 plans written
Next: execute Phase 2 wave 1 (02-01, 02-03, 02-04, 02-05 in parallel worktrees)

Notes for executors: subagents cannot write SUMMARY files (harness guard); the orchestrator writes them from the subagent's report. OPM's block-no-verify hook blocks Bash heredocs whose text mentions git commit with the hook-skip flag; use the Write tool for such files (fix planned in 02-05).
