---
title: "npm test with a tests/*.test.js glob finds no files on Windows"
date: 2026-10-05
category: test-failures
problem_type: test_failure
symptoms:
  - "Could not find '.../tests/*.test.js'"
  - "node --test runs zero tests only on Windows"
root_cause: "npm runs scripts through cmd.exe on Windows, which passes the glob through literally, and Node 18 and 20 do not expand test globs themselves"
severity: medium
tags: [npm, windows, node-test, github-actions, glob]
related: [windows-crlf-checkout-breaks-newline-anchored-regexes]
---

# npm test with a tests/*.test.js glob finds no files on Windows

## Problem

`"test": "node --test tests/*.test.js"` works on macOS and Linux but fails on Windows with Node 18 and 20, which would have made every Windows CI job red before a single test ran.

## Investigation

1. Assumed `node --test` expands globs: true only on newer Node versions, not on 18 and 20.
2. Assumed npm expands it: on POSIX the shell does; on Windows npm uses cmd.exe, which does not expand `*`.
3. Reproduced locally by running the script with Node 20 and a non-expanding shell.

## Root cause

Glob expansion is a shell feature. cmd.exe hands `tests/*.test.js` to Node unchanged, and older Node treats it as a literal path.

## Fix

Run the test step through bash on every OS (Git Bash exists on GitHub's Windows runners), leaving package.json unchanged:

```text
- run: npm test --script-shell=bash
```

## Prevention

The Windows matrix jobs in `.github/workflows/ci.yml`. If package.json scripts gain more globs, keep `--script-shell=bash` or list files explicitly.

## References

- Commit: 861d5e0 ci(01-03): GitHub Actions workflow
- Related learnings: windows-crlf-checkout-breaks-newline-anchored-regexes
