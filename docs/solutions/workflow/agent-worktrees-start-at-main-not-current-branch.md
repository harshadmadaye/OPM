---
title: "Parallel agent worktrees start at main, not the current branch"
date: 2026-11-03
category: workflow
problem_type: workflow_issue
symptoms:
  - "worktree was at 104c7fd, not the base the brief named"
  - "plan files missing inside the subagent's worktree"
root_cause: "Agent worktree isolation creates the worktree from the default branch, so commits and untracked files on the feature branch are absent until the agent fast-forwards"
severity: medium
tags: [worktree, subagents, parallel-waves, git, milestone-planning]
related: []
---

# Parallel agent worktrees start at main, not the current branch

## Problem

All three wave-1 agents of OPM 0.10 Phase 1 were dispatched with `isolation: worktree` from `feat/0.10-human-judgment`. Each worktree started at `main` (104c7fd), without the plan files the brief told them to read. They recovered only because the brief named the expected base commit.

## Investigation

1. Expected the worktree to branch from the orchestrator's HEAD, as `git worktree add` does from the current checkout: it did not.
2. Untracked plan files could not have reached a worktree anyway; committing them first was needed regardless.

## Root cause

Agent worktree isolation creates its branch from the repository's default branch, not from what the orchestrator has checked out. Untracked files never reach a worktree.

## Fix

Before dispatching a parallel wave into worktrees: commit the plans, name the base commit in every brief ("branch based on <branch> at <sha>"), and tell the agent to `git merge --ff-only <sha>` if its HEAD differs. Merge back with `git cherry-pick <base>..<agent-branch>` (or `--ff-only` for the first), then remove the worktree and branch.

## Prevention

The base sha in each brief is the guard; without it agents would have built on main. A single-plan wave can skip worktrees and run in the main checkout.

## References

- Commit / PR: 699e9cc (plans committed before dispatch)
- Related learnings: tooling/stop-hook-npx-prettier-reformats-repos-without-config.md
