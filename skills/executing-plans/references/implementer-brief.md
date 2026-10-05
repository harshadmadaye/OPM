**Why subagents:** an implementer with isolated context stays focused and succeeds because you construct exactly what it needs. It never inherits your session's history. This also keeps your own context clean for coordination.

**Batch small same-shape work.** If several tasks are each a tiny independent edit of the same kind (the same constant change across files), compose ONE brief listing every file and its change, dispatch one implementer, and review the diff as one unit.

**Never dispatch two implementers in parallel** on the same branch; they conflict.

### 1. Compose the brief and dispatch the implementer

Record `BASE=$(git rev-parse HEAD)` before dispatching.

The brief is the single source of requirements. It contains, and only contains:
1. One line on where this task fits in the project.
2. The task's full text from the plan, copied verbatim (Files, Interfaces, every step with its code blocks).
3. The plan's Global Constraints block, verbatim.
4. The Produces entries of earlier tasks this task Consumes, with any deviation the implementer of those tasks reported.
5. Relevant file paths to read (the files this task touches, plus one or two exemplars of the codebase's patterns).
6. Your resolution of any ambiguity you noticed in the task, and any parked finding in the area this task touches.

**Never** paste the whole plan, the spec, prior-task summaries, or chat history. A real session's dispatch hit 42k chars of which 99% was pasted history. Exact values (numbers, magic strings, signatures, test cases) live in the task text; do not paraphrase them.

Record the implementer's agent identity from the dispatch result; fix rounds 1-2 resume it.

#### Implementer prompt template

```
Agent (subagent_type: general-purpose, model: <per Model Selection>)
description: "Implement Task N: <task name>"
prompt: |
  You are implementing Task N: <task name>, one task of a larger plan.
  Work from: <repo root>. Branch: <branch>.

  ## Where this fits
  <one line>

  ## Your task (requirements, exact values are binding)
  <task text verbatim from the plan>

  ## Global constraints
  <verbatim block>

  ## Interfaces from earlier tasks
  <Produces entries this task consumes>

  ## Files to read first
  <paths>

  ## Rules
  - Follow the steps in order. TDD is mandatory (opm:tdd-workflow): write
    the failing test, run it and see it fail, implement minimally, run it
    and see it pass, commit. Do not skip the red step.
  - Run the focused test while iterating; run the full suite once before
    the final commit.
  - Do NOT dispatch subagents of your own, and never spawn a reviewer.
    A reviewer is already scheduled by the controller after you report.
  - Follow the file structure in the task. If a file you are creating grows
    beyond the task's intent, stop and report DONE_WITH_CONCERNS rather
    than splitting it on your own.
  - Do not restructure code outside your task. Follow existing patterns.
  - It is always OK to stop and say this is too hard. Bad work is worse
    than no work. Escalate with BLOCKED or NEEDS_CONTEXT when: the task
    needs an architectural decision with several valid answers; you need
    code context you cannot find; you are reading file after file without
    progress.

  ## Self-review before reporting
  Completeness: every requirement implemented? Edge cases? Quality: clear
  names, clean code? Discipline: nothing beyond what was asked (YAGNI),
  existing patterns followed? Tests: verify real behavior, not mocks;
  output pristine (no stray warnings)? Fix what you find before reporting.

  ## Report (under 15 lines)
  - Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
  - Commits: short SHA + subject, each
  - Tests: command run, RED output summary, GREEN output summary
    (e.g. "14/14 passing, output pristine")
  - Deviations from the task text or Interfaces block, if any
  - Concerns, if any
  If BLOCKED or NEEDS_CONTEXT: what you are stuck on, what you tried,
  what you need.
```

### 2. Handle the report

- **DONE:** proceed to review.
- **DONE_WITH_CONCERNS:** read the concerns. Correctness or scope concerns get addressed before review; observations ("this file is getting large") are noted in the ledger and review proceeds.
- **NEEDS_CONTEXT:** provide the missing context and re-dispatch.
- **BLOCKED:** change something. Context problem: add context, same model. Reasoning problem: more capable model. Too large: split it. Plan is wrong: rule on the correction, ledger it, re-dispatch with the ruling in the brief. Never re-run the same dispatch unchanged.

Before review, confirm independently that commits exist: `git log --oneline BASE..HEAD`. An implementer report is a claim (see `opm:verification-before-completion`).
