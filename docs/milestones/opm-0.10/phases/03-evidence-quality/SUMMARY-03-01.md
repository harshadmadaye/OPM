---
phase: 03-evidence-quality
plan: 01
requires:
  - { phase: 02-person-in-the-loop, provides: "references/ split, stop list, review queue" }
provides:
  - "env label (unit | simulator | physical-device | prod-like) on every gate of the VERIFICATION REPORT, with legend and an 'env: not stated' rule for unlabelled checks"
  - "NOT JUDGEABLE rule for performance, startup, battery and network claims from simulator or unit runs (full-loop.md and a claim-table row in verification SKILL.md)"
  - "real-environment pass: declared in ROADMAP.md Definition of done as 'Real-environment pass: required (physical-device|prod-like)'; phase or milestone close then needs such a check"
  - "Env column in the jump-start final-report Evidence table; env on SUMMARY Verification lines; Phase 8 labels the run"
affects: [03-02, 04-evals]
key_files: [tests/evidence-env.test.js, skills/verification-before-completion/SKILL.md, skills/verification-before-completion/references/full-loop.md, skills/milestone-planning/templates/summary.md, skills/milestone-planning/references/executing-a-phase.md, skills/jump-start/references/build-and-run.md, skills/jump-start/templates/final-report.md]
key_decisions:
  - "All additions in references/ and templates; milestone-planning and jump-start cores untouched"
  - "Unlabelled old checks read as 'env: not stated', not as failures"
  - "Emulator and local dev server count as simulator"
issues_created: [ISS-021]
completed: 2026-11-03
---

# 03-01: Label where each check ran

**Every verification gate says where it ran, simulator-only performance claims read NOT JUDGEABLE instead of PASS, and a milestone can require a real-environment pass in one ROADMAP line.**

## Task commits

1. Pin env labels and the not-judgeable rule - `d775921`
2. Label where each check ran; simulator performance claims not judgeable - `c664295`
3. Say how a milestone declares a real-environment pass (orchestrator, red then green) - see `git log --grep "03-01"`

## Deviations from plan

### Auto-fixed
- **[Rule 2, orchestrator]** The real-environment rule had no place to be declared (executor's proposed ISS-023); added the ROADMAP line and a test assertion.

### Deferred to ISSUES.md
- ISS-021 (no real-env gate line for E2E/smoke). The proposed regex-only test issue is folded into ISS-008.

## Verification

- Tests: RED watched; `npm test` 298 passed, 0 failed  env: unit
- `npm run tokens` exit 0, always-on 2526; verification-before-completion 1406 (soft-cap warning only)  env: unit

## Next-phase readiness

- 03-02 adds reviewer calibration; final-report.md now has the Env column to build on.
