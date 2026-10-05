---
title: "Windows CI checkouts turn LF into CRLF and break newline-anchored parsers"
date: 2026-10-05
category: test-failures
problem_type: test_failure
symptoms:
  - "frontmatter missing"
  - "export const meta = {...} not found at the top of the script"
  - "tests pass on macOS and Linux but fail only on windows-latest"
root_cause: "actions/checkout on Windows applies core.autocrlf, so files arrive with CRLF and regexes anchored on \\n stop matching"
severity: medium
tags: [github-actions, windows, line-endings, gitattributes, node-test]
related: [windows-npm-test-glob-not-expanded]
---

# Windows CI checkouts turn LF into CRLF and break newline-anchored parsers

## Problem

The first Windows CI run of OPM failed 7 tests that read SKILL.md frontmatter or a workflow script's `export const meta` block. The same suite passed on macOS and Linux, and on Node 18, 20 and 24 locally.

## Investigation

1. Suspected Node version differences: ruled out, the same Node versions passed on Linux.
2. Suspected path separators (a real issue in one other test): did not explain parsers that read file content.
3. The failing assertions all used patterns like `/^---\n[\s\S]*?\n---/`; the Windows checkout had `\r\n` line endings.

## Root cause

Git on the Windows runner converts LF to CRLF on checkout (core.autocrlf defaults on). Any parser or test that anchors on `\n` without allowing `\r?` sees no match.

## Fix

Pin LF for every text file in the repo, so every checkout matches what the parsers expect:

```text
.gitattributes
* text=auto eol=lf
```

Parsers that must accept user files from Windows should still use `\r?\n` (the token budget linter does).

## Prevention

The `.gitattributes` file plus the Windows jobs in `.github/workflows/ci.yml`. New parsers of repo files should be tested with a CRLF fixture.

## References

- Commit: aece761 fix(ci): keep LF on Windows checkouts and build file URLs portably in tests
- PR: harshadmadaye/OPM#2 (first CI run 37296751829 failed, rerun green)
- Related learnings: windows-npm-test-glob-not-expanded
