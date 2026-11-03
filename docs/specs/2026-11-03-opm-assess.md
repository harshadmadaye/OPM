# opm:assess: assess a project that already exists

Date: 2026-11-03. Status: approved in chat (part 1), part 2 below for review.

## Problem

Every OPM entry point assumes new work: an idea (`brew-idea`), a feature
(`brainstorming`), a project (`jump-start`). The reviewer agents only read the
current diff, and `code-reviewer` skips unchanged code by rule. Nothing answers
"look at what we have and tell me what to improve", and nothing turns that
answer into fixes through the rest of OPM.

## Goal

`/opm:assess [level] [target]` asks what kind of assessment the developer
wants, runs it with parallel subagents, verifies every finding, writes a ranked
report, then asks what to fix and hands each pick to the right OPM skill on a
fix branch.

Success: a developer with an existing repo gets a verified, file:line-cited,
ranked report for the level they chose, and can pick fixes that flow into
`tdd-workflow`, `writing-plans` + `executing-plans` or `milestone-planning`
without re-explaining anything.

## Non-goals

- No automatic fixing. Assessment is read-only until the developer picks fixes.
- No new hooks, mods or scripts. This is a skill plus agent prompt changes.
- No scoring out of 100. Real gate numbers and verified findings only.

## Shape (approach A)

One skill, `skills/assess/`, with a small core and per-level references:

```
skills/assess/
  SKILL.md                    core: questions, phases, gates, hand-off
  references/architecture.md  architecture lens briefs
  references/code.md          code lens briefs (sweep mode)
  references/feature.md       feature trace briefs
  references/project.md       project = all levels + baseline + deps/docs
  references/verify.md        the verifier brief and finding format
  references/fix-routing.md   bundles, sizing, branch, hand-off
  templates/report.md         the report skeleton
```

Model-invocable (not slash-only), so "review this project" can reach it.

## Levels

| Level | Asks | Lenses |
|---|---|---|
| Architecture | nothing more | boundaries and coupling, layering and data flow, drift from docs/specs, maintainability hotspots (largest files, widest fan-in) |
| Code | whole repo or a path | correctness (`code-reviewer` sweep), the stack reviewer (`typescript-reviewer` sweep, or the stack's patterns skill), `silent-failure-hunter` module sweep, `security-reviewer` |
| Feature | which feature (options from the map) | one trace agent: entry point -> UI -> API -> data -> tests; then the code lenses on the traced files only, plus a test-gap lens |
| Project | nothing more | baseline gates, Architecture lenses, Code lenses on the whole repo, dependencies (outdated, vulnerable, unused), docs (README matches reality) |

## Flow

0. **Ask.** Skipped when `$ARGUMENTS` already answer. Level first (one
   AskUserQuestion), then the level's follow-up. Feature options come from the
   map; "Other" lets the developer name one.
1. **Map.** One Explore subagent writes a fact sheet: stack, layout, entry
   points, feature list, test setup, size (files, lines). Also runs the
   `compound-learnings` retrieval for `docs/solutions/`.
2. **Baseline** (Code, Project). The full-loop gates from
   `verification-before-completion/references/full-loop.md`, read-only. Record
   numbers. A failing gate is a finding, not a stop.
3. **Lenses.** Parallel subagents in one message, each given the fact sheet and
   its brief. Project level on a repo over about 500 source files or more than
   6 lenses: offer a Workflow with the agent count first; run it only on yes,
   otherwise run the subagents in two waves.
4. **Verify.** One verifier subagent per lens result re-reads each cited
   location. Drops what it cannot confirm; marks the rest CONFIRMED or
   PLAUSIBLE.
5. **Rank and bundle.** IDs F1..Fn, ordered by severity (CRITICAL, HIGH,
   MEDIUM, LOW) then effort (S, M, L). Bundles: Critical fixes, Quick wins
   (S effort, MEDIUM+), Refactors (M/L), Test gaps, Other.
6. **Report.** `docs/assessments/YYYY-MM-DD-<level>[-<target>].md` from the
   template, plus a private artifact page with the same content. When an
   earlier report for the same level exists, add Fixed / New / Still open.

## Finding format (shared)

Every lens returns findings as:

```
- severity: CRITICAL | HIGH | MEDIUM | LOW
  title: <one line>
  file: <path>:<line>
  evidence: <what the code does, quoted or paraphrased>
  fix: <the change, one or two sentences>
  effort: S (<1h) | M (<1 day) | L (more)
  lens: <lens name>
```

## Part 2: fix hand-off

7. **Ask what to fix.** One AskUserQuestion, multi-select, options are the
   non-empty bundles with their counts (max 4; "Other" accepts finding IDs
   like `F3 F7` or "none").
8. **Branch.** If anything was picked: when on the default branch, create
   `fix/assess-<date>-<level>`; otherwise ask whether to use the current
   branch. The report is the first commit on it. Commits use the repo's git
   identity; the skill never changes it.
9. **Route.** Size the picked findings as one batch:
   - only S-effort items, each about one file -> `opm:tdd-workflow` per item,
     in order;
   - up to about 8 tasks -> `opm:writing-plans` with the findings as the spec
     (the report path is the spec), then `opm:executing-plans`;
   - more, or any L item touching architecture -> `opm:milestone-planning`.
   Each finding's ID goes in its task title so the next assessment can mark it
   fixed.
10. **Close.** `opm:verification-before-completion` runs before anything is
    called done, as everywhere else.

No pick: the report is still offered as a commit; nothing else happens.

## Agent changes

- `code-reviewer`, `typescript-reviewer`: add **Sweep mode**. When the brief
  names paths (or says sweep), review those files in full instead of a diff;
  the "skip unchanged code" rule does not apply. Output uses the shared
  finding format when the brief asks for it.
- `silent-failure-hunter` already sweeps a module; `security-reviewer` already
  greps the repo. Unchanged.

## Integration

- `using-opm` size table gains a row: `existing | assess, audit or review what
  is already built | opm:assess`. Workflow Map gains one line.
- `tests/fixtures/trigger-prompts.json` gains prompts for `existing`;
  `tests/routing.test.js` adds the size class and front-door skill.
- README: skill list (14 skills), the routing summary, installer next-steps
  line in `bin/install.js`.
- CHANGELOG entry under a new 0.10.0 heading (version bump left to release).
- Token budget: the new description and the using-opm row must keep the
  always-on cost under 2,650; `npm run tokens -- --write` updates
  `docs/why-opm.md`.

## Errors

| Situation | Behaviour |
|---|---|
| No source code in the directory | Stop: "Nothing to assess here; try opm:brew-idea or opm:jump-start." |
| A lens subagent fails or returns nothing | Note it in the report's Run section; continue with the others |
| A baseline gate cannot run (no script) | Record "not configured" as a finding |
| Verifier drops every finding | Report says so; offer nothing to fix |
| Workflow tool unavailable | Run subagents in waves, say so |

## Testing

- Routing and manifest tests cover the new row, fixture and README counts.
- A new `tests/assess-skill.test.js` checks: SKILL.md frontmatter, every
  reference file named in the core exists, the four levels and the hand-off
  skills are named, the report template has the finding fields, and the two
  agents carry a Sweep mode section.
- `npm test` and `npm run tokens` pass.
