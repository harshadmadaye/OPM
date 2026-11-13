# UI library choice

Read this when a new project, or a new UI surface in a project without one, needs a component
library decided. Used by `opm:brainstorming` and `opm:jump-start`; `opm-design:frontend-design`
uses only the Detect column.

The goal is to reuse mature open-source components instead of hand-building every button,
dialog, form and table, while never locking the developer in: "Custom components" and free-text
"Other" are always available.

## When to skip the question

- The brief, spec or developer already names a library. Record it and move on.
- A library is already installed (see Detect). Record it and move on.
- The project has no UI (API only, CLI, library package).

Mobile and web: search for each UI stack, then ask one question per stack in the same
AskUserQuestion call.

## The flow: search once, ask once

**1. Search, once per project.** If `ui-library-candidates:` is already recorded in the spec or
brief, reuse those candidates and do not search again. Otherwise:

1. Run one web search, for example "best open-source <stack> component library <framework version> <year>".
2. Keep a candidate only if it has an OSI-approved licence, a release in the last 12 months, and
   support for the chosen stack version.
3. Take the description, licence and install command from the search results or the library's
   own site. Never invent one. If a fact cannot be found, drop the candidate.
4. Rank by fit for the product, then maintenance, then adoption. Keep the top three.
5. If search is unavailable or fewer than three pass, say so in one line and fill the gaps from
   the fallback table for the stack below, in order.
6. Record `ui-library-candidates: <a>, <b>, <c>` in the spec or brief.

**2. Ask, once.** One AskUserQuestion for the stack, options in this order:

1. The top candidate, label suffixed "(Recommended)", description = what it is in one line.
2. The second candidate.
3. The third candidate.
4. **Custom components**: "Hand-build from the design tokens; no library."

The automatic free-text "Other" lets the developer specify any library by name. The answer is
final: there is no second round, so the flow cannot loop.

**3. Record.** In the Stack section of the spec or design:
`UI library: <name> (<one-line reason>; source: search | fallback | developer)`.

## What the choice means for the build

- A library: the foundation installs it and wires the design tokens into its Theme hook. Build
  with its components first; hand-build only what it lacks and log why.
- Custom components: hand-build from the design tokens, as OPM did before this choice existed.
- A library named under "Other": confirm its install command and theme API from its own docs
  before the foundation uses it.
- Theme and wrap library components; never copy-edit library internals.

## Fallback: Web, React and Next.js

Used only when search is unavailable or returns fewer than three candidates.

| Library | Description | Licence | Install | Theme hook | Detect |
|---|---|---|---|---|---|
| shadcn/ui | Accessible Radix + Tailwind components copied into your repo, so you own and edit the source | MIT | `npx shadcn@latest init`, then `npx shadcn@latest add <component>` | CSS variables (`--primary`, `--radius`, ...) in the global stylesheet | `components.json` at the root |
| Mantine | 100+ components plus hooks, forms and dates; batteries included | MIT | `npm install @mantine/core @mantine/hooks` | `createTheme` passed to `MantineProvider`; import `@mantine/core/styles.layer.css` when Tailwind is present | `@mantine/core` in package.json |
| MUI | Material Design components, very mature, with a free MIT data grid in MUI X | MIT | `npm install @mui/material @emotion/react @emotion/styled @mui/material-nextjs` | `createTheme` + `ThemeProvider`; in App Router wrap in `AppRouterCacheProvider` with `enableCssLayer` when Tailwind is present | `@mui/material` in package.json |

Tailwind stays for layout and spacing with every option.

## Fallback: Mobile, Flutter

Used only when search is unavailable or returns fewer than three candidates.

| Library | Description | Licence | Install | Theme hook | Detect |
|---|---|---|---|---|---|
| Material 3 | Flutter's built-in Material widgets; no dependency, the widest ecosystem support | BSD-3-Clause | Built in | `ThemeData(colorScheme: ColorScheme.fromSeed(...))` on `MaterialApp` | Default when no other kit is in pubspec.yaml |
| shadcn_ui | shadcn/ui look and components ported to Flutter | MIT | `flutter pub add shadcn_ui` | `ShadThemeData` on `ShadApp` | `shadcn_ui` in pubspec.yaml |
| Forui | Minimal, unopinionated widgets for mobile and desktop | MIT | `flutter pub add forui` | `FThemeData` via `FTheme` | `forui` in pubspec.yaml |
