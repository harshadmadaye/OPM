# Git Workflow

## Commits

Conventional Commits format:

```
<type>(<optional scope>): <short imperative description>

<optional body: what and why, not how>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`.

- One logical change per commit. Commit or push only when asked.
- Never commit secrets, `.env` files, service-account JSON, or generated debug logs. Check `git diff --staged` before every commit.
- Never `--no-verify`. If a hook fails, fix the cause.

## Branches and Pull Requests

- Branch from the default branch; never commit directly to it.
- Small PRs: one feature or fix, reviewable in one sitting. Split large work into stacked or sequential PRs.
- Never force-push a shared branch. `--force-with-lease` on your own feature branch only.
- Before opening a PR, review the full range: `git diff <base>...HEAD`, not just the last commit.
- PR description: what changed, why, how it was tested, and anything the reviewer should look at first.
- Keep CI green; do not merge over failing required checks.

<!-- Adapted from affaan-m/ecc (MIT) -->
