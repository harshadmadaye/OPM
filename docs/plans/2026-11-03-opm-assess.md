# opm:assess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use opm:executing-plans to implement this plan task-by-task. Each task follows opm:tdd-workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/opm:assess`, which asks what kind of assessment to run on an existing project, runs verified parallel lenses, writes a ranked report, and routes picked fixes into existing OPM skills on a fix branch.

**Architecture:** One skill (`skills/assess/`) with a small core and per-level `references/` files, loaded on demand. The diff-only reviewer agents gain a Sweep mode so they can review whole files. `using-opm` routes an `existing` size class to it.

**Tech Stack:** Markdown skills and agents; Node `node:test` for structural tests.

**Spec:** docs/specs/2026-11-03-opm-assess.md

## Global Constraints

- Always-on cost stays under 2,650 tokens (`npm run tokens`).
- The assess SKILL.md core stays under the 1,200-token soft cap (about 4.8 KB).
- Skill description: one sentence of what it does plus "Use when ..."; no XML.
- Plain, short sentences in skill text (house style of the other skills).
- Commits are made with the repo's configured identity (Vatsal Motiani); end messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm test` stays green after each task.

---

### Task 1: Sweep mode for code-reviewer and typescript-reviewer

**Files:**
- Modify: `agents/code-reviewer.md` (Review Process step 1; Confidence-Based Filtering "Skip issues in unchanged code" line)
- Modify: `agents/typescript-reviewer.md` (Procedure step 1 and step 5)
- Test: `tests/assess-skill.test.js` (create)

**Interfaces:**
- Produces: both agents contain a `## Sweep mode` heading. When the brief names paths or says "sweep", they review those files in full, do not stop for a missing diff, and drop the unchanged-code rule. When the brief asks for the assess finding format, they use it.

- [ ] Step 1: Write the failing test `tests/assess-skill.test.js` with a test that both agent files contain `## Sweep mode` and the word `paths`.
- [ ] Step 2: Run `node --test tests/assess-skill.test.js`; expect FAIL (no Sweep mode).
- [ ] Step 3: Add the Sweep mode section to both agents and point the diff steps at it.
- [ ] Step 4: Run the test; expect PASS. Run `npm test`.
- [ ] Step 5: Commit `feat(agents): sweep mode for whole-file reviews`.

### Task 2: The assess skill

**Files:**
- Create: `skills/assess/SKILL.md`
- Create: `skills/assess/references/{architecture,code,feature,project,verify,fix-routing}.md`
- Create: `skills/assess/templates/report.md`
- Modify: `tests/assess-skill.test.js`

**Interfaces:**
- Consumes: Sweep mode from Task 1.
- Produces: skill `opm:assess`, `argument-hint: [architecture|code|feature|project] [target]`, model-invocable. Report path `docs/assessments/YYYY-MM-DD-<level>[-<target>].md`. Fix branch `fix/assess-<date>-<level>`.

- [ ] Step 1: Add tests: frontmatter `name: assess` and a description containing "Use when"; every `references/*.md` and `templates/*.md` path named in SKILL.md exists; SKILL.md names the four levels and the hand-off skills `opm:tdd-workflow`, `opm:writing-plans`, `opm:executing-plans`, `opm:milestone-planning`, `opm:verification-before-completion`; the template contains `severity`, `file`, `evidence`, `fix`, `effort`; the core is under 4,800 bytes.
- [ ] Step 2: Run; expect FAIL (no skill).
- [ ] Step 3: Write the core, references and template per the spec's Flow, Levels, Finding format, Part 2 and Errors sections.
- [ ] Step 4: Run the test; expect PASS. Run `npm test` (the manifest README check will fail until Task 3; that is expected only for `README does not list assess`).
- [ ] Step 5: Commit `feat(assess): assess an existing project and route fixes` together with Task 3 if the manifest check is red.

### Task 3: Route to it and document it

**Files:**
- Modify: `skills/using-opm/SKILL.md` (size table row `existing`; Workflow Map line)
- Modify: `tests/fixtures/trigger-prompts.json` (add 4 `existing` prompts, total 34)
- Modify: `tests/routing.test.js` (`SIZE_CLASSES` add `existing`, `FRONT_DOOR_SKILLS` add `assess`, `FIXTURE_LENGTH` 34)
- Modify: `README.md` (All 14 skills, `assess` row, layout count 14, reviewer descriptions mention sweep)
- Modify: `bin/install.js` (next-steps line for `/opm:assess`)
- Modify: `scripts/evals/trigger-eval.js` (prompt count text 34)
- Modify: `CHANGELOG.md` (Unreleased entry)
- Modify: `docs/why-opm.md` via `npm run tokens -- --write`

- [ ] Step 1: Update `tests/routing.test.js` constants and the fixture; run; expect FAIL (no `existing` row).
- [ ] Step 2: Add the using-opm row and map line; run routing tests; expect PASS.
- [ ] Step 3: README, installer, eval text, CHANGELOG.
- [ ] Step 4: `npm test` all green; `npm run tokens` under ceiling; `npm run tokens -- --write`.
- [ ] Step 5: Commit `feat(using-opm): route existing projects to opm:assess`.
