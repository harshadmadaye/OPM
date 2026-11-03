# OPM 0.10 State

**Goal:** OPM protects the developer's judgment on long runs: human checks stay human, evidence says where it came from, rules are proven by evals.
**Current focus:** Phase 4 - Prove OPM works, release 0.10.0

## Position

Phase: 4 of 4 (Prove OPM works, release 0.10.0)
Plan: 0 of 5 in this phase
Status: Executing (wave 1: 04-01, 04-04); Phase 3 review pack pending its code review
Last activity: 2026-11-03 - Phase 3 complete (2 plans, 309 tests); Phase 4 planned (5 plans, 4 waves)
Progress: 11 / 16 plans

## Recent decisions

- milestone: review cadence "only at the end" (developer, 2026-11-03: auto-approve every next step); packs are written at each phase close, not waited on.
- 02-05: a run stops only for the four stop conditions (exposed secret under 2), human-action checkpoints, and the cadence pause; architecture changes in unattended runs are ruled, logged and queued.
- 02-02: in unattended runs human-verify checkpoints go to REVIEW-QUEUE.md; only a person sets passed.
- 02-01: milestone-planning and jump-start cores capped at 2400 tokens; detail lives in references/.
- 01-03: formatters run only when the project opts in (prettier, ruff); dart always runs.

## Open blockers

None.

## Deferred issues

23 open - see ISSUES.md. Most relevant to the next phase:
- ISS-016: about 100 tokens of headroom per core; Phase 3 rules go in references/
- ISS-008: loose skill-text tests (Phase 4 evals)

## Session continuity

Last session: 2026-11-03
Stopped at: Phase 3 complete; Phase 4 wave 1 dispatched
Next: merge 04-01 and 04-04, write Phase 3 review pack, run 04-02 (paid, cap $5)
