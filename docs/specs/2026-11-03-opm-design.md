# opm-design

Date: 2026-11-03
Status: approved design, awaiting implementation plan

## Goal

An optional OPM add-on plugin, `opm-design`, that gives Claude a design workflow for UI work:
a direction and quality floor before code, a portable design system, mapped user flows before
screens, and an independent visual review with screenshots after the build.

```
claude plugin install opm-design@opm
/opm-design:frontend-design   /opm-design:design-system   /opm-design:ux-flows
```

## Why the design looks like this

- Core OPM's always-on cost is 2,526 tokens against a CI ceiling of 2,650. Three skills and an
  agent in core would breach it, so design ships as a sub-plugin like `opm-video` and costs core
  sessions only a one-line pointer.
- Research on 2026-11-03 (hallmark, ux-flow-designer, stitch-skills, agents-best-practices,
  impeccable, anthropics/skills, ui-ux-pro-max, knowledge-work-plugins, vercel-labs
  web-interface-guidelines, addyosmani/web-quality-skills, metaswarm, playwright-skill) showed the
  same gaps in OPM: no design direction, no anti-AI-slop rules, no design tokens, no flow mapping,
  and no way for Claude to see what it rendered.
- The rules are written once (`shared/craft-floor.md`) and read by every skill and the agent, so
  they cannot drift apart.

## Decisions

| Question | Decision |
|---|---|
| Packaging | Sub-plugin `plugins/opm-design`, listed in the `opm` marketplace on the core version |
| v1 scope | `frontend-design`, `design-system`, `ux-flows` skills and a `design-reviewer` agent with visual QA |
| Platforms | Web first (HTML, CSS, Tailwind, React). Rules are platform-neutral; `flutter.md` maps them to ThemeData. No Flutter visual QA in v1 |
| Visual QA tooling | Availability ladder: `OPM_DESIGN_TOOLS` → project Playwright → Playwright MCP → consented install to `~/.opm/design-tools/` → manual checklist |
| Structure | Approach A: three focused skills, short cores (< 1,200 tokens each), references on demand, one shared rules file |
| Licensing | MIT sources adapted with a bottom attribution line. Apache-2.0 sources (impeccable, stitch-skills, anthropics/skills) re-expressed in OPM's own words and credited in `THIRD_PARTY_NOTICES.md`; no Apache files copied. Unlicensed or CC-BY-SA repos are reference only |
| Core changes | One pointer line in `using-opm`; one line in `verification-before-completion/references/full-loop.md`. Core never depends on opm-design |

## Files

```
plugins/opm-design/
  .claude-plugin/plugin.json
  shared/craft-floor.md
  skills/frontend-design/
    SKILL.md
    references/direction.md
    references/redesign.md
    references/interaction-states.md
    references/visual-qa.md
    references/flutter.md
    scripts/visual-qa.mjs
    scripts/contrast.mjs
  skills/design-system/
    SKILL.md
    references/design-md-format.md
    references/extract-from-code.md
    references/starting-palettes.md
    scripts/validate-design-md.mjs
  skills/ux-flows/
    SKILL.md
    references/use-case-template.md
    references/mermaid-patterns.md
    references/handoff-template.md
    scripts/check-flows.mjs
  agents/design-reviewer.md
```

Core files touched: `.claude-plugin/marketplace.json`, `skills/using-opm/SKILL.md`,
`skills/verification-before-completion/references/full-loop.md`, `scripts/token-budget.js`,
`tests/manifest.test.js`, `tests/package-contents.test.js`, the trigger-eval fixture, `README.md`,
`THIRD_PARTY_NOTICES.md`, `CHANGELOG.md`.

Scripts are Node ES modules with zero dependencies (Node >= 18). Playwright and axe-core are
loaded only if present; nothing is a package dependency.

## `shared/craft-floor.md`

Every rule has a stable ID (`F-01`, `R-01`, `N-01`). The agent and skills cite rules by ID.

**Floor (`F-*`): never waived.**

| ID | Rule |
|---|---|
| F-01 | Body text contrast at least 4.5:1; large text and UI components at least 3:1 (WCAG 2.2 AA) |
| F-02 | Every interactive element has a visible `:focus-visible` style |
| F-03 | Motion respects `prefers-reduced-motion` |
| F-04 | Tap targets at least 44×44 CSS px |
| F-05 | No horizontal scroll at 320px width |
| F-06 | No invented facts, statistics, logos or testimonials; use `[metric]`-style placeholders |
| F-07 | No fake send: success state shown only after a real response |
| F-08 | Meaningful images have alt text; decorative images have empty alt |
| F-09 | Every form field has a programmatic label |
| F-10 | No hard-coded colours where a `DESIGN.md` token exists |

