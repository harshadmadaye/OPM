# Review Queue Template

The orchestrator saves this as `docs/milestones/<milestone>/REVIEW-QUEUE.md`. It holds the
`checkpoint:human-verify` items an unattended run could not pass on a person's behalf. A missing
file means no pending checks.

```markdown
# <Milestone> Review Queue

| ID | Plan | What to check | How to check | Evidence | Status | Checked by |
|---|---|---|---|---|---|---|
| RQ-001 | 02-03 | [what the checkpoint asks a person to confirm] | 1. [step] 2. [step] | [links to logs, test output, screenshots under the milestone folder] | pending | |
```

## Rules

- Path: `docs/milestones/<milestone>/REVIEW-QUEUE.md`. One row per check, ID `RQ-NNN`.
- How to check: the numbered steps from the checkpoint's how-to-verify.
- Evidence: links to logs, test output and screenshots saved under the milestone folder.
- Status is `pending`, `passed` or `failed`. Only a person sets Status to passed or failed, and
  writes their name in Checked by. No agent, orchestrator or subagent ever does.
- The orchestrator appends the row when a subagent returns a human-verify checkpoint in an
  unattended run, then continues. Subagents never write this file.
- A failed row becomes an ISSUES.md entry or a fix plan.
- STATE.md shows "complete, N human checks pending" while any row is pending.
