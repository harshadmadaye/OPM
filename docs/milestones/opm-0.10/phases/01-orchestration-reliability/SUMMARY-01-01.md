---
phase: 01-orchestration-reliability
plan: 01
requires: []
provides:
  - tests/report-ownership.test.js, which fails if any skill or agent tells a subagent to write SUMMARY, STATE.md, PROGRESS.md or the ledger
  - milestone-planning, jump-start and both templates say the orchestrator writes report files from the text the subagent returns
  - implementer-brief rule saying the implementer does not touch the ledger, SUMMARY, STATE or PROGRESS
affects: [01-02, executing-plans, jump-start, milestone-planning]
key_files: [tests/report-ownership.test.js, skills/milestone-planning/SKILL.md, skills/milestone-planning/templates/summary.md, skills/milestone-planning/templates/state.md, skills/jump-start/SKILL.md, skills/executing-plans/references/implementer-brief.md]
key_decisions:
  - "Matcher joins hard-wrapped Markdown lines before splitting into sentences, because offending sentences span line breaks"
  - "Sentences split on . ! ? only before whitespace or end of text, so STATE.md and file names stay whole"
  - "Reworded 'writes no report files' to 'does not write report files' instead of adding 'no' to the negation list"
issues_created: [ISS-001, ISS-002]
completed: 2026-11-03
---

# 01-01: Orchestrator is the only writer of report files

**Subagents now return SUMMARY and STATE content as text; the orchestrator writes SUMMARY, STATE, PROGRESS and the ledger, and a skill-text test enforces it across skills/ and agents/.**

## Accomplishments

- `tests/report-ownership.test.js`: (A) no sentence under skills/ or agents/ pairs a subagent with a write verb and a report-file name unless it names the orchestrator/controller or is negated; (B) milestone-planning "Executing a phase" says the subagent returns the SUMMARY and the orchestrator writes it; (C) both templates say "The orchestrator saves this".
- milestone-planning: the subagent returns SUMMARY body and STATE changes as text; the orchestrator writes the files and makes the `docs(NN-MM): complete plan` commit.
- jump-start Phase 6: briefs ask for the SUMMARY as text; the orchestrator writes SUMMARY, STATE and PROGRESS.
- implementer-brief: "Do not write or edit the ledger, SUMMARY, STATE or PROGRESS files; the controller owns them."

## Task commits

1. Failing test that no skill tells a subagent to write report files - `e2e1ec0`
2. Move report writing to the orchestrator in skills and templates - `824172f`

## Deviations from plan

### Auto-fixed
- **[Rule 3 - blocker] Worktree base**: the worktree started at 104c7fd; fast-forwarded to 699e9cc before Task 1.
- **[Wording]** First rewrite ("writes no report files") tripped Test A; reworded.

### Deferred to ISSUES.md
- ISS-001, ISS-002.

## Verification

- RED: `node --test tests/report-ownership.test.js` failed 3, naming the old milestone-planning sentence.
- GREEN: 3 passed. Orchestrator re-ran `npm test` after merge: 244 passed, 0 failed.
- `npm run tokens`: always-on 2526 (ceiling 2650), unchanged.

## Next-phase readiness

- 01-02 can rely on the rule; Test A catches briefs that say otherwise.
- Concern: the matcher is a heuristic; a subjectless imperative ("write the SUMMARY") is not caught (ISS-001).