**Reflex (`R-*`): AI defaults, waivable only with a recorded waiver.** A waiver names the rule
ID, the evidence (file:line or screenshot) and a reason of at least 24 characters that is not
boilerplate and not reused verbatim from another waiver. Waivers go in a `Design waivers` section
of the PR description or task report.

Rules: purple-to-blue or rainbow gradients (R-01); card nested in card (R-02); emoji as icons
(R-03); eyebrow label above every heading (R-04); `transition: all` (R-05); `h-screen` instead of
`100dvh` (R-06); filler copy ("seamless", "robust", "elevate", "empower", bare "Get started" or
"Learn more") (R-07); everything centred (R-08); three identical feature cards (R-09); a
gradient-text hero headline (R-10).

**Finish (`N-*`): craft, never blocks.** Type scale rhythm, spacing from the token scale,
consistent radius, optical alignment, line length 45-80 characters for body copy.

**Optional presets.** Taste rules (serif bans, tracked caps, cream palettes) live in a labelled
section and are applied only when the user picks the preset.

## Skill: `frontend-design`

Description triggers on building, styling or redesigning UI: pages, components, dashboards.
Not on backend work or pure logic bugs in UI files.

1. **Direction.** Classify the surface: persuade (marketing), operate (app, dashboard), read
   (docs, content), experience (showcase). Read `DESIGN.md` if present; if absent, offer
   `design-system` once and continue without it on a no. Ask at most 3 intake questions; vague
   adjectives ("clean and modern") get a follow-up. Facts are never inferred. Score the direction
   1-5 on Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety; any axis under 3 is
   revised before code. Never invent a weakness to look rigorous.
2. **Build.** Tokens from `DESIGN.md`, no hard-coded hex. Every control carries the 8 states in
   `interaction-states.md`: default, hover, focus, active, disabled, loading, error, success.
   Redesigns follow `redesign.md`: inventory every link, field, handler and `data-testid` first,
   choose one depth (full, restyle, polish) and never blend them; a missing item from the
   inventory fails the redesign; no test is edited to make it pass.
3. **Check.** Self-check against the craft floor, run `visual-qa.mjs`, Read each screenshot,
   then dispatch `design-reviewer`.

Size scaling: a small change (one component, a style fix) skips direction scoring and runs only
the floor check and visual QA.

## Skill: `design-system`

- **Create.** Product type → starting style, palette, font pairing and spacing scale from
  `starting-palettes.md` (a small table, not a database) → write `DESIGN.md`.
- **Extract.** Read sources in priority order: Tailwind config or theme files, CSS custom
  properties, then component styles. Merge near-duplicate colours (ΔE < 3), name colours by role
  ("Primary action", "Surface", "Danger"), record the source file of each token.
- Both modes run `validate-design-md.mjs` and fix violations before finishing.

### `DESIGN.md` format

YAML frontmatter with required keys `colors`, `typography`, `spacing`, `radius`; optional
`motion`, `shadows`, `breakpoints`. Each colour has `value` (hex) and `role`. Body prose sections:
Intent, Voice, Do, Don't, Components. The validator checks required keys, hex format, that
`colors` includes at least a text and a surface role, and that the text/surface pair passes F-01.

## Skill: `ux-flows`

1. **Use cases.** Per use case: ID, actors, preconditions, main flow, alternative and error flows,
   postconditions. Written to `docs/ux-flows/<feature>/use-cases.md`. **Stop for user approval
   before diagrams.**
2. **Diagrams** in `flows.md`: a Mermaid flowchart and a state diagram per flow, covering idle,
   loading, success, empty, error and offline where they apply. A sequence diagram only when the
   flow calls a backend; arrows name the HTTP method and path. Diagrams follow
   `mermaid-patterns.md`: fixed node shapes (`[Screen]`, `{Decision?}`, `([Action])`,
   `((Start))`), at most 20 nodes, larger flows split into `[[Sub-flow]]`, shared `classDef`s.
