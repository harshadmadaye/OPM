# Installed UI library

Check these signals before building. The first match is the library to build with. The choice
itself is made in `opm:brainstorming` or `opm:jump-start`; this skill only detects and follows it.

| Signal | Library | Build with | Tokens go into |
|---|---|---|---|
| `components.json` at the root | shadcn/ui | `components/ui/*`; add missing ones with `npx shadcn@latest add <name>` | CSS variables in the global stylesheet |
| `@mantine/core` in package.json | Mantine | `@mantine/core` components | `createTheme` on `MantineProvider` |
| `@mui/material` in package.json | MUI | `@mui/material` components | `createTheme` on `ThemeProvider` |
| `shadcn_ui` in pubspec.yaml | shadcn_ui (Flutter) | `Shad*` widgets | `ShadThemeData` |
| `forui` in pubspec.yaml | Forui | `F*` widgets | `FThemeData` |
| Flutter, none of the above | Material 3 | Material widgets | `ThemeData` color scheme, see `flutter.md` |
| A `UI library:` line in the spec naming something else | That library | Its components | Its theme API |
| Nothing | Custom components | Hand-built from `DESIGN.md` tokens | Tokens directly |

Rules:

- Theme and wrap library components; never fork or copy-edit their internals (shadcn/ui's
  copied source is yours and may be edited).
- The eight interaction states still apply. Check the library covers each; add what is missing.
- A hand-built component in a project that has a library gets one line in the report saying
  which component the library lacked.
