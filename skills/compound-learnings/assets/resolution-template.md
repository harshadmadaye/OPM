---
title: "Short, specific problem title"
date: YYYY-MM-DD
category: runtime-errors
problem_type: runtime_error
symptoms:
  - "Exact error message or log line someone would grep for"
  - "Observable misbehaviour in plain words"
root_cause: "One sentence naming the mechanism, not the symptom"
severity: medium
tags: [library-name, concept, module-name]
related: []
---

# Short, specific problem title

## Problem

What was observed, where, and what it cost (time, incidents, blocked work). One to three sentences.

## Investigation

What was tried, in order. Include the plausible dead ends and why each was reasonable to try,
so the next person does not repeat them.

1. First hypothesis and why it was wrong.
2. Second hypothesis and what ruled it out.
3. What finally pointed at the real cause.

## Root cause

The actual mechanism at the level of "why". If a diagram or a minimal reproduction makes it
click, include it.

## Fix

What changed. Show the smallest code excerpt that demonstrates the fix.

```text
before -> after
```

## Prevention

The test, lint rule, guard, type, or convention that stops this from recurring. If nothing
prevents it yet, say so explicitly and name what would.

## References

- Commit / PR:
- Issue:
- Upstream docs:
- Related learnings:

<!-- Adapted from EveryInc/compound-engineering-plugin (MIT) -->
