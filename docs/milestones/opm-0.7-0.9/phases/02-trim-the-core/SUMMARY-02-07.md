---
phase: 02-trim-the-core
plan: 07
requires:
  - { phase: 02-trim-the-core, provides: every phase 2 plan }
provides:
  - plugin always-on CI ceiling lowered 2,850 to 2,650 (measured 2,379)
  - regenerated docs/why-opm.md table
  - README notes for npx opm-core doctor, the routing table and docs/threat-model.md
  - CHANGELOG 0.7.1 with Breaking lines for the verification-loop merge and the explainer-video move
  - version 0.7.1 in package.json, both plugin.json files and both marketplace entries
affects: [03-first-mod]
key_files: [scripts/token-budget.js, docs/why-opm.md, README.md, CHANGELOG.md]
key_decisions:
  - "ceiling = 2,379 + 10% rounded up to 50 = 2,650; rules/common ceiling unchanged at 1,550"
  - "changelog before/after uses the 0.7.0 published figure 2,541 to 2,379"
  - "feature 14 (brew-idea user-invoked only) noted as unchanged, not as a change"
issues_created: []
completed: 2026-10-05
---

# 02-07 Summary

Phase 2 ships as 0.7.1: always-on cost drops from about 2,541 to 2,379 tokens under a lower 2,650 ceiling, the README documents doctor, routing and the threat model, and every version field reads 0.7.1.

## Task commits
- 478630a chore(02-07): lower the ceiling and regenerate the cost table
- 0900fc8 chore(02-07): changelog and version bump to 0.7.1

## Verification
npm test 195 pass; npm run tokens exit 0; strict validate passed for the marketplace and plugins/opm-video.
