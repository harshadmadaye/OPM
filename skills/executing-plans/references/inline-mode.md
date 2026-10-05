## Choose the Mode

- **Subagent mode** (default): 4 or more tasks, or any task that needs its own judgment, tests, or review surface. Described in "The Task Loop".
- **Inline mode**: the plan has 3 or fewer tasks. You execute the steps yourself in this session, still following `opm:tdd-workflow`, still keeping the ledger, and still dispatching a `code-reviewer` subagent once at the end. See "Inline Mode".

Say which mode you are using and why.

## Inline Mode (3 or fewer tasks)

1. Setup as above (branch, ledger, read plan and spec, todos).
2. For each task: follow each step exactly as written, red then green then commit (`opm:tdd-workflow`). Run every verification the step names and read the output. Ledger `Task <N>: complete (commits ...)` after each.
3. After the last task, dispatch one `code-reviewer` subagent with the plan path and `git diff <branch-base>..HEAD`, fix Critical/Important findings yourself in this mode (there is no implementer to resume), and re-run the covering tests.
4. Continue to "Finishing".

If a task turns out to need judgment the plan did not anticipate, or the count grows past 3, switch to subagent mode for the remaining tasks and say so.
