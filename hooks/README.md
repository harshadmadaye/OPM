# OPM hooks

Self-contained Node scripts (no dependencies) wired up in `hooks.json`. Every
script reads the hook JSON from stdin, never throws, and exits 0 on internal
error so a hook bug can never block your work.

| Script | Event / matcher | What it does |
| --- | --- | --- |
| `scripts/session-start.js` | SessionStart `startup\|clear\|compact` | Injects `skills/using-opm/SKILL.md` (frontmatter stripped) as `additionalContext`. Silent if the file is missing. |
| `scripts/block-no-verify.js` | PreToolUse `Bash` | **Denies** `git commit/push/merge/rebase/cherry-pick/am` that bypass hooks: `--no-verify` (and `-n` on commit), `-c core.hooksPath=...`, `HUSKY=0` / `HUSKY_SKIP_HOOKS=1`. |
| `scripts/config-protection.js` | PreToolUse `Edit\|Write\|MultiEdit` | **Asks** before editing an existing linter/formatter/typecheck config: `eslint*`, `.prettierrc*`, `prettier.config.*`, `biome.json(c)`, `tsconfig*.json`, `ruff.toml`, `pyproject.toml` `[tool.ruff]`/`[tool.mypy]` sections, `analysis_options.yaml`, `.editorconfig`, `.husky/*`. Creating a new config is allowed. |
| `scripts/post-edit-accumulator.js` | PostToolUse `Edit\|Write\|MultiEdit` | Appends the edited path (deduped) to `<tmpdir>/opm-edited-<session_id>.txt`. No output. |
| `scripts/stop-format-typecheck.js` | Stop (timeout 90 s) | Groups the accumulated files by project root (nearest `package.json` / `pyproject.toml` / `pubspec.yaml`). JS/TS: `prettier --write` (local bin or `npx --no-install`), then `tsc --noEmit -p <root>` when `tsconfig.json` and `node_modules/.bin/tsc` exist. Python: `ruff format` + `ruff check`. Dart: `dart format`. 60 s total budget. tsc errors **block** the stop so Claude fixes them; ruff check findings are a non-blocking `systemMessage`. Clears the list when done. |
| `scripts/check-console-log.js` | Stop (timeout 15 s) | Scans only the accumulated files for `console.log(` (JS/TS), `print(`/`debugPrint(` (Dart), `print(` (Python). Reports a non-blocking `systemMessage`. Skips test files, `scripts/`, and files containing `opm-allow-console`. |

## Disabling and overrides

| Env var | Effect |
| --- | --- |
| `OPM_HOOKS_DISABLED=1` | Short-circuits every script above (checked first thing, before stdin is read). |
| `OPM_ALLOW_CONFIG_EDITS=1` | `config-protection.js` allows config edits without asking. |
| `OPM_SKIP_FORMAT=1` | `stop-format-typecheck.js` skips prettier / ruff / dart format. |
| `OPM_SKIP_TYPECHECK=1` | `stop-format-typecheck.js` skips `tsc --noEmit`. |

Set them in your shell before launching Claude Code, or in `settings.json`
under `"env"`. To disable a single hook permanently, remove its entry from
`hooks.json`.

## Notes

- Stop hooks run in parallel. Only `stop-format-typecheck.js` clears the
  accumulator list, and it keeps the list alive for at least 1 s so
  `check-console-log.js` can read it first.
- `stop-format-typecheck.js` exits immediately when `stop_hook_active` is
  true, which prevents an infinite block loop.
- Tools that are not installed are skipped silently; nothing is downloaded.
- Session IDs are sanitised to `[A-Za-z0-9_-]` before being used in the
  temp-file name; missing IDs fall back to `default`.

## Tests

```
node --test tests/hooks.test.js
```

Attribution: `block-no-verify`, `config-protection`, `post-edit-accumulator`,
`stop-format-typecheck` and `check-console-log` are adapted from
affaan-m/ecc (MIT); `session-start` is adapted from obra/superpowers (MIT).
