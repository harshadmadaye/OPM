---
title: "claude plugin test refuses to run: hooks modules are turned off in this process"
date: 2026-10-05
category: tooling
problem_type: tooling_decision
symptoms:
  - "hooks modules are turned off in this process: the rollout switch was saved off by an earlier session and is not refreshed yet"
  - "claude plugin test passed earlier on the same machine and now refuses"
root_cause: "the mods rollout switch is cached locally; once a session saves it as off, later processes refuse to load hooks modules until Claude Code refreshes it with network access"
severity: medium
tags: [claude-code-mods, plugin-test, ci, local-environment]
related: []
---

# claude plugin test refuses to run: hooks modules are turned off in this process

## Problem

Midway through the milestone, every `npx -y @anthropic-ai/claude-code@2.1.289 plugin test .` on the maintainer machine refused to run, from subagents and from the main session alike. Earlier the same command had passed 66 tests.

## Investigation

1. Retried, including outside the sandbox: same message.
2. Validation (`claude plugin validate --strict`) still worked, so the plugin itself was not at fault.
3. Reading Claude Code's own config to inspect the cached flag was denied by the permission system and is not needed: the message names the fix.

## Root cause

Claude Code caches the mods rollout switch. Some earlier process (possibly one of the headless spike runs) saved it as off, and the CLI does not refresh it on its own. If it stays off after a refresh, mods are turned off remotely for that account.

## Fix

Start `claude` once interactively with network access, then rerun the tests. Until then, rely on CI: the gate job installs the pinned CLI fresh and runs `claude plugin test .`.

## Prevention

Keep mod tests in CI (they caught 3 real failures while local runs were blocked). Do not treat a local "cannot run" as a pass: record it, push, and read the CI result.

## References

- PR: harshadmadaye/OPM#5 (mod tests verified only in CI)
- Issue: ISS-013