3. **Screen inventory**: a table in `flows.md` with Screen, Use cases, Key elements, Outgoing
   links. `check-flows.mjs` fails on a screen with no outgoing link (dead end) or a screen used by
   no use case (orphan).
4. **Handoff** in `handoff.md`: a From screen / Element / To screen table, endpoints from the
   sequence diagrams, and Open questions. This is the input to `opm:writing-plans`.

Size scaling: a single-screen change gets one use case and one state diagram, no inventory.

## Agent: `design-reviewer`

- Tools: Read, Grep, Glob, Bash (Bash only to run `visual-qa.mjs`).
- Input: the diff, `DESIGN.md` if present, the screenshot paths and the visual-QA report. Never
  the builder's reasoning. The prompt opens: you did not build this and will not be told why
  anything is the way it is.
- Output: the first word is the verdict: `ship`, `fix`, `rebuild` or `recapture` (screenshots
  missing, stale or unreadable). Then at most 8 findings, each with `file:line`, rule ID and a
  one-line fix. It never edits files.
- Any unwaived floor violation forbids `ship`. A reflex violation with a valid waiver is not a
  finding.

## Visual QA (`visual-qa.mjs`)

Input: a URL (or a local HTML file) and an output directory. Viewports 375×812 and 1280×800.

Tool ladder, first available wins:

1. `OPM_DESIGN_TOOLS` points at an existing install.
2. The project resolves `playwright` or `@playwright/test` from its own `node_modules`.
3. A Playwright MCP server is connected (the skill drives it; the script reports `mcp` mode and
   only runs the analysis steps).
4. Ask the user, stating the download size (about 150 MB for Chromium), then install pinned
   versions of Playwright and axe-core into `~/.opm/design-tools/`. No install without a yes.
5. Manual: print the checklist; the report says `visual QA: manual, tools unavailable`.

Each run writes PNGs to the output directory (the scratchpad or OS temp, never the repo) and a
JSON report: `tool`, `viewports`, `screenshots`, `axe` (violations or `unavailable`),
`consoleErrors`, `horizontalOverflow` per viewport. Without axe-core, contrast is checked from
`DESIGN.md` tokens with `contrast.mjs` and the report marks accessibility `partial`.

## Errors

- Unreachable dev server: exit 1, print the URL tried and how to start the server. Never a pass
  for a page that did not render.
- Validators exit 1 and print one `Violation: <rule>. Fix: <action>.` line per problem; malformed
  YAML names the line.
- Install failure falls to the manual rung and says why.
- Downloads only after consent, to a fixed path, at pinned versions. No self-update, no reading of
  `~/.claude.json` or any credential file.

## Tests

All in `node --test`, run in CI on macOS, Linux and Windows.

- Manifest: marketplace lists `opm-design` at `./plugins/opm-design`; its `plugin.json`
  description discloses the consented download; the three `SKILL.md` files and the agent exist;
  the `using-opm` pointer line matches exactly.
- `validate-design-md`: valid file, missing token, bad hex, failing contrast pair, malformed YAML.
- `check-flows`: dead end, orphan, clean inventory.
- `contrast.mjs`: known WCAG pairs (#000/#fff = 21, #777/#fff ≈ 4.48).
- `visual-qa.mjs`: tool-ladder selection with an injected environment, never launching a
  browser; unreachable-URL error path.
- Craft floor lint: every rule has a unique ID; every ID cited in the agent and skills exists.
- Token budget: core always-on stays under 2,650; each opm-design `SKILL.md` core under 1,200;
  `npm run tokens` reports the opm-design always-on cost separately.
- Package contents: the npm `opm-core` package does not include `plugins/opm-design`.
- Trigger fixture: about 12 prompts for the new skills plus near misses (a backend endpoint, a
  logic bug in a component → `tdd-workflow`). Paid and run by hand only, never in CI.

## Out of scope for v1

Flutter visual QA, Figma integration, image generation, theme catalogues, blocking edit hooks,
an autonomous design loop.

## Red flags for the skills

| Thought | Reality |
|---|---|
| "The page looks fine in my head" | Run visual QA and Read the screenshots. |
| "Tools are missing, I'll call it passed" | Missing tools means manual mode, reported as such. |
| "This waiver reason is obvious" | Write it down with evidence, or fix the reflex. |
| "I'll put a realistic stat here" | F-06: placeholder, never an invented fact. |
| "The redesign dropped a link but looks better" | The contract inventory fails it. |
