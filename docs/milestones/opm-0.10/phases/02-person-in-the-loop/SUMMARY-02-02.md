---
phase: 02-person-in-the-loop
plan: 02
requires:
  - { phase: 02-person-in-the-loop, provides: "execution detail in references/ and the 2400-token ceiling (02-01)" }
provides:
  - skills/milestone-planning/templates/review-queue.md (REVIEW-QUEUE.md table and rules)
  - "routing: in unattended runs a checkpoint:human-verify becomes a pending row, never passed by an agent"
  - "STATE template: 'complete, N human checks pending'"
  - "final reports (jump-start final-report.md, executing-plans finishing.md) lead with 'Human checks pending'"
  - tests/review-queue.test.js (5 tests)
affects: [02-04, 04-evals, 04-status-report]
key_files: [tests/review-queue.test.js, skills/milestone-planning/templates/review-queue.md, skills/milestone-planning/templates/state.md, skills/milestone-planning/SKILL.md, skills/milestone-planning/references/executing-a-phase.md, skills/jump-start/references/build-and-run.md, skills/jump-start/templates/final-report.md, skills/executing-plans/references/finishing.md]
key_decisions:
  - "The orchestrator appends rows; only the developer edits Status"
  - "A queued check does not block the next plan unless a later plan depends on what it verifies"
  - "A missing queue file means no pending checks, so old milestones are unaffected"
  - "finishing.md gets a step 0 so existing step numbers stay"
issues_created: [ISS-013]
completed: 2026-11-03
---

# 02-02: Review queue for human checks

**In unattended runs a checkpoint:human-verify is queued in REVIEW-QUEUE.md with its evidence and the run continues; STATE shows "complete, N human checks pending" and final reports list pending checks first.**

## Accomplishments

- Review-queue template: ID, Plan, What to check, How to check, Evidence, Status, Checked by; only a person sets passed or failed.
- Routing: one sentence in milestone-planning "Checkpoint types", detail in executing-a-phase.md "Unattended runs" and build-and-run.md.
- STATE template shows the pending count; both final reports open with "Human checks pending".

## Task commits

1. Failing tests for the review queue - `de54482`
2. REVIEW-QUEUE.md template and routing - `7d04a82`

## Deviations from plan

None. Deferred: ISS-013; the proposed "no mechanical check that only a person edits a row" is folded into ISS-008 (Phase 4 evals).

## Verification

- RED watched on A to E. Orchestrator re-ran: `npm test` 267 passed, 0 failed; `npm run tokens` exit 0, always-on 2526, milestone-planning 2334, jump-start 2295.

## Next-phase readiness

- milestone-planning core has about 66 tokens left under its ceiling; 02-03 and 02-04 rules go in references.
