---
phase: 04-prove-and-release
plan: 05
requires:
  - { phase: 04-prove-and-release, provides: "04-01 behaviour evals and runner; 04-04 status --report; 04-02 and 04-03 deferred (ISS-031, ISS-032)" }
provides:
  - "README, docs/using-opm.md and CHANGELOG describe 0.10 and say the behaviour and trigger evals are authored but not run"
  - "CHANGELOG 0.10.0 entry naming spec items 1-14, with 12 and 13 marked 'authored, not run'"
  - "every version field reads 0.10.0 (package.json, .claude-plugin/plugin.json, marketplace.json x2, plugins/opm-video plugin.json)"
affects: [release]
key_files: [README.md, docs/using-opm.md, CHANGELOG.md, package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json, plugins/opm-video/.claude-plugin/plugin.json, docs/why-opm.md]
key_decisions:
  - "No eval result, pass rate or 'proven' claim in any doc"
  - "Version fields follow the 0.9.1 release commit (28ba0e9)"
issues_created: []
completed: 2026-11-03
---

# 04-05: Release 0.10.0 locally

**README, docs/using-opm.md and CHANGELOG describe the 0.10 judgment features and say plainly that the evals are authored but not run; every manifest reads 0.10.0, committed locally, nothing pushed or tagged.**

## Task commits

1. Docs for 0.10 - `04dd378`
2. Bump to 0.10.0 - `cddffe3`
3. Refresh the generated token table in docs/why-opm.md (orchestrator) - `706c987`

## Deviations from plan

### Auto-fixed
- **[Rule 3]** tests/manifest.test.js requires the first CHANGELOG heading to equal the plugin version, so the suite is red between the two task commits and green at `cddffe3`.
- **[Orchestrator]** docs/why-opm.md token table regenerated with `npm run tokens -- --write`.

## Verification

- `npm test` 349 passed, 0 failed  env: unit
- `npm run tokens` exit 0, always-on 2526 / 2650  env: unit
- Secrets scan over `git diff main...HEAD`: 0 findings (one console.log hit is fixture text in a scaffold)
- E2E / behaviour evals: NOT RUN, waived by the developer on 2026-11-03 (option 1: skip paid evals)
