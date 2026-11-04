# Extracting a design system from code

## Source priority

Read in this order and stop adding new tokens from a lower source once a higher one defines that
group:

1. **Tailwind config or theme files:** `tailwind.config.{js,ts,cjs,mjs}` (`theme` and
   `theme.extend`), Tailwind v4 `@theme` blocks in CSS, `theme.ts`, `tokens.json`, MUI or
   Chakra theme objects.
2. **CSS custom properties:** `:root { --... }` and `[data-theme]` blocks.
3. **Component styles:** colours, font sizes, radii and spacing used directly in components.
   Count how often each value appears with Grep.

## Colours

1. List every distinct colour with its source file and count.
2. Convert `rgb()`, `hsl()` and named colours to hex.
3. Merge near-duplicates: run `contrast.mjs --delta <a> <b>` on pairs that look alike. Under 3
   means the same colour; keep the more frequent value.
4. Name by role, never by hue: what the colour does (text, surface, Primary action, Danger,
   Border, Muted text). If a colour has two jobs, it becomes two roles that share a value.
5. Pick the `text` and `surface` roles from the most common body text and page background.

## Typography, spacing, radius

- Typography: the families in use, then the sizes that appear at least 3 times. Drop one-offs
  and note them under Don't.
- Spacing: collect padding, margin and gap values, then fit them to a 4px or 8px scale. Note
  values that do not fit.
- Radius: the 2-4 values in use. More than 4 is a finding to report, not a token to keep.

## Recording sources

Under `## Components`, note where each token came from, for example
`action: tailwind.config.ts theme.extend.colors.brand.600`. This lets someone check the
extraction later.
