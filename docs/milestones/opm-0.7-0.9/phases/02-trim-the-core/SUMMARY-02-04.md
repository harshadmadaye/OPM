---
phase: 02-trim-the-core
plan: 04
requires: []
provides:
  - npx opm-core doctor (bin/doctor.js, runChecks(env) returning {id, status, message, fix})
  - .claude/rules/opm/.opm-version stamp {version, ruleSets, installedAt, files: {relPath: sha256}}
  - installer's one-line next step pointing at doctor; install.js exports STAMP_FILE and PACKAGE_VERSION
affects: [02-06, 02-07, 03-first-mod]
key_files: [bin/doctor.js, bin/install.js, tests/doctor.test.js, tests/installer.test.js]
key_decisions:
  - "process runner and fs injected through env; CLI answers cached so header and checks share one probe"
  - "hook replay uses a throwaway opm-doctor-<hex> session id with OPM_HOOKS_DISABLED unset"
  - "plugin path from claude plugin list --json, else replay from this package"
  - "a crashing check is a fail row; stack only with --verbose; exit 1 only on a fail row"
issues_created: [ISS-006]
completed: 2026-10-05
---

# 02-04 Summary

The installer writes a hashed rules stamp and points to doctor, which checks Node, the CLI, the plugin, rule freshness, tools and replayed hooks offline, exiting 1 only on a fail row.

## Task commits
- 3e62c40 feat(02-04): rules version stamp and next-step line
- 052e61e feat(02-04): doctor checks

## Real run (this repo)
OPM 0.7.0 · Node 24.1.0 · Claude Code 2.1.273; 11 passed, 1 warning (no rules stamp), 0 failed; all 6 hooks replayed from the installed 0.6.1 plugin.

## Deviations
- Task 1 included a minimal bin/doctor.js so `doctor --help` resolved.
- Rows are always coloured, even when not a TTY, matching the installer.
