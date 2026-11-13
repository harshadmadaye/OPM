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

Mobile and web: ask one question per UI stack, both in the same AskUserQuestion call.

## The flow: at most two rounds, search at most once

**Round 1.** One AskUserQuestion for the stack, options in this order:

1. The first `round 1` library below, label suffixed "(Recommended)".
2. The second `round 1` library.
3. **Search for more libraries**: "Look up other open-source options once, then choose."
4. **Custom components**: "Hand-build from the design tokens; no library."

The automatic free-text "Other" accepts any library name. Every answer except search is final.

**Search, once per project.** Only when round 1 picked "Search for more libraries" and
`ui-library-searched: yes` is not yet recorded:

1. Record `ui-library-searched: yes` in the spec or brief before searching.
2. Run one web search, for example "open-source <stack> component library <framework version> <year>".
3. Keep a candidate only if it has an OSI-approved licence, a release in the last 12 months,
   support for the chosen stack version, and was not shown in round 1.
4. Take the description, licence and install command from the search results or the library's
   own site. Never invent one. If a fact cannot be found, drop the candidate.
5. If search is unavailable or nothing passes, say so in one line and go to round 2 with only
   the `held` library.

**Round 2.** One AskUserQuestion, no search option, so the flow cannot loop: the best three of
(search finalists + the `held` library), then **Custom components**. "Other" stays available.
This answer is final.

**Record.** In the Stack section of the spec or design:
`UI library: <name> (<one-line reason>; source: curated | searched | other)`.
If the question is revisited later, round 1 omits search when `ui-library-searched: yes` exists.

## What the choice means for the build

- A library: the foundation installs it and wires the design tokens into its Theme hook. Build
  with its components first; hand-build only what it lacks and log why.
- Custom components: hand-build from the design tokens, as OPM did before this choice existed.
- Theme and wrap library components; never copy-edit library internals.

## Web: React and Next.js

| Round | Library | Description | Licence | Install | Theme hook | Detect |
|---|---|---|---|---|---|---|
| 1 | shadcn/ui | Accessible Radix + Tailwind components copied into your repo, so you own and edit the source | MIT | `npx shadcn@latest init`, then `npx shadcn@latest add <component>` | CSS variables (`--primary`, `--radius`, ...) in the global stylesheet | `components.json` at the root |
| 1 | Mantine | 100+ components plus hooks, forms and dates; batteries included | MIT | `npm install @mantine/core @mantine/hooks` | `createTheme` passed to `MantineProvider`; import `@mantine/core/styles.layer.css` when Tailwind is present | `@mantine/core` in package.json |
| held | MUI | Material Design components, very mature, with a free MIT data grid in MUI X | MIT | `npm install @mui/material @emotion/react @emotion/styled @mui/material-nextjs` | `createTheme` + `ThemeProvider`; in App Router wrap in `AppRouterCacheProvider` with `enableCssLayer` when Tailwind is present | `@mui/material` in package.json |

Tailwind stays for layout and spacing with every option.

## Mobile: Flutter

| Round | Library | Description | Licence | Install | Theme hook | Detect |
|---|---|---|---|---|---|---|
| 1 | Material 3 | Flutter's built-in Material widgets; no dependency, the widest ecosystem support | BSD-3-Clause | Built in | `ThemeData(colorScheme: ColorScheme.fromSeed(...))` on `MaterialApp` | Default when no other kit is in pubspec.yaml |
| 1 | shadcn_ui | shadcn/ui look and components ported to Flutter | MIT | `flutter pub add shadcn_ui` | `ShadThemeData` on `ShadApp` | `shadcn_ui` in pubspec.yaml |
| held | Forui | Minimal, unopinionated widgets for mobile and desktop | MIT | `flutter pub add forui` | `FThemeData` via `FTheme` | `forui` in pubspec.yaml |
