---
phase: 02-person-in-the-loop
plan: 05
requires:
  - { phase: 02-person-in-the-loop, provides: "references/ split and ceiling (02-01), review queue (02-02), review-pack.js (02-03), cadence and secret gate (02-04)" }
provides:
  - "one 'What stops a run' list, word for word in jump-start references/build-and-run.md and milestone-planning references/executing-a-phase.md: the four stop conditions (exposed secret under 2), checkpoint:human-action, the review-cadence pause"
  - "unattended runs: human-verify goes to REVIEW-QUEUE.md; checkpoint:decision and deviation rule 4 are ruled and logged, and rule 4 is also queued for a person"
  - "cadence asked at milestone Start only when none is logged; no logged cadence means after each phase"
  - "a subagent that finds an exposed secret returns a BLOCKING checkpoint; running plans finish, nothing new starts"
  - "review-pack.js: core.quotePath=false, file names from diff --git headers, +++ read only before the first @@"
  - "milestone-planning Anti-patterns and ISSUES.md subsection, jump-start Red flags moved verbatim to references; read triggers widened"
affects: [03-evidence-quality, 04-evals]
key_files: [skills/jump-start/SKILL.md, skills/jump-start/references/build-and-run.md, skills/milestone-planning/SKILL.md, skills/milestone-planning/references/executing-a-phase.md, skills/executing-plans/references/rulings-and-models.md, skills/verification-before-completion/references/full-loop.md, agents/security-reviewer.md, skills/milestone-planning/scripts/review-pack.js, tests/human-gates.test.js, tests/review-pack.test.js, docs/why-opm.md]
key_decisions:
  - "Orchestrator ruling: a review-cadence pause is a stop for reading, not a question; 'no questions' means none outside the stop list"
  - "Architecture changes in unattended runs are ruled, logged and queued rather than stopping the run; attended runs still stop and ask"
  - "The stop list is duplicated word for word in both references and a test checks the items are equal"
  - "security-reviewer cannot edit, so it returns the BLOCKING checkpoint with the removal step"
issues_created: [ISS-020]
completed: 2026-11-03
---

# 02-05: Phase 2 review fixes

**jump-start, milestone-planning and executing-plans now give the same answer to "what stops this run"; the cadence is asked once with a stated default; review-pack.js attributes lines to quoted and non-ASCII paths; both cores are back near 2300 tokens.**

## Task commits

1. Make room in both cores and widen reference read triggers - `2c1f2fb`
2. One list of what stops a run; cadence asked once - `ffc160d`
3. review-pack attributes lines to quoted and non-ASCII paths - `dac89be`
4. Rule and queue architecture changes in unattended runs; full gate subagent path (orchestrator, test-first) - `1e637c1`

## Deviations from plan

### Auto-fixed
- **[Rule 3]** Anti-patterns alone left milestone-planning at 2316; the ISSUES.md subsection moved too.
- **[Rule 2]** The plan's `password = "..."` fixture hit only the auth regex; the secrets regex now matches password assignments.
- **[Rule 1]** Stop-list section helper matched its own heading; fixed before GREEN.
- **[Rule 2, orchestrator]** Deviation rule 4 contradicted the stop list in unattended runs, and the full gate told a subagent to stop; both fixed in 1e637c1 with failing tests first.

### Deferred to ISSUES.md
- ISS-020.

## Verification

- RED watched for Tasks 2, 3 and the orchestrator fix. `npm test` 293 passed, 0 failed; `npm run tokens` exit 0, always-on 2526, milestone-planning 2295, jump-start 2298; `grep -rn "the one case" skills agents` empty.

## Next-phase readiness

- About 100 tokens of headroom per core; Phase 3 rules go in references/.
