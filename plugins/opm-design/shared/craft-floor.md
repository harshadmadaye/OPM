# Craft floor

The one rules file for opm-design. Skills and the design-reviewer agent cite rules by ID and
never restate them. Three tiers: Floor rules are never waived, Reflex rules need a recorded
waiver, Finish rules are craft notes that never block.

## Floor (F): never waived

| ID | Rule | How to check |
|---|---|---|
| F-01 | Body text contrast at least 4.5:1; large text (24px, or 18.66px bold) and UI components at least 3:1 (WCAG 2.2 AA) | `contrast.mjs <fg> <bg>`; axe `color-contrast` |
| F-02 | Every interactive element has a visible `:focus-visible` style | Tab through the page; no `outline: none` without a replacement |
| F-03 | Motion respects `prefers-reduced-motion` | Every animation or transition over 200ms has a reduced-motion branch |
| F-04 | Tap targets at least 44×44 CSS px | Measure buttons, links in lists, icon buttons |
| F-05 | No horizontal scroll at 320px width | `horizontalOverflow["320"]` in the visual-QA report is false |
| F-06 | No invented facts, statistics, logos or testimonials; use `[metric]`-style placeholders | Every number, name and quote traces to the user or the codebase |
| F-07 | No fake send: a success state shows only after a real response | Success UI is set in the response handler, not on click |
| F-08 | Meaningful images have alt text; decorative images have empty alt | axe `image-alt`; read each `<img>` |
| F-09 | Every form field has a programmatic label | `<label for>`, `aria-label` or `aria-labelledby`; placeholder is not a label |
| F-10 | No hard-coded colours where a `DESIGN.md` token exists | Grep the diff for hex, `rgb(` and `hsl(` |

## Reflex (R): AI defaults, waivable only with a recorded waiver

| ID | Reflex | Do instead |
|---|---|---|
| R-01 | Purple-to-blue or rainbow gradients | A flat brand colour, or a gradient within one hue |
| R-02 | A card nested in a card | One container; separate inner groups with spacing or a divider |
| R-03 | Emoji used as icons | An icon set, or no icon |
| R-04 | An eyebrow label above every heading | Only where the label adds information |
| R-05 | `transition: all` | Name the properties: `transition: opacity 150ms, transform 150ms` |
| R-06 | `h-screen` or `100vh` for full-height layouts | `100dvh` (`h-dvh` in Tailwind) |
| R-07 | Filler copy: "seamless", "robust", "elevate", "empower", a bare "Get started" or "Learn more" | Say what happens: "Create your first invoice" |
| R-08 | Everything centred | Left-align body copy and forms; centre only short display text |
| R-09 | Three identical feature cards | Vary by content: one lead item, a list, a comparison |
| R-10 | A gradient-text hero headline | Solid text; put emphasis in the words |

### Waivers

A reflex kept on purpose needs one waiver line in a `Design waivers` section of the PR
description or task report:

    - <ID> | <evidence> | <reason>

- `<ID>` is one reflex rule (R-*). Floor rules are never waived.
- `<evidence>` is a `file:line` or a screenshot path.
- `<reason>` is at least 24 characters, specific to this product, not boilerplate ("design
  choice", "looks better", "per request") and not copied word for word from another waiver.

Example: `- R-01 | src/Hero.tsx:12 | Brand guide v3 requires the violet-to-indigo hero band.`

## Finish (N): craft, never blocks

| ID | Note |
|---|---|
| N-01 | Type sizes follow one scale with a steady ratio; no one-off sizes |
| N-02 | Spacing comes from the token scale; no one-off margins |
| N-03 | One radius family; nested corners use outer radius minus padding |
| N-04 | Optical alignment: icons and text line up by eye, not only by box |
| N-05 | Body copy line length is 45-80 characters |

## Optional presets (P): only when the user picks the preset

| ID | Preset rule |
|---|---|
| P-01 | Editorial restraint: no serif display faces; one sans family throughout |
| P-02 | No tracked-out uppercase labels |
| P-03 | No cream or beige page backgrounds; pure white or a neutral grey surface |
