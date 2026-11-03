---
phase: 01-orchestration-reliability
plan: 03
requires: []
provides:
  - Stop hook roots each file at the nearest package.json, pyproject.toml, ruff.toml, .ruff.toml or pubspec.yaml and runs its formatter with that folder as cwd
  - files with no project marker above them are never formatted; the hook reports "skipped (no project root): <files>"
  - prettier runs only when the project opts in (local bin, prettier config found upward, or a prettier key in package.json); otherwise "skipped (no prettier config or local prettier)"
  - tests pinning project-root cwd, file-only arguments, turn-only files, deleted-file skipping and the prettier opt-in
affects: [hooks, 04-evals]
key_files: [hooks/scripts/stop-format-typecheck.js, tests/hooks.test.js, hooks/README.md]
key_decisions:
  - "findProjectRoot returns null instead of falling back to the session cwd; the hook's input.cwd fallback is removed"
  - "Unrooted line lists only checkable files, at most 5 paths then 'and N more'"
  - "Fake prettier/ruff/dart/npx log {cwd, args}; cwd compared via realpath (macOS /var -> /private/var); no real formatter needed"
  - "Prettier config is searched upward from the root because prettier itself resolves it that way (monorepo root configs)"
issues_created: [ISS-005]
completed: 2026-11-03
---

# 01-03: Formatters respect project config

**Each formatter runs from its file's own project root on this turn's files only; files outside any project, and JS projects that never chose prettier, are left untouched and reported.**

## Accomplishments

- ruff.toml and .ruff.toml count as project roots, so a ruff-only service roots at its own folder.
- groupByRoot returns { groups, unrooted }; unrooted files are reported, never formatted.
- Prettier opt-in: no more default-style rewrites of repos without a prettier config.
- Named MAX_ROOT_SEARCH_DEPTH, MAX_LISTED_UNROOTED, PRETTIER_CONFIG (replacing a magic 40).

## Task commits

1. Formatters run from the project root on the turn's files only (test) - `4b4d60f`
2. Run formatters from each file's project root, skip files outside a project - `2620c8f`
3. Run prettier only when the project opts in (orchestrator follow-up) - `44d97ea`

(1 and 2 cherry-picked from the worktree branch, where they were 378ffaf and 5bd53c7.)

## Deviations from plan

### Auto-fixed
- **[Rule 3 - blocker]** Worktree base was 104c7fd; fast-forwarded to 699e9cc.
- **[Rule 2 - correctness] Prettier default style** - during the run, the installed 0.9.1 hook reformatted this repo's tests/hooks.test.js with npx prettier defaults, though the repo has no prettier config. The executor restored the file and reported it; the orchestrator added the opt-in rule with a failing test first (`44d97ea`).

### Deferred to ISSUES.md
- ISS-005 (Windows run of the new tests).

## Verification

- RED: rooting test failed (ruff ran from repo root; no "no project root" line); opt-in test failed ("prettier ran with default style").
- `node --test tests/hooks.test.js`: 29/29. `npm test`: 255 passed, 0 failed.
- `npm run tokens`: within ceilings, unchanged.

## Next-phase readiness

- Phase 4 behaviour evals can rely on the hook not rewriting fixture repos that lack a prettier config.
