---
title: "Running the same check as a mod hook and a settings hook without double-firing"
date: 2026-10-05
category: architecture
problem_type: architecture_decision
symptoms:
  - "the same tool call is checked twice, once in process and once by the settings-hook script"
  - "a nested older Claude Code skips its safety hooks after being started from a mod session"
root_cause: "a plugin that ships both a mod and settings hooks for backward compatibility runs both on new Claude Code, and no API lets a mod disable only its own plugin's settings hooks"
severity: medium
tags: [claude-code-mods, settings-hooks, environment-variables, backward-compatibility, hooks]
related: [mod-features-collide-on-shared-events]
---

# Running the same check as a mod hook and a settings hook without double-firing

## Problem

OPM wanted its hook-bypass and config checks in process (mods, Claude Code 2.1.287+) while keeping the settings-hook scripts for older versions. Both live in one hooks.json, so new Claude Code would run each check twice.

## Investigation

1. Looked for a documented way for a mod to switch off its own plugin's settings hooks: none. Answering `classic.PreToolUse` without `next` would skip every non-managed settings hook, the user's own included.
2. Spiked an environment flag: the mod calls `$.env.set('OPM_MOD_ACTIVE', ...)` at session start and the scripts exit early when it is set. A live headless run on 2.1.289 logged the variable inside the settings-hook process (cost about $0.05).
3. Review found a gap with a constant value (`1`): an older Claude Code started from a shell inside a mod session inherits the variable and silences its own checks.

## Root cause

Settings hooks are child processes of Claude Code and inherit its environment, including anything the mod sets, and also anything inherited by a nested session.

## Fix

Scope the flag to the session that set it:

```text
mod:     $.env.set('OPM_MOD_ACTIVE', await $.session.id())
scripts: if (process.env.OPM_MOD_ACTIVE && input.session_id === process.env.OPM_MOD_ACTIVE) exit 0
```

If the ids ever differ, both sides check: the failure mode is double-firing, never silence.

## Prevention

tests/hooks.test.js covers both cases (matching session id steps aside; `1` or another session id still checks). docs/threat-model.md describes which side runs when.

## References

- Commits: 7e297a3 (spike), 5f6bb67 (shared rules), 95d9852 (session scoping)
- Summary: docs/milestones/opm-0.7-0.9/phases/04-evidence/SUMMARY-04-02.md
