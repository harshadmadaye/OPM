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

### ISSUES.md

Numbered list of deferred work discovered during execution: `ISS-007: add rate limiting to
login (found in 02-01, Task 2)`. Reviewed when planning each new phase.

### Commit rules

One commit per task, staging only that task's files (never `git add .` or `-A`). Format
`<type>(<phase>-<plan>): <task name>` with type in feat, fix, test, refactor, perf, chore.
After the last task, one metadata commit for PLAN, SUMMARY, STATE: `docs(02-01): complete plan`.

### Closing the phase: review pack

At phase close the orchestrator writes REVIEW-PACK.md in the phase folder (template:
`templates/review-pack.md`). Run `node skills/milestone-planning/scripts/review-pack.js <base>..<head>`
on the phase's range, fill 2 or 3 "explain how X handles Y" questions per item from the diff, add
the review findings table and what went differently than planned, and commit it. With review
cadence after each phase, wait for the developer to say they read it before planning the next
phase; with "only at the end", write it and continue.

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

### Unattended runs

An unattended run is jump-start, or a run the developer told to proceed without them (including
review cadence "only at the end"). There, a `checkpoint:human-verify` neither stops the run nor is
ticked by an agent. The orchestrator appends a row to
`docs/milestones/<milestone>/REVIEW-QUEUE.md` (template: `templates/review-queue.md`) with the
checkpoint's what and how to verify and links to the evidence, then continues. A queued check does
not block the next plan unless a later plan depends on what it verifies; that plan waits. Only a
person sets a row to passed or failed. STATE.md reads "complete, N human checks pending" while any
row is pending. `checkpoint:decision` and `checkpoint:human-action` are unchanged.

### Review cadence

Ask once at Start: after each phase (default; pause at each phase close until the developer has read REVIEW-PACK.md) or only at the end (no pauses; review packs are still written). For "only at the end", show the expected commit count and log the choice as a decision. Expected commits: planned tasks plus one metadata commit per plan. Before plans exist, estimate phases x 3 plans x 4 commits and say it is an estimate.

## Anti-patterns

- A STATE.md over 100 lines (it stopped being a digest).
- Plans with one huge task or more than three tasks.
- Horizontal phases (all models, then all APIs).
- `depends_on` set by numbering rather than by consumption.
- A checkpoint after every task.
- Asking the human to do something a CLI can do.
- Resuming an old subagent instead of spawning a fresh one from files.
