# DESIGN.md format

`DESIGN.md` lives at the project root. It has YAML frontmatter with the tokens, then prose.

## Frontmatter rules

The validator reads a YAML subset so it needs no dependencies. Every valid file is still valid
YAML.

- Nested maps only, indented with exactly 2 spaces. No tabs, lists or `{...}` / `[...]`.
- One `key: value` per line. Keys use letters, digits, `-`, `_` and `.`.
- Quote any value that starts with `#`, so hex colours are always `"#1A1A1A"`.
- Required groups: `colors`, `typography`, `spacing`, `radius`. Optional: `motion`, `shadows`,
  `breakpoints`.
- Each colour is a map with `value` (`#RGB` or `#RRGGBB`) and `role`. One colour has
  `role: text` and one has `role: surface`; that pair must pass F-01 (4.5:1). Other roles are
  free text named by purpose: `Primary action`, `Danger`, `Muted text`, `Border`.
- Write a spacing scale as one space-separated value: `scale: 4 8 12 16 24 32 48`.

## Body sections

`## Intent` (who it is for and the feeling, in the user's words), `## Voice` (how copy sounds,
with one example sentence), `## Do`, `## Don't` (each 3-6 bullets, which may cite craft-floor
IDs such as R-07), and `## Components` (key components, the tokens each uses, and the source
file of each token when extracted).

## Example

````markdown
---
colors:
  ink:
    value: "#111827"
    role: text
  ink-muted:
    value: "#4B5563"
    role: Muted text
  paper:
    value: "#FFFFFF"
    role: surface
  action:
    value: "#2563EB"
    role: Primary action
  danger:
    value: "#B91C1C"
    role: Danger
typography:
  display:
    family: "Inter, system-ui, sans-serif"
    weight: 700
    size: 36px
  body:
    family: "Inter, system-ui, sans-serif"
    weight: 400
    size: 16px
    line-height: 1.5
spacing:
  scale: 4 8 12 16 24 32 48 64
radius:
  sm: 4px
  md: 8px
  lg: 16px
motion:
  fast: 150ms
  base: 250ms
---

## Intent

An invoicing tool for freelancers who want to get paid without thinking about it.

## Voice

Plain and direct. "Invoice sent to Acme. We'll remind them in 7 days."

## Do

- Lead each screen with the one action that matters.
- Use `action` only for the primary button on a screen.

## Don't

- No filler copy (R-07).
- No gradients on buttons or headings (R-01, R-10).

## Components

- Button: `action` background, `paper` text, `radius.md`, body type at weight 600.
- Card: `paper` surface, 1px border in `ink-muted` at 20% opacity, `radius.lg`, spacing 24.
````
