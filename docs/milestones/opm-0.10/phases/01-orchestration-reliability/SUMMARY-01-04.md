---
phase: 01-orchestration-reliability
plan: 04
requires: []
provides:
  - "Optional `component` frontmatter field in compound-learnings' validator (absent is fine; present must be a non-empty scalar)"
  - "Resolution template documents `component: opm` as a commented-out, opt-in line"
  - "compound-learnings tags clear OPM lessons `component: opm` (step 3) and, in step 6, asks one consent-gated question: open an issue on harshadmadaye/OPM, append to .opm/opm-feedback.md, or neither"
  - "tests/compound-learnings.test.js: validator cases, all committed docs/solutions still validate, template and SKILL.md content checks"
affects: [compound-learnings, 04-evals]
key_files: [skills/compound-learnings/scripts/validate-frontmatter.js, skills/compound-learnings/assets/resolution-template.md, skills/compound-learnings/SKILL.md, tests/compound-learnings.test.js]
key_decisions:
  - "Template line is a commented-out `# component: opm`: a bare `component:` parses as an empty list and fails validation, and a live value would tag every doc as OPM"
  - "`component` is a free non-empty string, not an enum (YAGNI; `opm` is the only value with behaviour)"
  - "Issue body is shown and `gh issue create --repo harshadmadaye/OPM` runs only after a yes; repo taken from package.json bugs.url"
issues_created: [ISS-003, ISS-004]
completed: 2026-11-03
---

# 01-04: Learnings about OPM flow back to OPM

**compound-learnings tags OPM-caused lessons `component: opm` and offers to send each one back as a gh issue on harshadmadaye/OPM or an entry in .opm/opm-feedback.md; nothing is sent without a yes.**

## Accomplishments

- Validator accepts optional `component`, rejects empty or list values with a clear message; every existing docs/solutions doc still validates.
- SKILL.md step 3 sets `component: opm` only when the root cause or fix is in an OPM skill, hook, agent, template or CLI.
- SKILL.md step 6 asks one question (issue / local feedback / neither); the issue is shown before it is opened.

## Task commits

1. Optional component field in the validator (TDD) - `0e24f49`
2. Tag and offer to send OPM lessons back - `e0577d2`

(Cherry-picked onto feat/0.10-human-judgment from the worktree branch, where they were f1bc2c3 and ed9bb66.)

## Deviations from plan

### Auto-fixed
- **[Rule 3 - blocker]** Worktree base was 104c7fd; fast-forwarded to 699e9cc.
- **[Rule 2 - correctness]** The plan's "`component:` with a comment" would fail validation if copied; used a full-line YAML comment instead.

### Deferred to ISSUES.md
- ISS-003, ISS-004; the soft-cap overage is folded into ISS-002.

## Verification

- RED watched for both tasks; `node --test tests/compound-learnings.test.js` 8 passed.
- Orchestrator re-ran `npm test` after merge: 252 passed, 0 failed.
- `npm run tokens`: always-on 2526 / 2650, unchanged. No network contact.

## Next-phase readiness

- Phase 4 evals can test the `component: opm` judgement and the consent gate (ISS-003).
