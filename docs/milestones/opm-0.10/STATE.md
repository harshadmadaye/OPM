# OPM 0.10 State

**Goal:** OPM protects the developer's judgment on long runs: human checks stay human, evidence says where it came from, rules are proven by evals.
**Current focus:** Phase 4 - Prove OPM works, release 0.10.0

## Position

Phase: 4 of 4 (Prove OPM works, release 0.10.0)
Plan: 2 of 5 done, 2 deferred, 1 to go (04-05 release)
Status: Executing 04-05
Last activity: 2026-11-03 - 04-01 and 04-04 merged (349 tests); developer chose not to run the paid evals (04-02, 04-03 deferred)
Progress: 13 / 16 plans done, 2 deferred

## Recent decisions

- 04: no paid eval runs for 0.10.0 (developer, 2026-11-03: option 1); evals ship authored and gated; release notes say they are not run.
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
Stopped at: paid eval run stopped after one smoke case ($0.44)
Next: execute PLAN-04-05 (local release, nothing pushed)
