---
phase: 03-first-mod
plan: 03
requires:
  - { phase: 03-first-mod, provides: mod skeleton with guard.mjs stub (03-02) }
provides:
  - hooks/mod/guard.mjs with pure classify(command, repoRoot, cwd?) and installGuard(on)
  - Bash tool.call hold: asks via $.ui.ask, denies when nobody approves, fail-closed .catch, OPM_GUARD=off switch
  - hooks/mod/tests/guard.test.ts (39 tests)
  - "Destructive-command hold (mod)" section in docs/threat-model.md (87 lines total)
affects: [03-06, 04-02]
key_files: [hooks/mod/guard.mjs, hooks/mod/tests/guard.test.ts, docs/threat-model.md]
key_decisions:
  - "parsing ported from block-no-verify.js: git/rm only in command position, heredoc bodies dropped"
  - "rm targets resolve against the session cwd and are held unless strictly inside the repo root"
  - "a force-push that names no branch is held, since the pure classifier cannot know the current branch"
  - "a rejected ask and any answer other than 'Run it' deny with the same reason text"
issues_created: [ISS-011]
completed: 2026-10-05
---

# 03-03 Summary

OPM's mod now holds `rm -rf` on root-like or out-of-repo paths, force-pushes to main or master and `git reset --hard` behind a user question, and denies when nobody approves or the guard itself fails.

## Task commits
- 8f3e43d feat(03-03): risk classifier and guard hook
- 6b1160c docs(03-03): threat model update

## Verification
npm test 223 pass; pinned plugin test 46 pass at the time (66 after merging 03-04); validate --strict passes on 2.1.273 and 2.1.289.

## Passes untouched
rm -rf ./build, dist, build/* and absolute paths inside the repo; rm -f or rm -r alone; force-push to a feature branch; plain push to main; git reset --soft; echo, grep and heredoc text.

## Deviations
- classify throws TypeError on a non-string command; the fail-closed test makes $.session.root deny so the hook throws.
- The guard ignores in-command `cd`; relative paths resolve against the session cwd.
