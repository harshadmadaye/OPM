# State Template

Save as `docs/milestones/<milestone>/STATE.md`. Read first in every session; update after every
plan completes and at every phase boundary. Keep it under 100 lines: it is a digest, not a log.

```markdown
# <Milestone> State

**Goal:** [One line: the outcome this milestone delivers]
**Current focus:** Phase [N] - [name]

## Position

Phase: [N] of [total] ([name])
Plan: [A] of [B] in this phase
Status: [Ready to plan | Planning | Ready to execute | Executing | Phase complete]
Last activity: [YYYY-MM-DD] - [what happened]
Progress: [completed plans] / [total plans]

## Recent decisions

- [NN-MM]: [decision and one-line rationale]
- [NN-MM]: [decision and one-line rationale]
- [NN-MM]: [decision and one-line rationale]

(Full rationale lives in the SUMMARY files. Keep the last three to five here.)

## Open blockers

- [Blocker, phase of origin, what would unblock it]

None.

## Deferred issues

[count] open - see ISSUES.md. Most relevant to the next phase:
- ISS-NNN: [one line]

## Session continuity

Last session: [YYYY-MM-DD HH:MM]
Stopped at: [last completed action, e.g. "02-01 Task 2 committed; Task 3 not started"]
Next: [the single next action, e.g. "execute PLAN-02-01 from Task 3"]
```

## Update rules

- After each plan: position, last activity, progress, new decisions, new issues.
- After each phase: focus, progress, clear resolved blockers, prune decisions older than five.
- Never let it grow past 100 lines. Move detail into SUMMARY files or ISSUES.md.

<!-- Adapted from gsd-build/get-shit-done (MIT) -->
