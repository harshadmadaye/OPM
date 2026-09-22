---
name: brew-idea
description: Runs a multi-agent debate over a project idea. Four angle agents (product, engineering, skeptic, market research) propose and rebut, one judge ranks features keep / improve / add / cut with a phased plan, and the result becomes a markdown spec plus an easy-to-read HTML page. Use when the developer runs /opm:brew-idea <brief>, says "brew this idea", asks to brainstorm a project with several agents, or wants a project idea improved before designing it.
argument-hint: <project brief>
disable-model-invocation: true
---

# Brew-idea

One brief in, an argued-over feature list and plan out. The developer is
involved at two points: the brief, and approving the result. Everything in
between runs without questions.

**Announce at start:** "Using opm:brew-idea; four angles will argue, one judge decides."

Invocation text is in `$ARGUMENTS`. The workflow script lives next to this
file: `${CLAUDE_PLUGIN_ROOT}/skills/brew-idea/scripts/brew.workflow.js`.
Template: `templates/spec.md`.

This skill needs the Workflow tool. If it is not in the tool list, stop and
say: "brew-idea needs the Workflow tool, which is not available in this
session." Do not imitate the run with Agent calls.

## Gates

| Gate | Passes only when |
|---|---|
| G1 Brief | A brief of about 15 words or more, or the one allowed question was answered |
| G2 Result | The workflow returned `completed: true` |
| G3 Approval | The developer chose "Approve" on the latest revision, not an earlier one |

## Phase 0: parse

1. The brief is all of `$ARGUMENTS`. If it is shorter than about 15 words, ask
   one question: "What should it do, for whom, and on which platform (web,
   mobile, API)?" Append the answer to the brief. No other questions.
2. `projectRoot` is the current directory, absolute.
3. `hasCode` is true when the directory contains source files outside
   `node_modules`, `.git` and `docs` (check for a package manifest or any
   `.ts`, `.js`, `.py`, `.dart`, `.go` file). Say which mode the run is in.
4. `slug`: the directory name when `hasCode`, otherwise the first three
   meaningful words of the brief (skip articles and "app", "for", "with") in
   kebab-case. `date` is today as `YYYY-MM-DD`.
5. Tell the developer: the four angles, that the run asks nothing, that it
   takes roughly ten to twenty minutes, and that the result comes back as a
   page to approve.

## Phase 1: launch

Invoking this skill is the opt-in the Workflow tool requires; do not ask again.

```
Workflow({
  scriptPath: "<plugin root>/skills/brew-idea/scripts/brew.workflow.js",
  args: { projectRoot: "<abs path>", brief: "<brief>", hasCode: <bool> }
})
```

Record the runId. Wait for the task notification; do not poll.

Result shape: `{ completed, reason?, facts, proposals, rebuttals, verdict, missingAngles, silentAngles }`
with `verdict = { vision, features: [{ title, decision, reason, votesFor, votesAgainst, impact, effort }], plan: [{ phase, goal, features, risks }], cut: [{ title, reason }], openQuestions, assumptions }`.

`completed: false` fails G2. Report `reason` and what came back (fact sheet,
proposals, rebuttals), and offer to relaunch. Do not write a spec or a page.

Read the returned object only. Never open a subagent transcript.

## Phase 2: write the spec

Write `docs/specs/<date>-<slug>-brew.md` from `templates/spec.md`:

- Features in the judge's order, one row each, with `votesFor` and
  `votesAgainst` as comma-separated angle names.
- One plan section per phase.
- Every entry in `verdict.cut`.
- `missingAngles` and `silentAngles` become an assumption line each
  (returned nothing, or proposed but never rebutted).
- Angles: one short paragraph per angle from its proposal and rebuttal: its
  position, its strongest idea, what it attacked. An angle in `missingAngles`
  gets "returned nothing".
- Run: angles present, count of ideas with `unverified: true`, revision count.

Keep it tight. The renderer reads it next, and implementers read it later.

## Phase 3: render

