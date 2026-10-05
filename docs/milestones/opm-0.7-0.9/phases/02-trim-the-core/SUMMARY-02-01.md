---
phase: 02-trim-the-core
plan: 01
requires: []
provides:
  - Size | Signal | Skill routing table in skills/using-opm/SKILL.md (spike, bounded, multi-week, unattended, contested)
  - tests/fixtures/trigger-prompts.json (30 prompts: spike 8, bounded 6, contested 6, multi-week 5, unattended 5)
  - tests/routing.test.js pinning the table to the fixture and checking every named skill exists
affects: [02-06, 04-evidence]
key_files: [skills/using-opm/SKILL.md, tests/fixtures/trigger-prompts.json, tests/routing.test.js]
key_decisions:
  - "Each row routes on the first opm: reference in its Skill cell"
  - "Workflow Map lines now covered by the table were cut, so always-on grew only +39 tokens (2,541 to 2,580)"
issues_created: [ISS-004, ISS-005]
completed: 2026-10-05
---

# 02-01 Summary

using-opm now routes by size, so a small fix goes straight to tdd-workflow, and a 30-prompt fixture test locks that routing in place.

## Task commits
- 33cbd25 test(02-01): trigger fixture and routing test
- 4f6f570 feat(02-01): routing table in using-opm

## Deviations
- Removed the "Let's build X" line and the "classify (spike / bounded / architectural)" phrase, which the table supersedes and which clashed with its meaning of spike.
