# Phase 1 review pack: orchestration reliability

Written by hand (the tooling ships in Phase 2). Target: 20-30 minutes. Range: `git diff 699e9cc..94773ec`, 13 commits, 260 -> 261 tests, always-on tokens unchanged (2526 / 2650).

Read in this order. Each item has its diff range and questions you should be able to answer after reading it; if you can't, that part needs a closer look.

## 1. Stop hook: project-root rooting and unrooted skip (external effect: rewrites files on users' machines every turn)

`git show 4b4d60f 2620c8f` - hooks/scripts/stop-format-typecheck.js `findProjectRoot`, `groupByRoot`, `unrootedLine`; tests/hooks.test.js "each formatter runs from its file's project root".

- How does a file in a monorepo sub-package get its root, and what happens if a stray `~/package.json` exists?
- What does the hook do for a file with no marker above it, and where is that reported?
- Why was the `input.cwd` fallback removed, and what would break if it came back?

## 2. Formatter opt-in: prettier and ruff (external effect: decides whether code is restyled)

`git show 44d97ea 94773ec` - `hasConfigUpward`, `dirHasPrettierConfig`, `dirHasRuffConfig`, `checkPrettier`, `checkRuff`.

- Which signals count as opting in to prettier, and to ruff? Where does the upward search stop?
- Why does Dart keep running without an opt-in check?
- What does a user on 0.9.1 see until they upgrade, and what is the workaround? (docs/solutions/tooling/stop-hook-npx-prettier-reformats-repos-without-config.md)

## 3. Accumulator list lifecycle across Stop events

Unchanged code, but item 4's promise ("only this turn's files") depends on it: `stop-format-typecheck.js` bottom `readStdin` block; test "stop_hook_active short-circuits without touching the list".

- When is the list deleted, and why is it kept when `stop_hook_active` is true?
- After a tsc block and a fix-up turn, which files does the next real Stop check?
- Why does the `finally` block sleep for `MIN_LIST_LIFETIME_MS`?

## 4. Report ownership moves to the orchestrator

`git show e2e1ec0 824172f` - skills/milestone-planning/SKILL.md "Executing a phase", jump-start Phase 6, templates, implementer-brief; tests/report-ownership.test.js.

- Where does the orchestrator get the SUMMARY text, and what should it do if a subagent's report lacks it?
- Which sentence shapes would slip past the test (ISS-001, ISS-008)?
- Who writes STATE.md after a checkpoint-resume subagent finishes?

## 5. No commits means not done, and the brief preamble

`git show c641d51 795f289 80e1109 93dd9c6` - implementer-brief "Handle the report", milestone-planning wave loop, jump-start step 2, brew.workflow.js `BRIEF_PREAMBLE`; tests/run-discipline.test.js, tests/ledger.test.js.

- How is "no new commits" decided in a task loop (`BASE..HEAD`) versus a wave (`(NN-MM)` commits since the wave base)?
- What do old ledgers and the two new ledger lines parse as, and what does status show after an escalation (ISS-009)?
- What happens to dependent plans when one is escalated in jump-start versus milestone-planning?

## Review findings (opm:code-reviewer, whole phase)

| Severity | Found | Fixed | Parked | Dismissed |
|---|---|---|---|---|
| CRITICAL | 0 | | | |
| HIGH | 0 | | | |
| MEDIUM | 2 | 1 (ruff ungated, 94773ec) | | 1 |
| LOW | 3 | | 3 (ISS-007, ISS-008, ISS-009) | |

Dismissed: "list kept after a tsc block formats stale paths". Keeping it is deliberate and pinned by a test, so the fix-up edits made after a block are still checked at the next real Stop instead of being dropped.

## Things that went differently than planned

- Worktrees for wave 1 started at `main`, not the branch; the briefs' base sha saved it (docs/solutions/workflow/agent-worktrees-start-at-main-not-current-branch.md).
- The installed 0.9.1 hook reformatted files in this repo three times during the run; each was confirmed formatting-only and restored.
- Orchestrator added two follow-up fixes to 01-03 (prettier and ruff opt-in), both test-first.
