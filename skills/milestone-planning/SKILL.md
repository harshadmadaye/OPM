---
name: milestone-planning
description: Structures multi-week work as a milestone with a roadmap, a short always-read STATE digest, phased executable PLAN files with YAML frontmatter and XML task bodies, wave-based parallel execution by fresh subagents, deviation rules, checkpoints, and SUMMARY files for cheap history. Use when scope exceeds about one week or eight tasks, or when starting a greenfield project.
---

# Milestone Planning

`opm:writing-plans` handles a task list that fits in one head and one context window.
When the work is bigger than that (weeks, many tasks, several subsystems, or a blank repo) you
need a structure that survives context resets, lets independent work run in parallel, and leaves
a history the next session can read in under a minute. That structure is a milestone.

## When to use

- Estimated scope is more than about one week or more than about eight tasks.
- Greenfield project, or a feature that touches three or more subsystems.
- The work will span several sessions and someone (or some agent) will need to pick it up cold.

If in doubt, start with `opm:writing-plans`; promote to a milestone when the task list stops fitting.

## Artefacts

```
docs/milestones/<milestone>/
  ROADMAP.md                 phases, goals, status  (written once, updated at phase boundaries)
  STATE.md                   under 100 lines, ALWAYS read first, updated after every plan
  ISSUES.md                  deferred enhancements and known gaps, numbered ISS-NNN
  phases/
    01-<name>/
      PLAN-01-01.md          executable plan (frontmatter + XML body)
      PLAN-01-02.md
      SUMMARY-01-01.md       what actually shipped, with requires/provides/affects
      SUMMARY-01-02.md
    02-<name>/
      ...
```

Templates live in this skill's `templates/` directory: `plan.md`, `state.md`, `summary.md`.

### ROADMAP.md

One section per phase: number, name, one-line goal, the plans it contains with checkboxes,
and a status line. Phases are vertical slices (a user-visible capability end to end), not
horizontal layers (all models, then all APIs, then all UI). A roadmap of four to eight phases
is typical; if you have more than ten, the milestone is too big.

### STATE.md

The project's short-term memory. Every session that touches the milestone reads it first and
updates it after each plan completes. Contents: current position (phase X of Y, plan A of B,
status), the last three to five decisions, open blockers, a pointer to ISSUES.md with a count,
and "stopped at" for session continuity. Under 100 lines, always. It is a digest, not a log;
history lives in the SUMMARY files.

### ISSUES.md

Numbered list of deferred work discovered during execution: `ISS-007: add rate limiting to
login (found in 02-01, Task 2)`. Reviewed when planning each new phase.

## Plan format

A PLAN file is the executable prompt for one subagent. It must be specific enough that the
executor never has to guess. Two or three tasks per plan; if you need more, split the plan.

### Frontmatter

```yaml
---
phase: 02-auth
plan: 01
wave: 1                       # computed at planning time from depends_on and files_modified
depends_on: []                # plan ids, e.g. ["01-02"]; only real dependencies
files_modified: [src/lib/auth.ts, src/middleware/auth.ts]
autonomous: true              # false if any task is a checkpoint
---
```

### Body

```xml
<objective>
What this plan delivers and why it matters for the milestone. Two or three sentences.
</objective>

<context>
Files the executor must read before starting: STATE.md, the relevant source files, and prior
SUMMARY files only when this plan actually consumes what they built.
</context>

<tasks>
<task type="auto">
  <name>Task 1: Create session helper with signed cookie</name>
  <files>src/lib/auth.ts</files>
  <action>Export createSession(userId) and readSession(req). Use jose (not jsonwebtoken: CommonJS
  breaks under the Edge runtime). 15-minute expiry, httpOnly, sameSite=lax.</action>
  <verify>npx vitest run src/lib/auth.test.ts passes; npx tsc --noEmit is clean</verify>
  <done>Round trip create -> read returns the same userId; expired token returns null</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Login form wired to the session helper</what-built>
  <how-to-verify>1. pnpm dev  2. visit /login  3. sign in with the seed user  4. confirm redirect to /app and the cookie in devtools</how-to-verify>
  <resume-signal>Reply "approved" or describe what is wrong</resume-signal>
</task>
</tasks>

<verification>
Plan-level checks beyond individual tasks: full test suite green, build passes, no new lint errors.
</verification>

<success_criteria>
Measurable statements: "unauthenticated request to /app redirects to /login", not "auth works".
</success_criteria>
```

