---
title: "Mod validation fails when the mods API ($) is passed into a function in another file"
date: 2026-10-05
category: integration
problem_type: integration_issue
symptoms:
  - "$ is always spelled $.noun.event(...) at the call site"
  - "setup($) helper in a feature file fails claude plugin validate"
  - "/opm:status cannot be registered: command names allow letters, digits, _ and -"
root_cause: "the plugin validator statically lists every $ call per hook and does not follow $ across an import, and command names cannot contain a colon"
severity: low
tags: [claude-code-mods, plugin-validate, hooks-module, commands]
related: [mod-features-collide-on-shared-events]
---

# Mod validation fails when the mods API ($) is passed into a function in another file

## Problem

The first mod plan (written from the docs) had each feature export `setup($)` called from `register.mjs`'s single `session.start` hook, and named the command `/opm:status`. Both failed when built.

## Investigation

1. Assumed `$` behaves like a normal object that can be passed around: the validator rejected it, because it derives the mod's declared calls statically at the call site.
2. Assumed plugin-namespaced command names like the skill form `/opm:status`: `$.command.register` accepts only letters, digits, `_` and `-`.

## Root cause

`claude plugin validate` builds the list of mods API calls (shown to users and admins before install) by reading `$.namespace.method(...)` where it is written. A `$` received as a parameter in another module is invisible to it. Command names are a separate namespace from skills and have no plugin prefix.

## Fix

Features export their commands as data and add hooks through `on`, which may cross imports; `register.mjs` registers the data:

```text
// status.mjs
export const statusCommands = [{ name: 'opm-status', description: '...', immediate: true }]
export function installStatus(on) { on('command.run', { command: 'opm-status' }, async ($, e) => ...) }
```

Users type `/opm-status`; output is prefixed with the plugin name.

## Prevention

`claude plugin validate --strict` on both the pinned and the installed CLI in CI. Plan mod work from the types the CLI writes for its build, not only from the docs.

## References

- Commits: a43d3f6, ae9fb64 (03-02)
- Summary: docs/milestones/opm-0.7-0.9/phases/03-first-mod/SUMMARY-03-02.md
