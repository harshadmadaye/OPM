---
phase: 02-person-in-the-loop
plan: 04
requires:
  - { phase: 02-person-in-the-loop, provides: "execution detail in references/ and the 2400-token ceiling (02-01)" }
provides:
  - "review cadence choice (after each phase, default; only at the end) in jump-start Phase 4 and milestone-planning lifecycle step 1; 'only at the end' shows the expected commit count and is logged as a decision"
  - "expected-commit-count rule in milestone-planning references/executing-a-phase.md (Review cadence)"
  - "exposed secret = blocking checkpoint:human-action raised when found, in rulings-and-models.md, full-loop.md section 5, agents/security-reviewer.md, jump-start Safety and build-and-run.md"
  - tests/human-gates.test.js (8 tests)
affects: [04-evals, 04-status-report]
key_files: [tests/human-gates.test.js, skills/jump-start/SKILL.md, skills/jump-start/references/build-and-run.md, skills/milestone-planning/SKILL.md, skills/milestone-planning/references/executing-a-phase.md, skills/executing-plans/references/rulings-and-models.md, skills/verification-before-completion/references/full-loop.md, agents/security-reviewer.md]
key_decisions:
  - "Cadence is part of the existing Phase 4 confirmation question, not a new one; logged in DECISIONS.md (jump-start) or STATE.md Recent decisions (milestone)"
  - "Commit count = planned tasks + one metadata commit per plan; before plans exist, phases x 3 plans x 4 commits, labelled an estimate"
  - "A secret that reached git history, logs or a client bundle blocks at once as checkpoint:human-action; never waits for a release checklist"
  - "In jump-start the exposed secret is the one named exception to 'no questions' during the build"
  - "security-reviewer marks the finding 'BLOCKING: rotate <what>'"
issues_created: [ISS-016, ISS-017]
completed: 2026-11-03
---

# 02-04: Human gates for cadence and exposed secrets

**The developer picks the review cadence (after each phase by default, or only at the end with the expected commit count logged), and an exposed secret stops the run at once as a blocking human-action checkpoint everywhere OPM handles one.**

## Accomplishments

- jump-start Phase 4 and milestone-planning step 1 offer the cadence; "only at the end" shows "about N commits will land before you review" and is logged.
- The blocking-secret rule is in rulings-and-models.md, full-loop.md section 5, security-reviewer.md ("BLOCKING: rotate <what>"), jump-start Safety and build-and-run.md.

## Task commits

1. Failing tests for cadence and the secret gate - `64cbba5`
2. Review cadence choice - `6932480`
3. Exposed secrets block at once - `4909c2c`

## Deviations from plan

### Auto-fixed
- **[Rule 3 - blocker]** Also edited milestone-planning references/executing-a-phase.md (Review cadence subsection) to keep the core under its ceiling.
- **[Noise]** The installed 0.9.1 Stop hook reformatted review-pack.js and its test after Task 1; restored, nothing committed.

### Deferred to ISSUES.md
- ISS-016, ISS-017; the loose-test proposal is folded into ISS-008; the hook-reformat proposal is already fixed on this branch (44d97ea).

## Verification

- RED watched on A, B, C. Orchestrator re-ran: `npm test` 283 passed, 0 failed; `npm run tokens` exit 0, always-on 2526, milestone-planning 2389, jump-start 2396.

## Next-phase readiness

- Both cores are within 11 and 4 tokens of the 2400 ceiling (ISS-016): Phase 3 rules must go in references/ or replace core text.
