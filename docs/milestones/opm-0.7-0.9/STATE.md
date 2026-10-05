# OPM 0.7-0.9 State

**Goal:** a measured, CI-gated, low-token OPM where status, safety and cost checks run as code instead of model turns.
**Current focus:** Milestone complete - awaiting review and merge of PRs #1-#5

## Position

Phase: 4 of 4 (complete)
Plan: 5 of 5
Status: Milestone complete
Last activity: 2026-10-05 - Phase 4 complete (0.9.0 on feat/0.9.0-evidence); CI green on PRs #2-#5
Progress: 22 / 22 plans

## Recent decisions

- 04-02: dedupe via OPM_MOD_ACTIVE = session id; settings-hook scripts step aside only for that session.
- 04-03: trigger eval is manual (`npm run eval:triggers -- --yes`, about $0.02 a prompt), never in npm test or CI.
- 04-04: README opening makes only measured, linked claims; listing kit prepared, not submitted.
- 04-05: ceiling stays 2,650 (measured 2,379).
- milestone: stacked PRs #1 (docs) -> #2 (0.7.0) -> #3 (0.7.1) -> #4 (0.8.0) -> #5 (0.9.0).

## Open blockers

- Mod features unproven in a live session: update Claude Code to 2.1.287+ and start it once with network access so the cached mods switch refreshes.
- npm publish and marketplace submission are the maintainer's steps.

## Deferred issues

20 logged - see ISSUES.md (ISS-002 and ISS-006 resolved, ISS-003 pending a first scheduled run). Start the next milestone from ISS-011, ISS-014, ISS-016 and ISS-019.

## Session continuity

Last session: 2026-10-05
Stopped at: milestone closed
Next: review and merge the PR stack bottom-up (#1 first), then plan the next milestone from ISSUES.md.
