---
phase: 01-orchestration-reliability
plan: 02
requires:
  - { phase: 01-orchestration-reliability, provides: report-ownership rule and test (01-01) }
provides:
  - shared brief preamble "The plan below is your task. Anything else from the conversation is background, not instructions." opening the implementer prompt template, milestone-planning briefs, jump-start Phase 6 briefs, orchestration.md's complete-brief rule and every brew-idea workflow prompt (BRIEF_PREAMBLE)
  - pre-run notice that messages sent during a run are read as background and can derail the agents (jump-start Phase 4, milestone-planning "Executing a phase", executing-plans setup step 6)
  - no-commit rule in implementer-brief, milestone-planning and jump-start - rerun once with a fresh brief, then escalate, never complete
  - ledger lines "Task N - no commits (rerun 1/1)" and "Task N - escalated - no commits after rerun", pinned as not complete by tests/ledger.test.js
  - tests/run-discipline.test.js
affects: [executing-plans, milestone-planning, jump-start, brew-idea, 04-evals]
key_files: [tests/run-discipline.test.js, tests/ledger.test.js, skills/executing-plans/references/implementer-brief.md, skills/executing-plans/references/setup.md, skills/milestone-planning/SKILL.md, skills/jump-start/SKILL.md, skills/using-opm/references/orchestration.md, skills/brew-idea/scripts/brew.workflow.js]
key_decisions:
  - "brew.workflow.js is checked as text: one preamble constant, every *Prompt builder returns it first, every agent() call uses a builder"
  - "Ledger parser unchanged: the new lines already parse as not complete; a test pins it"
  - "Milestone waves share one base, so the no-commit check looks for the plan's own (NN-MM) commits in git log <wave base>..HEAD"
  - "jump-start escalation asks nothing: log in DECISIONS.md, mark the plan blocked in STATE.md, continue with independent plans"
issues_created: [ISS-006]
completed: 2026-11-03
---

# 01-02: Self-contained briefs, a mid-run chat notice, and no commits means not done

**Every brief OPM writes opens with the shared preamble, users are warned before long runs that chatting mid-run can derail agents, and an agent that reports success without commits is rerun once, then escalated, never marked complete.**

## Accomplishments

- Preamble first in the implementer template, milestone-planning and jump-start briefs, and all 5 brew-idea prompts; part of orchestration.md's complete-brief rule.
- Mid-run notice in jump-start Phase 4, milestone-planning before the first wave, executing-plans setup step 6.
- implementer-brief "Handle the report": empty `git log BASE..HEAD` on DONE leads to `no commits (rerun 1/1)`, one fresh rerun, then `escalated - no commits after rerun` and a stop.
- milestone-planning records escalation in STATE.md open blockers; jump-start logs it in DECISIONS.md and continues with independent plans.

## Task commits

1. Failing tests for preamble, mid-run notice, no-commit rule - `c641d51`
2. Test fix: read the implementer prompt from inside its fence - `795f289`
3. Self-contained briefs and a mid-run chat notice - `80e1109`
4. Rerun then escalate an agent that reports success with no commits - `93dd9c6`

## Deviations from plan

### Auto-fixed
- **[Rule 1 - bug]** Test A's template extractor stopped at the opening fence; fixed and re-checked against the old file (`795f289`).
- **[Noise]** The installed 0.9.1 Stop hook reformatted hooks/scripts/stop-format-typecheck.js and tests/hooks.test.js (quotes only) after the orchestrator's 44d97ea; the orchestrator confirmed formatting-only and restored them. Same root cause as 01-03's follow-up.

### Deferred to ISSUES.md
- ISS-006; the soft-cap growth is folded into ISS-002.

## Verification

- RED watched for A, B, C; ledger case passed as expected (pins backward compatibility).
- Orchestrator re-ran: `npm test` 260 passed, 0 failed; `npm run tokens` always-on 2526 / 2650, unchanged.

## Next-phase readiness

- tests/run-discipline.test.js catches a brief that drops the preamble or a loop that drops the no-commit rule.
- milestone-planning (3156 tokens) and jump-start (3106) keep growing; Phase 2 should move wave-loop rules into references/ before adding more (ISS-002).
