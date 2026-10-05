---
phase: 04-evidence
plan: 05
requires:
  - { phase: 04-evidence, provides: every phase 4 plan }
provides:
  - version 0.9.0 in package.json, both plugin.json files and both marketplace entries
  - CHANGELOG 0.9.0 (status --all, session-scoped dedupe migrated, trigger eval spike, README positioning, listing kit, unchanged token numbers, mod tests in CI only)
  - README mod table and Declared list refreshed from validate on 2.1.289
affects: []
key_files: [CHANGELOG.md, README.md, package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json, plugins/opm-video/.claude-plugin/plugin.json]
key_decisions:
  - "ceiling kept at 2,650 because the measured total did not change (2,379)"
  - "Declared table uses only live validate output"
  - "hot-path dedupe recorded as migrated, not abandoned"
  - "no claim of live-session use of the mod"
issues_created: []
completed: 2026-10-05
---

# 04-05 Summary

Phase 4 ships as 0.9.0 with a changelog that says what was measured and what is only a spike, and an accurate list of what the mod declares.

## Task commits
- Task 1: no change (always-on 2,379 tokens, ceiling stays 2,650; regenerated table had no diff)
- 61ff87f chore(04-05): Changelog and version bump to 0.9.0

## Verification
npm test 237 pass; npm run tokens exit 0; validate --strict passed on 2.1.273 and 2.1.289. The pinned plugin test cannot run on this machine (mods switch off); CI on PR #5 ran 159 mod tests green at f3a6534.

## Deviations
- README.md added to Task 2's files to refresh the Declared table.
- The orchestrator fixed a stale OPM_MOD_ACTIVE=1 comment in hooks/mod/bypass.mjs.
