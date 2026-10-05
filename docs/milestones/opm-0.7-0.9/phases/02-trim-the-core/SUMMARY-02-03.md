---
phase: 02-trim-the-core
plan: 03
requires: []
provides:
  - SKILL.md cores for executing-plans (4,221 B), react-patterns (3,286), python-patterns (3,161), flutter-patterns (3,399) with on-demand references/
  - ENFORCED_SOFT_CAP_SKILLS and SKILL_SOFT_CAP_TOKENS = 1200 in scripts/token-budget.js; referenceBytes per skill in the report
affects: [02-02, 02-07]
key_files: [skills/executing-plans/SKILL.md, skills/react-patterns/SKILL.md, skills/python-patterns/SKILL.md, skills/flutter-patterns/SKILL.md, scripts/token-budget.js]
key_decisions:
  - "references/ files are not counted toward SKILL.md and are reported as on-demand bytes"
  - "executing-plans got 8 references (setup, fix-loop, inline-mode and finishing added) so long sections stay whole"
  - "rules are the single source for conventions; skills point to them by rule file and section"
  - "the cap fails only for the four listed skills; others warn"
issues_created: []
completed: 2026-10-05
---

# 02-03 Summary

The four largest per-run skills are now 3.2-4.2 KB cores with on-demand references (executing-plans about 5,000 to 1,056 tokens), and the linter fails if any regrows past 1,200 tokens.

## Task commits
- 898cb57 refactor(02-03): split executing-plans
- 5909ebd refactor(02-03): split and dedupe the three stack pattern skills
- 6ac6b4e feat(02-03): enforce the soft cap on split skills

## Content check
Every original heading survives in SKILL.md plus references/; a line diff shows only the deduplicated lines missing.

## Deduplicated against rules
react: hooks rules, state-location ladder, stable keys, server/client import rule, Server Action auth, Suspense placement, form validation (to react/patterns.md). python: immutability, annotations, CI type checker, exception chaining, config fail-fast (python/coding-style.md); friendly messages and logs (common/coding-style.md). flutter: prefer final, sealed LoadState example, one approach per app, generated files, fakes over mocks (dart rules).

## Deviations
- Flutter's "commit the generated files" conflicted with the dart rule ("all committed or all gitignored"); it now points to the rule.
- docs/why-opm.md skill table is stale; 02-07 regenerates it.
