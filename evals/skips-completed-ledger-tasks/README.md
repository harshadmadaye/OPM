# skips-completed-ledger-tasks

Rule: "Tasks with `Task <N>: complete` are DONE: never re-dispatch them."
Section: "Setup" step 2 (Ledger check) in `skills/executing-plans/SKILL.md`; resume detail in `skills/executing-plans/references/setup.md`.

Setup: a three-task plan on branch feat/greet. The ledger, with real commit hashes, marks Task 1 complete and its files are committed. Tasks 2 and 3 are untouched.

Graded on: no Agent dispatch carries Task 1's text, no Write or Edit touches Task 1's files, the ledger keeps exactly one `Task 1:` line, src/shout.js exists (all deterministic), and the final message says Task 1 was skipped (LLM).

Limitation: the plan has three tasks, so executing-plans may choose inline mode and dispatch no subagents; the Write/Edit/ledger graders cover that path. A Bash heredoc that rewrites Task 1's files would slip past the tool graders (the ledger and LLM graders are the backstop). The case also cannot see git history, so a rebuilt-identical Task 1 commit is invisible.
