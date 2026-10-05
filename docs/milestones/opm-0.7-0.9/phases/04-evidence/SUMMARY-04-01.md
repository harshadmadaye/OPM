---
phase: 04-evidence
plan: 01
requires:
  - { phase: 03-first-mod, provides: /opm-status and the mod skeleton (03-02) }
provides:
  - per-repo SessionStatusEntry snapshots in $.store (key opm.status.<16-hex hash of the repo root>, pruned at 14 days or when complete, 64 KiB cap)
  - snapshots written after each main-loop turn (turn.complete with matcher { isAborted: false }) and on /opm-status
  - /opm-status --all: at most 25 rows plus a footer, newest first, "(stale)" after 3 days
  - exports statusKey, snapshot, isStatusEntry, pruneStatusEntries, formatAllStatus
affects: [04-04, 04-05]
key_files: [hooks/mod/status.mjs, hooks/mod/tests/status.test.ts]
key_decisions:
  - "hashed repo key (cyrb53-style 64-bit string hash), no path in any key"
  - "skip the write unless the newest ledger mtime changed (sourceMtimeMs)"
  - "store errors become one debug line; the turn result is returned unchanged; subagent turns are not recorded"
  - "status's turn.complete has a matcher so it does not clash with the meter's unmatched one"
issues_created: [ISS-013]
completed: 2026-10-05
---

# 04-01 Summary

`/opm-status --all` lists every open OPM plan on this machine from a small, pruned per-repo store cache.

## Task commits
- 8cc433d feat(04-01): per-repo status snapshots and /opm-status --all (both tasks, committed by the orchestrator)
- 22f7d6c fix(04-01): give the status turn.complete hook a matcher

## Verification
npm test green; validate --strict passes on 2.1.273 and 2.1.289. The mod tests could not run on this machine ("hooks modules are turned off in this process": the mods rollout switch is cached off); they run in CI on PR #5. Pure helpers were checked with scratch scripts (prune and cap keep 220 of 400 entries at 65,450 B, newest kept).

## Sample
```
newer-app: 2026-10-04-api.md 2/5, Task 3 API routes, seen 2026-10-05 17:29
winapp: 2026-09-20-other.md 1/?, no current task, seen 2026-10-04 17:30
older-app: 2026-09-20-other.md 1/4, Task 9 very long title very long titl..., seen 2026-10-01 17:30 (stale)
3 projects, cache only: run /opm-status in a repo for its live state
```

## Deviations
- First committed with two unmatched turn.complete hooks, which strict validation rejects; fixed with a matcher.
- Tests were not seen failing first under the kit (the kit would not run locally).
