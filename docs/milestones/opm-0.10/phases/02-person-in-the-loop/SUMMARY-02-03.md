---
phase: 02-person-in-the-loop
plan: 03
requires:
  - { phase: 02-person-in-the-loop, provides: "execution detail in references/ and the 2400-token ceiling (02-01)" }
  - { phase: 01-orchestration-reliability, provides: "the hand-written Phase 1 REVIEW-PACK.md as the target shape" }
provides:
  - "skills/milestone-planning/scripts/review-pack.js (zero-dependency CommonJS; <base>..<head> [--max N]; exports rank, scoreCommit, validateRange, CATEGORIES)"
  - skills/milestone-planning/templates/review-pack.md (ranked items, questions, findings table, what went differently, 20 to 30 minute target)
  - "phase close writes REVIEW-PACK.md in milestone-planning and jump-start; with cadence after each phase, wait for the developer to say they read it"
  - tests/review-pack.test.js (8 tests, temp git repo)
affects: [02-04, 04-evals]
key_files: [skills/milestone-planning/scripts/review-pack.js, tests/review-pack.test.js, skills/milestone-planning/templates/review-pack.md, skills/milestone-planning/SKILL.md, skills/milestone-planning/references/executing-a-phase.md, skills/jump-start/references/build-and-run.md]
key_decisions:
  - "Eight named regex categories over changed paths and added lines; zero-score commits are not listed, so a quiet range says so instead of padding"
  - "Added lines in test and docs files are ignored and test/docs-only commits score at 25%, so prose mentioning risky words does not rank"
  - "Git via execFileSync with an argument array; the range matches a strict pattern and a side starting with '-' is rejected"
  - "hooks/scripts/*.js counts as external calls, since hook scripts run tools on users' machines every turn"
  - "Template tells the orchestrator to swap in riskier changes the script cannot see (orchestrator addition)"
issues_created: [ISS-014, ISS-015]
completed: 2026-11-03
---

# 02-03: Review pack at every phase close

**A zero-dependency script ranks a phase's commits by eight risk categories and prints the five riskiest with `git show` ranges, files and categories; phase close in milestone-planning and jump-start writes REVIEW-PACK.md from a template matching the Phase 1 pack.**

## Accomplishments

- review-pack.js reads each commit with `git show --raw --patch`, scores auth, permissions, data deletion, migrations, payments, sync, secrets and external calls, and prints a Markdown skeleton with a "Questions:" placeholder per item.
- Template and phase-close step (one clause in the SKILL.md core, procedure in executing-a-phase.md, one item in build-and-run.md).

## Task commits

1. Rank a phase's commits by risk for the review pack - `304909d`
2. Write a review pack at every phase close - `eeddfca`
3. Template note on changes the script cannot see - orchestrator, in the plan's metadata commit

## Deviations from plan

### Auto-fixed
- **[Rule 1]** `--name-status` suppressed the patch, so added lines were never scanned; switched to `--raw --patch`.
- **[Rule 1]** Prose and test files ranked high; test/docs scored by path only, "session" dropped from the auth line regex.
- **[Rule 2]** Hook commits matched no category; `hooks/scripts/*.js` and process-spawn calls now count as external calls.

### Deferred to ISSUES.md
- ISS-014, ISS-015; the loose wording-test proposal is folded into ISS-008.

## Verification

- RED: "Cannot find module" before the script existed. Orchestrator re-ran: `npm test` 275 passed, 0 failed; bad ranges `--output=x..HEAD` and `HEAD;ls` exit 1 with a clear message.
- On 699e9cc..94773ec the script lists the three hook commits; Phase 1's skill-text changes do not rank (hence the template note).

## Next-phase readiness

- milestone-planning core at 2340 of 2400.