Dispatch one renderer and record its agent id, revisions resume it:

```
Agent (subagent_type: general-purpose, model: opus)
description: "Render brew-idea page"
prompt: |
  Render <abs spec path> into <abs projectRoot>/docs/brew/<slug>.html: one
  self-contained page, inline CSS only, no external scripts or stylesheets,
  readable at 400px width, title "<slug> brew". Plain language a non-engineer
  can follow. Sections in this order: "In one line" (the vision), "What we'd
  build" (feature cards grouped by decision, each showing impact, effort, who
  was for and against, and the reason), "Debate highlights" (one who-said-what
  card per notable attack or endorsement, quoting the angle), "Plan" (phases
  in order), "Cut and why", "Open questions", "Assumptions". Mark unverified
  market claims "not checked online". Invent nothing: if the markdown does not
  say it, the page does not show it. Do not commit, do not dispatch subagents.
  Report: sections rendered and anything you could not render and why.
```

If the renderer fails, the spec still exists. Say so and offer to retry.

Publish:
- Artifact tool available: load the `artifact-design` skill, publish
  `docs/brew/<slug>.html` with the title "<slug> brew", and republish the same
  file on every revision so the link never changes.
- No Artifact tool: `open` the file (macOS) or `xdg-open` (Linux).

## Phase 4: approve

Repeat until approved:

1. Share the link and five lines: the vision, the top three features, the
   number cut, the first plan phase.
2. Ask with AskUserQuestion: "Approve" or "Request changes" (free text).
3. On changes: relaunch with the same `scriptPath`, `resumeFromRunId`, and the
   same `args` plus `feedback: "<the developer's text>"`. Scout, propose and
   debate replay from cache; only the judge reruns. Rewrite the spec from the
   new verdict, SendMessage the renderer ("The markdown at <path> changed:
   <what>. Re-render and report."), republish, list what changed in three
   bullets, ask again. Every revision gets its own question.
4. On approval: commit the spec and the page:
   `docs(brew): <slug> brew-idea result`.

## Phase 5: finish

Tell the developer the next step:

- `opm:writing-plans` with the spec path when the project exists and the plan
  fits in a week.
- `opm:milestone-planning` when the plan has several phases.
- `opm:jump-start <name> <brief>` when the project does not exist yet; paste
  the vision and the add features into the brief.
- Optional: `/opm:story-video <path>` turns this into a narrated explainer.

## Errors

| Situation | Do |
|---|---|
| Workflow tool missing | Stop and say so. No Agent-call imitation |
| `completed: false` | Report `reason`, offer to relaunch. No spec, no page |
| `missingAngles` not empty | Continue; note the angle in Assumptions and in the page |
| `silentAngles` not empty | Continue; the judge is told, note it in Assumptions |
| Market angle reports `webSearchUsed: false` | Note in Run that market claims were not checked online |
| Renderer fails | Keep the spec, say so, offer to retry the render |
| Developer interrupts the run | On the next invocation in the same directory, if a runId is known, relaunch with `resumeFromRunId` |

## Red flags

| Thought | Reality |
|---|---|
| "I'll run the angles with Agent calls, Workflow is overhead" | The workflow is the contract: fixed rounds, resume on change requests. Stop if it is missing. |
| "The skeptic only says no, the judge can skip it" | Every high-severity attack gets a mitigation or the feature is cut. That is the point of the skeptic. |
| "I'll render the HTML myself" | Dispatch the renderer on opus. The main thread writes markdown, not SVG. |
| "They approved the last version, this tweak is fine" | Every revision gets its own approval question. |
| "The market claims sound right, no need to flag" | Unverified stays unverified in the spec and on the page. |
| "One quick question to the developer mid-run" | The run asks nothing. The judge lists open questions instead. |

## Safety

- Read-only against the project: the run creates nothing outside `docs/specs/`
  and `docs/brew/`, and commits only on approval.
- Nothing leaves the machine except the market angle's web searches and the
  artifact publish, which is private by default.