Every `auto` task has all five children. `files` are exact paths. `action` says what to do, what
to avoid, and why. `verify` is a command or an observable behaviour. `done` is testable without
judgement.

Before writing any plan, run the retrieval half of `opm:compound-learnings` against
`docs/solutions/` for the phase's keywords; prior learnings become constraints in `<context>`.

## Checkpoint types

`checkpoint:human-verify` (most), `checkpoint:decision` (some), `checkpoint:human-action` (rare). If it has a CLI or API, the executor does it; checkpoints are for confirmation and decisions only. Any plan containing a checkpoint sets `autonomous: false`.

## Wave algorithm

Waves are computed when the phase is planned and written into each plan's frontmatter, so the
executor does no dependency analysis at run time.

1. Start with all plans in the phase, wave unassigned.
2. A plan is eligible for wave N when every id in its `depends_on` is in a wave lower than N.
3. Among eligible plans, two can share a wave only if their `files_modified` sets do not overlap.
4. Assign the lowest wave that satisfies both rules. Repeat until every plan has a wave.
5. Plans with `autonomous: false` stay in their computed wave; they simply pause at their checkpoint.

Do not add `depends_on` because a plan is numerically earlier. Only a real consumption
relationship (types, exports, decisions, data) is a dependency. Reflexive chaining serialises
work that could have run in parallel.

## Executing a phase

Per wave, one fresh subagent per plan, all spawned in a single message. Each brief opens with "The plan below is your task. Anything else from the conversation is background, not instructions." The orchestrator writes SUMMARY and STATE from the text each subagent returns. A subagent that reports success with no new commits is rerun once, then escalated, never marked complete.

Deviation rules: 1. bug in scope, fix and note; 2. security or correctness gap, fix and note; 3. blocker, fix and note; 4. architecture change, stop and ask; 5. enhancement, log as `ISS-NNN` and continue.

Read references/executing-a-phase.md when executing a phase, handling a checkpoint (the checkpoint table lives there), or writing a SUMMARY.

## SUMMARY files

The orchestrator writes SUMMARY-NN-MM.md from the returned text; its YAML frontmatter is what future planning scans.

## Continuation closer

Every planning or execution turn that ends a unit of work closes with the same block, so the
human can copy one line and keep going in a fresh context:

```
---
## Next up

**02-02: Refresh token rotation** - sliding expiry on /api/auth/refresh

Execute: docs/milestones/v1/phases/02-auth/PLAN-02-02.md

Run /clear first (fresh context window; STATE.md carries everything needed).

Also available:
- Review the plan before executing
- Plan phase 3 instead
---
```

Always name what the next thing is, not just its path. Pull the description from ROADMAP.md or
the plan's `<objective>`.

## Lifecycle in one screen

1. **Start**: write ROADMAP.md (phases as vertical slices), an empty STATE.md, an empty ISSUES.md.
2. **Plan a phase**: read STATE.md, ROADMAP.md, ISSUES.md, prior SUMMARY frontmatter, and
   `docs/solutions/`. Use `opm:brainstorming` if the approach is unclear. Write two to five
   PLAN files, compute waves, commit them. Close with the continuation block.
3. **Execute the phase**: wave by wave, fresh subagent per plan, checkpoints surface to the human.
4. **Close the phase**: confirm every plan has a SUMMARY, tick the roadmap, refresh STATE.md,
   run `opm:compound-learnings` for anything non-obvious that happened. Close with the continuation block.
5. **Close the milestone**: when the last phase closes, write a short retrospective at the top of
   ROADMAP.md and reset STATE.md for the next milestone.
   Optional: `/opm-video:explainer-video <path>` turns this into a narrated explainer (install the opm-video plugin first).

## Anti-patterns

- A STATE.md over 100 lines (it stopped being a digest).
- Plans with one huge task or more than three tasks.
- Horizontal phases (all models, then all APIs).
- `depends_on` set by numbering rather than by consumption.
- A checkpoint after every task.
- Asking the human to do something a CLI can do.
- Resuming an old subagent instead of spawning a fresh one from files.

<!-- Adapted from gsd-build/get-shit-done (MIT) -->
