---
phase: 01-gate-and-measure
plan: 03
requires:
  - { phase: 01-gate-and-measure, provides: npm run tokens (01-01) }
provides:
  - .github/workflows/ci.yml: 9-job test matrix (macOS, Linux, Windows x Node 18/20/22) and a gate job
  - tests/package-contents.test.js: npm pack allowlist check
  - Windows skips for the POSIX shell helper tests; Windows-safe temp paths in hooks tests
affects: [01-04, 03-first-mod]
key_files: [.github/workflows/ci.yml, tests/package-contents.test.js, tests/dev-server.test.js, tests/hooks.test.js]
key_decisions:
  - "Test step runs `npm test --script-shell=bash`: cmd.exe passes tests/*.test.js unexpanded and Node 18/20 do not expand it"
  - "Claude Code CLI pinned to 2.1.289 in one env var; gate validates marketplace.json and plugin.json with --strict"
  - "permissions: contents: read; no secrets"
issues_created: [ISS-002, ISS-003]
completed: 2026-10-05
---

# 01-03 Summary

OPM now has a release gate: every PR runs the suite on three OSes and three Node versions, and a gate job checks the token budget, the npm package contents and both manifests with the official validator.

## Task commits
- b3fab94 test(01-03): package-contents test and Windows skips
- 861d5e0 ci(01-03): GitHub Actions workflow

## Proved locally
npm test on Node 24, 20 and 18 (149 pass each before the merge); package test fails when scripts/ is added to `files`; `claude plugin validate --strict` on `.` and `.claude-plugin/plugin.json` pass on CLI 2.1.273; YAML parses with 9 matrix jobs plus gate; 2.1.289 exists on npm.

## Not proved locally
Anything on Windows, Node 22 itself, and the global install of the pinned CLI. The first real CI run is the check.

## Deviations
- Fixed tests/hooks.test.js for Windows (TEMP/TMP as well as TMPDIR; compare against path.resolve) although it was outside files_modified, as the task asked.
- The gate also runs the package-contents test.
- The SUMMARY was written by the orchestrator because the harness blocks subagents from writing report files.
