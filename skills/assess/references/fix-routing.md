# Fix routing

## Bundles

| Bundle | Holds |
|---|---|
| Critical fixes | CRITICAL and HIGH, any effort |
| Quick wins | MEDIUM or LOW with effort S |
| Refactors | MEDIUM or LOW with effort M or L, mostly architecture lenses |
| Test gaps | findings from test-coverage lenses |
| Other | anything left |

A finding sits in the first bundle that matches. AskUserQuestion allows four
options; offer the four largest non-empty bundles with counts in the label
("Critical fixes (3)") and list any fifth in the question text so the
developer can type it under "Other". "Other" also takes IDs or "none".

## Branch

- On the default branch (`main`, `master`, or `git symbolic-ref
  refs/remotes/origin/HEAD`): `git checkout -b fix/assess-<YYYY-MM-DD>-<level>`.
- On another branch: ask "Fix on <branch>, or a new fix/assess branch?"
- Uncommitted changes present: stop and ask before switching.
- Never change `git config`. Commits use the identity the repo already has.
- First commit: the report, `docs(assess): <level> assessment <date>`.

## Sizing the batch

Count tasks: one per finding, except grouped findings in the same file, which
are one task.

| Picked | Route |
|---|---|
| Only S-effort, each about one file | `opm:tdd-workflow` per finding, in ID order; commit each as `fix(<area>): <title> (F<n>)` |
| Up to about 8 tasks, or any M | `opm:writing-plans`, Spec: the report path, scope: the picked IDs. Then `opm:executing-plans` |
| More than about 8 tasks, or an L architecture change | `opm:milestone-planning`, one phase per bundle |

When a fix needs a design choice the report cannot settle (two reasonable
fixes, a public interface changes), run `opm:brainstorming` for that finding
first. Finding IDs go in task titles and commit messages, so the next
assessment can mark them Fixed.

## Close

`opm:verification-before-completion` on the branch, then offer the PR. Never
push without a yes. Suggest re-running `/opm:assess <level>` after the fixes
to fill the Fixed column.
