# opm Rules

Coding rules for Claude Code, organized as a small always-on `common/` layer plus per-language directories that load only for matching file paths.

Plugins do not auto-load rules. Copy the ones you want into the target repository's `.claude/rules/`.

```
rules/
  common/        # always loaded: coding-style, security, delegation, git-workflow
  typescript/    # **/*.ts, **/*.tsx
  react/         # **/*.tsx, **/*.jsx
  python/        # **/*.py
  dart/          # **/*.dart
```

## Install

Copy `common/` plus the language directories the repo uses:

```sh
# from the plugin root
scripts/install-rules.sh --langs typescript,react ~/code/my-web-app
scripts/install-rules.sh --langs dart ~/code/my-flutter-app
scripts/install-rules.sh --langs typescript,python ~/code/my-api
```

The script copies into `<repo>/.claude/rules/opm/`, refuses to overwrite an existing install unless you pass `--force`, and prints what it did. Manual equivalent:

```sh
mkdir -p .claude/rules/opm
cp -R /path/to/opm/rules/common /path/to/opm/rules/typescript .claude/rules/opm/
```

Commit `.claude/rules/opm/` so the whole team shares the same rules.

## Keep common/ Small

Everything in `common/` is in context for every conversation in the repo, whatever file is open. Keep it to short, universal rules. Language- or framework-specific guidance belongs in a scoped directory with a `paths:` list in its frontmatter:

```yaml
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
```

## Customizing

Edit the copied files in the repo; they are yours after install. Re-running the script with `--force` replaces them with the plugin versions, so keep repo-specific additions in separate files next to `opm/` rather than inside it.

<!-- Adapted from affaan-m/ecc (MIT) -->
