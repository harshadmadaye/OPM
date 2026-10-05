---
title: "Mod features that each handle the same event collide in validation and in each other's tests"
date: 2026-10-05
category: integration
problem_type: integration_issue
symptoms:
  - "on(\"turn.complete\") is registered twice without a matcher"
  - "nothing beneath the plugins answers session.root"
  - "a mod test that passed alone fails after another feature adds a hook on the same event"
root_cause: "one hooks module allows one unmatched registration per event, and the test kit fires each event through every feature's hooks, so features are coupled through shared events"
severity: medium
tags: [claude-code-mods, hooks-module, turn-complete, tool-call, plugin-test]
related: [mods-validator-does-not-follow-dollar-across-imports]
---

# Mod features that each handle the same event collide in validation and in each other's tests

## Problem

OPM's mod has several features in separate files (status, guard, meter, bypass) loaded by one `register.mjs`. Adding a second feature on `turn.complete` failed `claude plugin validate --strict`, and adding hooks on `turn.complete` and Bash `tool.call` broke three tests of other features in CI.

## Investigation

1. The status feature's executor could not find the rule in the 2.1.289 types or reference and guessed two unmatched hooks were fine; strict validation said otherwise.
2. The meter tests failed with an extra log line from the status hook, because the kit runs all of the module's hooks for a fired event and the test did not stub `session.root`.
3. The guard's fail-closed test expected the guard's own denial text, but with the bypass hook in front, the outer hook's `.catch` answered.

## Root cause

All features in one module share the event chain. The engine refuses two unmatched registrations of the same event, and a test of one feature exercises every other feature's hooks on the events it fires.

## Fix

- Give the second registration a matcher that fits its intent: `on('turn.complete', { isAborted: false }, ...)` for status snapshots, beside the meter's unmatched hook.
- Make tests assert only their own feature's output: the meter test keeps log lines that start with `opm: meter`; the guard test accepts any `OPM ... failed (` denial and checks that nothing ran.

## Prevention

Run `claude plugin validate --strict` after adding any hook (CI does), and in feature tests filter shared outputs by feature prefix instead of asserting exact global lists.

## References

- Commits: 22f7d6c (matcher), b3e1aef and f8616f9 (test isolation)
- PR: harshadmadaye/OPM#5 (CI run 37300884411: 3 mod-test failures, fixed by 37301622860)
- Issue: ISS-019 (why the guard's own .catch does not answer behind the bypass hook)
