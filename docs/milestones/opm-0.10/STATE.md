# OPM 0.10 State

**Goal:** OPM protects the developer's judgment on long runs: human checks stay human, evidence says where it came from, rules are proven by evals.
**Current focus:** Phase 3 - Evidence quality

## Position

Phase: 3 of 4 (Evidence quality)
Plan: 0 of 2 in this phase
Status: Ready to execute
Last activity: 2026-11-03 - Phase 2 closed (5 plans incl. review fixes, 293 tests, review pack written); Phase 3 planned (2 plans, 2 waves)
Progress: 9 / 11 plans planned so far (Phase 4 planned at Phase 3 close)

## Recent decisions

- milestone: review cadence "only at the end" (developer, 2026-11-03: auto-approve every next step); packs are written at each phase close, not waited on.
- 02-05: a run stops only for the four stop conditions (exposed secret under 2), human-action checkpoints, and the cadence pause; architecture changes in unattended runs are ruled, logged and queued.
- 02-02: in unattended runs human-verify checkpoints go to REVIEW-QUEUE.md; only a person sets passed.
- 02-01: milestone-planning and jump-start cores capped at 2400 tokens; detail lives in references/.
- 01-03: formatters run only when the project opts in (prettier, ruff); dart always runs.

## Open blockers

None.

## Deferred issues

20 open - see ISSUES.md. Most relevant to the next phase:
- ISS-016: about 100 tokens of headroom per core; Phase 3 rules go in references/
- ISS-008: loose skill-text tests (Phase 4 evals)

## Session continuity

Last session: 2026-11-03
Stopped at: Phase 2 closed, Phase 3 planned
Next: execute PLAN-03-01, then PLAN-03-02
