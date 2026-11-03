---
phase: 02-person-in-the-loop
plan: 01
requires:
  - { phase: 01-orchestration-reliability, provides: preamble, report-ownership and no-commit rules plus the tests that check them }
provides:
  - skills/milestone-planning/references/executing-a-phase.md (Executing a phase, deviation and commit rules, SUMMARY files, checkpoint types)
  - skills/jump-start/references/build-and-run.md (Phase 4 permission-mode options, Phases 6-8, Resuming)
  - SKILL_CEILING_TOKENS in scripts/token-budget.js - npm run tokens fails a milestone-planning or jump-start core over 2400 tokens
affects: [02-02, 02-03, 02-04]
key_files: [skills/milestone-planning/SKILL.md, skills/milestone-planning/references/executing-a-phase.md, skills/jump-start/SKILL.md, skills/jump-start/references/build-and-run.md, scripts/token-budget.js, tests/token-budget.test.js, tests/run-discipline.test.js, tests/report-ownership.test.js, docs/why-opm.md]
key_decisions:
  - "Execution-only detail lives in references/ with a pointer from the core (executing-plans pattern); the preamble, the no-commit rule and report ownership stay in each core"
  - "Per-skill hard ceiling of 2400 tokens: core after 02-01 (about 2300) plus headroom for Phase 2 rules"
  - "Checkpoint types and the jump-start permission-mode list moved too, because the planned moves alone left the cores near 2460 and 2500"
issues_created: [ISS-010, ISS-011, ISS-012]
completed: 2026-11-03
---

# 02-01: Make room for Phase 2 rules

**milestone-planning and jump-start cores cut from 3156 and 3106 to 2300 and 2295 tokens, with a 2400-token ceiling that fails `npm run tokens` if either regrows.**

## Accomplishments

- milestone-planning: Executing a phase, Deviation rules, Commit rules, SUMMARY files body and Checkpoint types moved verbatim to references/executing-a-phase.md; the core keeps a short version and a pointer.
- jump-start: Phases 6-8, Resuming and the Phase 4 permission-mode list moved verbatim to references/build-and-run.md; the core keeps stubs, Gates, Phases 0-5 and 9, Red flags, Safety.
- `SKILL_CEILING_TOKENS` with a fixture test; docs/why-opm.md token table refreshed.

## Task commits

1. Move milestone execution detail to references - `bc6eacb`
2. Move jump-start build detail to references and cap both skills - `01d579b`

## Deviations from plan

### Auto-fixed
- **[Rule 3 - blocker]** Planned moves alone did not reach 2300; Checkpoint types and the permission-mode list were also moved verbatim.
- **[Noise]** tests/run-discipline.test.js was hook-reformatted on disk; restored and only the real change committed.
- Core summaries are shortened rewrites; the milestone mid-run notice and jump-start's "subagents may not ask" line now live only in the references, which the cores point to at the moment they apply. Orchestrator checked the cores: the preamble, no-commit rule and "no questions" remain.

### Deferred to ISSUES.md
- ISS-010, ISS-011, ISS-012. The proposed "hook reformats test files" issue is already fixed on this branch (44d97ea); dismissed.

## Verification

- Orchestrator re-ran: `npm test` 262 passed, 0 failed; `npm run tokens` exit 0, always-on 2526, milestone-planning 2300, jump-start 2295.

## Next-phase readiness

- About 100 tokens of headroom per core: Phase 2 rules go in the references unless one line.
