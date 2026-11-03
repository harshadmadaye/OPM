---
phase: 04-prove-and-release
plan: 04
requires:
  - { phase: 01-orchestration-reliability, provides: "ledger line formats: complete, fix round, parked, Ruling, no commits, escalated" }
  - { phase: 02-person-in-the-loop, provides: "REVIEW-QUEUE.md rows with a Status column" }
  - { phase: 03-evidence-quality, provides: "findings table Severity / Found / Fixed / Parked / Dismissed" }
provides:
  - "npx opm-core status --report [repo]: eight outcome lines from ledgers, ISSUES.md, REVIEW-QUEUE.md and REVIEW-PACK.md, offline and read-only"
  - "ledger line `Finding: <SEVERITY> <fixed|parked|dismissed> - <summary>` (fix-loop.md, finishing.md step 3)"
  - "countLedgerOutcomes, countMilestoneOutcomes, formatReport in bin/lib/ledger.mjs"
affects: [04-05]
key_files: [bin/lib/ledger.mjs, bin/status.js, tests/ledger.test.js, tests/status.test.js, skills/executing-plans/references/fix-loop.md, skills/executing-plans/references/finishing.md]
key_decisions:
  - "An ISSUES.md entry is closed only when struck through (`- ~~ISS-NNN: text~~`); words like 'fixed' in open entries do not count"
  - "Findings = ledger `Finding:` lines plus phase REVIEW-PACK.md tables; neither present prints 'not recorded'"
  - "Milestone files are read through realpath and isInside, so a symlink out of the repo is never followed"
  - "No git calls: none of the eight fields needs git"
  - "bin/status.js gained a require.main runner so `node bin/status.js` works directly"
issues_created: [ISS-024, ISS-025, ISS-026, ISS-027]
completed: 2026-11-03
---

# 04-04: status --report

**`npx opm-core status --report [repo]` prints tasks done, reviewer findings by severity and outcome, fix rounds, items parked, human checks pending, issues open and closed, rulings made and tasks escalated for no commits; plain `status` is unchanged.**

## Task commits

1. Count outcomes from ledgers and milestone files - `a46d393`
2. status --report prints the project outcome report - `1887bb6`

(Cherry-picked from the worktree branch, where they were e22c594 and ff59bd9.)

## Deviations from plan

### Auto-fixed
- **[Rule 3]** bin/status.js had no entry point, so the plan's verify printed nothing; added a `require.main` runner.
- **[Noise]** The installed hook reformatted the working files (+758/-254); discarded, only real changes committed.

### Deferred to ISSUES.md
- ISS-024 to ISS-027. Closes ISS-009, ISS-013, ISS-022. Orchestrator struck through the issues already fixed so the report counts them.

## Verification

- RED watched for both tasks. Orchestrator re-ran after merge: `npm test` 320 passed, 0 failed  env: unit
- `node bin/status.js --report .` prints all eight lines for this repo; `node bin/status.js .` unchanged  env: unit
