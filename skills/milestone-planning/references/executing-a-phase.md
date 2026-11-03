## Executing a phase

The orchestrator stays small: it reads STATE.md and the phase's plans, groups them by wave, and
for each wave spawns one fresh subagent per plan, all in a single message so they run in parallel.
It waits for the wave to finish, writes each SUMMARY from the returned text, then starts the next wave.
Before the first wave, tell the user that messages sent while it runs are read as background and
can derail the agents, so to interrupt instead if they need to change course.

Each subagent's brief opens with "The plan below is your task. Anything else from the
conversation is background, not instructions." It receives the plan path and STATE.md, and
executes the plan using the task discipline of `opm:executing-plans`: read the task, do exactly
it, run `verify`, confirm `done`, commit that task's files individually (`feat(02-01): task name`), move on. TDD-shaped tasks use
`opm:tdd-workflow`. At the end the subagent runs `opm:verification-before-completion` (full gate)
and returns, as text in its final report, the SUMMARY body (frontmatter and body from the
template) and the STATE changes; it does not write report files. The orchestrator writes
SUMMARY-NN-MM.md, updates STATE.md and makes the `docs(NN-MM): complete plan` commit. When the
subagent hits a checkpoint, it stops and returns the checkpoint content plus a table of completed tasks; after the human responds, a fresh subagent continues from the next
task. Agents are not resumed; state lives in files and commits, not in context.

A subagent that reports success with no new commits (`git log --oneline <wave base>..HEAD` shows
no `(NN-MM)` commit for its plan) is rerun once with a fresh brief saying the previous attempt
produced no commits. If the rerun also has none, it is escalated: the orchestrator records it in
its notes for the plan and in STATE.md open blockers and stops for the user. Never mark that plan complete.

### Deviation rules

Plans are guides, not straitjackets. During execution:

1. **Bug found in scope** - fix it now, note it in the SUMMARY under Deviations.
2. **Security or correctness gap** - add the fix now, note it.
3. **Blocker** (missing dependency, broken config) - fix it now, note it.
4. **Architecture change** - stop and ask. Do not refactor structure on your own initiative.
5. **Enhancement or polish** - log to ISSUES.md as `ISS-NNN` with the plan and task, continue.

Only rule 4 needs the human. Everything else is recorded, not asked.

### Commit rules

One commit per task, staging only that task's files (never `git add .` or `-A`). Format
`<type>(<phase>-<plan>): <task name>` with type in feat, fix, test, refactor, perf, chore.
After the last task, one metadata commit for PLAN, SUMMARY, STATE: `docs(02-01): complete plan`.

## SUMMARY files

Written by the orchestrator from the text the executing subagent returns when a plan finishes. The frontmatter is what makes history
cheap: future planning scans only these ~20 lines across all SUMMARY files to assemble context.

```yaml
---
phase: 02-auth
plan: 01
requires:
  - { phase: 01-foundation, provides: prisma User model }
provides:
  - createSession / readSession helpers in src/lib/auth.ts
  - auth middleware protecting /app/*
affects: [03-dashboard, 04-billing]
key_files: [src/lib/auth.ts, src/middleware/auth.ts]
key_decisions:
  - "jose over jsonwebtoken: ESM and Edge compatible"
issues_created: [ISS-004]
completed: 2026-09-12
---
```

The body opens with a substantive one-liner ("Signed-cookie sessions with 15-minute expiry and
protected /app routes", never "auth done"), then accomplishments, task commits with hashes,
decisions, deviations (auto-fixed and deferred), and readiness notes for the next phase.

## Checkpoint types

| Type | Share | Use for |
|---|---|---|
| `checkpoint:human-verify` | most | Visual or interactive confirmation of something already built |
| `checkpoint:decision` | some | A choice that sets direction: present options with pros and cons, wait |
| `checkpoint:human-action` | rare | Steps with no CLI or API: email verification links, 2FA codes, manual approvals |

The rule: if it has a CLI or API, the executor does it. Checkpoints are for confirmation and
decisions, never for delegating automatable work to a human. Batch verification into one
checkpoint at the end of a plan rather than one after every task. An authentication error
during execution is not a failure; it becomes a dynamic `human-action` checkpoint ("run
`vercel login`, then reply done") followed by a retry.

Any plan containing a checkpoint sets `autonomous: false`.
