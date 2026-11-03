---
name: assess
description: Assesses an existing project at a chosen level (architecture, code, feature, project) with verified parallel reviewers, writes a ranked report, then routes chosen fixes into OPM skills. Use when asked to assess, audit or review what is already built.
argument-hint: [architecture|code|feature|project] [target]
---

# Assess

Read-only until the developer picks fixes. Every finding cites file:line and
survives a verify pass, or it is dropped.

**Announce at start:** "Using opm:assess to assess <level> of this project."

## Gates

| Gate | Passes only when |
|---|---|
| G1 Scope | Level chosen; Feature has a feature, Code has whole repo or a path |
| G2 Verified | Every reported finding is CONFIRMED or PLAUSIBLE by the verifier |
| G3 Fix pick | The developer chose bundles or IDs; "none" ends the run |

## Phase 0: ask

Skip any question `$ARGUMENTS` already answers. One question per message.

1. Level, one AskUserQuestion:
   - **Architecture**: boundaries, coupling, layering, drift from docs.
   - **Code**: correctness, errors, types, security, test gaps.
   - **Feature**: one feature traced end to end.
   - **Project**: all of the above plus build, deps and docs health.
2. Code: "Whole repo or a path?" Feature: ask after the map, options are its
   feature list.

No source files (no manifest, no `.ts .js .py .dart .go` outside
`node_modules`, `.git`, `docs`): stop and suggest `opm:brew-idea` or
`opm:jump-start`.

## Phase 1: map

One Explore subagent: stack, layout, entry points, feature list (routes,
screens, commands, modules), test setup, file and line counts. Also read
`docs/solutions/` for learnings that touch the scope, and the latest
`docs/assessments/*-<level>*.md` if one exists.

## Phase 2: baseline (Code, Project)

Run the gates in `verification-before-completion/references/full-loop.md`
read-only and record the numbers. A failing or missing gate is a finding,
not a stop. Never fix during assessment.

## Phase 3: lenses

Read the level's reference: `references/architecture.md`,
`references/code.md`, `references/feature.md` or `references/project.md`.
Dispatch its lenses as parallel subagents in one message, each with the fact
sheet, the scope and its brief, asking for the finding format in
`references/verify.md`. Announce: "Using N parallel subagents to ...".

Project level on more than about 500 source files or more than 6 lenses:
offer a Workflow with the agent count; run it only on yes, else run two waves.
A lens that fails is noted in the report, not retried more than once.

## Phase 4: verify

Read `references/verify.md`. One verifier per lens result re-reads each cited
line. Drop what it cannot confirm. If nothing survives, say so and stop.

## Phase 5: report

IDs F1..Fn, sorted by severity then effort. Bundle: Critical fixes, Quick
wins, Refactors, Test gaps, Other. Fill `templates/report.md` into
`docs/assessments/YYYY-MM-DD-<level>[-<target>].md`. With an earlier report,
fill Fixed / New / Still open. Publish the same content as a private
artifact page and give the link. Show the top five findings in chat.

## Phase 6: fix hand-off

Read `references/fix-routing.md`. In short:

1. Ask, multi-select: the non-empty bundles with counts; "Other" takes IDs
   (`F3 F7`) or "none".
2. Branch: on the default branch, create `fix/assess-<date>-<level>`;
   otherwise ask whether to use the current one. Commit the report first,
   with the repo's own git identity.
3. Route the picked findings as one batch:
   - only S-effort, about one file each -> `opm:tdd-workflow` per finding;
   - up to about 8 tasks -> `opm:writing-plans` with the report as the spec,
     then `opm:executing-plans`;
   - more, or an L architecture change -> `opm:milestone-planning`.
   Put the finding ID in each task title.
4. `opm:verification-before-completion` before anything is called done.

"none": offer to commit the report; stop.

## Red flags

| Thought | Reality |
|---|---|
| "I'll fix this one while I'm here" | Assessment is read-only. It goes in the report. |
| "The lens said so, report it" | Unverified findings are dropped. |
| "Give it a score out of 10" | Report gate numbers and findings, not a grade. |
| "Run every lens for Feature" | Feature runs only on the traced files. |
