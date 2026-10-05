---
name: executing-plans
description: Executes a written implementation plan task-by-task by dispatching a fresh implementer subagent per task, a reviewer subagent after each, and a progress ledger that survives context compaction. Use when a plan exists in docs/plans/ and the user wants it implemented, resumed after interruption, or finished with verification and a PR.
---

# Executing Plans

## Overview

Load the plan, review it critically, execute every task through a fresh implementer plus a reviewer gate, verify, then hand off. You are the controller: you coordinate, rule, and record. You do not write the code yourself.

**Announce at start:** "Using opm:executing-plans to implement `<plan path>`."

**Core principle:** fresh subagent per task + task review (spec + quality) + ledger = high quality, fast iteration, nothing lost to compaction.

## Choose the Mode

- **Subagent mode** (default): 4 or more tasks, or any task needing its own judgment, tests, or review surface.
- **Inline mode**: 3 or fewer tasks. Read references/inline-mode.md when you choose inline mode.

Say which mode you are using and why.

## Setup

1. **Branch check.** Never implement on `main`/`master` without explicit consent.
2. **Ledger check.** `docs/plans/<plan-basename>.progress.md`. Tasks with `Task <N>: complete` are DONE: never re-dispatch them. Else create it with `# OPM ledger - plan: <plan file path>` as line 1.
3. **Read the plan once**, and its Spec if named.
4. **Pre-flight conflict scan** into the ledger; rule on each conflict before Task 1.
5. **Create a todo per task.**

Read references/setup.md when resuming a ledger or running the pre-flight scan. After compaction, trust the ledger and `git log` over your memory.

Do not pause between tasks: rule on ambiguities, ledger `Ruling: <what> - <why> - <cost if wrong>`, keep going. Stop only for irreversible, security-sensitive, or outside-the-branch actions, or a plan where every path is a guess. Always name a model. Read references/rulings-and-models.md when making the first dispatch or a ruling.

## The Task Loop (Subagent Mode)

Never run two implementers in parallel on one branch.

1. **Brief and dispatch.** Record `BASE=$(git rev-parse HEAD)`. Brief: task text verbatim, Global Constraints, consumed interfaces, file paths, your rulings; never the whole plan or history. Read references/implementer-brief.md when composing a brief or handling its report.
2. **Gate: commits exist.** `git log --oneline BASE..HEAD`; a report is a claim.
3. **Review.** A reviewer subagent gives spec and quality verdicts. Never fix findings yourself. Read references/reviewer.md when dispatching a reviewer.
4. **Fix loop, at most 3 rounds.** Critical, Important, spec ISSUES loop; Minor goes to the ledger. After round 3, adjudicate each open finding with a ledgered ruling. Read references/fix-loop.md when a review returns findings.
5. **Complete.** Ledger `Task <N>: complete (commits <base7>..<head7>, review clean)` or `..., <K> parked)`. Never move on with Critical/Important findings neither fixed nor parked.

## Ledger Format

```
# OPM ledger - plan: docs/plans/2026-09-12-auth.md
Branch: feat/auth  Base: 3f2a1c9
Preflight: <table rows or "clean: N pairs checked, M tasks self-consistent">
Ruling: <decision> - <why> - <cost if wrong>
Task 1: complete (commits 3f2a1c9..8b77d10, review clean)
Task 2: minor (deferred): duplicated fixture setup in test_session.py:12
Task 2: fix round 1/3 (2 addressed, 1 open - missing 401 path; commits 8b77d10..c01e4aa)
Task 2: complete (commits 8b77d10..d9e02f1, review clean)
```

Append-only. One line per event. The commits it names exist in git even when your context no longer remembers creating them.

## Finishing

1. **Final whole-branch review** by `code-reviewer` (most capable tier).
2. **Verify** with `opm:verification-before-completion`.
3. **Report rulings**: every `Ruling:` and `parked` line under "Rulings I made".
4. **Offer the PR**; never push or open it without a yes.
5. **Compound learnings** if anything surprised you.

Read references/finishing.md when you reach Finishing. Read references/rationalizations.md when tempted to skip a gate.

<!-- Adapted from obra/superpowers (MIT) -->
