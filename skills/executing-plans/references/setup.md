## Setup

1. **Branch check.** Never start implementation on `main`/`master` without the user's explicit consent. Create or verify a feature branch (or worktree) first.
2. **Ledger check.** The ledger lives at `docs/plans/<plan-basename>.progress.md` (plan `docs/plans/2026-09-12-auth.md` -> `docs/plans/2026-09-12-auth.progress.md`). If it exists and its first line names your plan file, tasks with a `Task <N>: complete` line are DONE: do not re-dispatch them; resume at the first task without one. A task whose last line is a fix round is mid-loop: resume at the next round. Otherwise create it with `# OPM ledger - plan: <plan file path>` as line 1.
3. **Read the plan once.** Note Goal, Global Constraints, and the Interfaces blocks. If the plan names a Spec, read that too: the spec is the authority the plan argues from, and conflicts inside the plan resolve against it. A plan with no reachable spec gets a ledger note saying so; rulings made without one are provisional.
4. **Pre-flight conflict scan.** One row per pair of tasks that share a file or interface (what one produces vs. what the other consumes), and one row per task (do its tests agree with its code, do the files it creates match the files it later touches). Write the table to the ledger. Rule on each conflict before Task 1, spec as binding authority. "The scan is clean" without rows is not a scan you ran.
5. **Create a todo per task.**

Conversation memory does not survive compaction. Controllers that lost their place have re-dispatched entire completed task sequences, the single most expensive failure observed. After compaction, trust the ledger and `git log` over your own recollection.
