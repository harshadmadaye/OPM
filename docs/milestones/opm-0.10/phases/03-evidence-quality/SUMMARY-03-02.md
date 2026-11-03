---
phase: 03-evidence-quality
plan: 02
requires:
  - { phase: 03-evidence-quality, provides: "Env column in jump-start final-report.md (03-01)" }
  - { phase: 02-person-in-the-loop, provides: "review-pack findings table (Severity / Found / Fixed / Parked / Dismissed)" }
provides:
  - "Confidence: NN% next to File: path:line in every reviewer agent's finding format (code-reviewer, security-reviewer, silent-failure-hunter, typescript-reviewer)"
  - "each agent: a finding that cannot cite a line is dropped or raised as a question; code-reviewer: below 80% is not reported"
  - "executing-plans reviewer prompt asks for File: path:line and Confidence per finding"
  - "finishing.md step 3 'Count findings': Severity / Found / Fixed / Parked / Dismissed, each dismissal with its reason"
  - "jump-start final-report.md: one 'Review findings' table replaces the two free-text review rows"
affects: [04-04, 04-evals]
key_files: [tests/reviewer-calibration.test.js, agents/code-reviewer.md, agents/security-reviewer.md, agents/silent-failure-hunter.md, agents/typescript-reviewer.md, skills/executing-plans/references/reviewer.md, skills/executing-plans/references/finishing.md, skills/jump-start/templates/final-report.md]
key_decisions:
  - "Column names copied from review-pack.md so reports and packs read the same"
  - "Agent frontmatter untouched, pinned by a test against git HEAD; always-on stays 2526"
  - "Confidence under 80% means not reported, matching the existing filter"
issues_created: [ISS-022, ISS-023]
completed: 2026-11-03
---

# 03-02: Reviewer calibration

**Every reviewer finding states its confidence and the line it cites, and final reports count findings by severity and by fixed, parked or dismissed, so a reviewer whose findings are mostly dismissed shows up in numbers.**

## Task commits

1. Pin reviewer confidence, cited lines and outcome counts - `d6bcb99`
2. Reviewers state confidence and cited line; reports count findings by outcome - `c3b168a`

## Deviations from plan

### Auto-fixed
- **[Rule 1]** Two test helpers were too strict (prose "NN%" placeholder; table indented under a list item); loosened in the Task 2 commit.

### Deferred to ISSUES.md
- ISS-022 (no ledger line for a finding's outcome; taken into 04-04), ISS-023 (severity names differ between the reviewer prompt and the agents).

## Verification

- Tests: RED watched (7 fail, 4 pass); `npm test` 309 passed, 0 failed  env: unit
- `npm run tokens` exit 0, always-on 2526, unchanged  env: unit
