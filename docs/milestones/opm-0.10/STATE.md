# OPM 0.10 State

**Goal:** OPM protects the developer's judgment on long runs: human checks stay human, evidence says where it came from, rules are proven by evals.
**Current focus:** Phase 2 - A person in the loop

## Position

Phase: 2 of 4 (A person in the loop)
Plan: 0 of 4 in this phase
Status: Ready to execute
Last activity: 2026-11-03 - Phase 1 closed (4 plans + 2 orchestrator fixes, 261 tests, review pack written); Phase 2 planned (4 plans, 4 waves)
Progress: 4 / 8 plans planned so far (phases 3-4 planned at each phase close)

## Recent decisions

- milestone: review cadence "only at the end" - the developer said on 2026-11-03 to auto-approve and run every next step until ready; review packs are still written at each phase close, not waited on. Expect about 60 more commits before review.
- 01-03: formatters run only when the project opts in (prettier: local bin, config upward, or package.json key; ruff: ruff.toml/.ruff.toml/[tool.ruff]); dart always runs.
- 01-02: shared brief preamble; success with no commits is rerun once, then escalated.
- 01-01: the orchestrator is the only writer of SUMMARY, STATE, PROGRESS and the ledger.
- phase 2: start with ISS-002 (move execution detail to references/, cap at 2400 tokens) before adding rules.

## Open blockers

None.

## Deferred issues

9 open - see ISSUES.md. Most relevant to the next phase:
- ISS-002: milestone-planning and jump-start over the soft cap (02-01 fixes it)
- ISS-008: loose skill-text tests (Phase 4 evals)

## Session continuity

Last session: 2026-11-03
Stopped at: Phase 2 planned, nothing executed
Next: execute PLAN-02-01, then 02-02, 02-03, 02-04 in order
