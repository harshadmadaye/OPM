# Flutter mapping

The craft floor is platform-neutral. In Flutter, map `DESIGN.md` tokens into the theme once and
read them from the theme everywhere else. Visual QA is web only in this version, so check
Flutter screens with the manual checklist.

## Tokens to ThemeData

| DESIGN.md | Flutter |
|---|---|
| `role: text` | `ColorScheme.onSurface` |
| `role: surface` | `ColorScheme.surface` |
| `role: Primary action` | `ColorScheme.primary`, with `onPrimary` checked by F-01 |
| `role: Danger` | `ColorScheme.error` |
| `typography.*` | `TextTheme` styles (`displayLarge`, `bodyMedium` and so on) |
| `spacing.scale` | A `const` spacing class or a `ThemeExtension` |
| `radius.*` | `RoundedRectangleBorder(borderRadius: BorderRadius.circular(...))` in component themes |

## Floor rules in Flutter

| Rule | Flutter |
|---|---|
| F-01 | Check `onX` against `X` for every ColorScheme pair you use |
| F-02 | `FocusNode` plus a visible focus decoration; test with a keyboard on desktop and web |
| F-03 | `MediaQuery.of(context).disableAnimations` shortens or removes animations |
| F-04 | `MaterialTapTargetSize.padded`; at least 48×48 logical pixels |
| F-05 | No overflow stripes at 320 logical pixels wide; use `LayoutBuilder` |
| F-08 | `Semantics(label: ...)` on meaningful images; `excludeSemantics` on decoration |
| F-09 | `InputDecoration(labelText: ...)`; a hint is not a label |
| F-10 | No `Color(0xFF...)` in widgets; read from `Theme.of(context)` |
