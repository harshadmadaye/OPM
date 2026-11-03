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

Ask before creating the branch or committing anything, in one
AskUserQuestion:

- "New branch `fix/assess-<YYYY-MM-DD>-<level>` and commit the report there"
  (recommended on the default branch: `main`, `master`, or `git symbolic-ref
  refs/remotes/origin/HEAD`);
- "Use the current branch <branch>" (recommended on any other branch);
- "Do not commit; just fix" (the report stays uncommitted).

The new report file is untracked, so it carries over when the branch is
created; it never counts as a reason to stop. Uncommitted changes other than
the new report: stop and ask before switching.

- Never change `git config`. Commits use the identity the repo already has.
- First commit: the report, `docs(assess): <level> assessment <date>`.

## Sizing the batch

Count tasks: one per finding, except grouped findings in the same file, which
are one task. Apply the first rule that matches, top to bottom:

| # | When | Route |
|---|---|---|
| 1 | More than 8 tasks, or any L-effort finding from an architecture lens | `opm:milestone-planning`, one phase per bundle |
| 2 | Every finding S-effort, and at most 3 tasks | `opm:tdd-workflow` per finding, in ID order |
| 3 | Anything else | `opm:writing-plans`, Spec: the report path, scope: the picked IDs. Then `opm:executing-plans` |

Under rule 2, use tdd-workflow's own checkpoint commits with the finding ID
appended: `test: add failing test for <behaviour> (F<n>)`, then
`fix: <bug> (F<n>)`, then `refactor: <what> (F<n>)` if anything changed.

When a fix needs a design choice the report cannot settle (two reasonable
fixes, a public interface changes), run `opm:brainstorming` for that finding
first. Finding IDs go in task titles and commit messages, so the next
assessment can mark them Fixed.

## Close

`opm:verification-before-completion` on the branch, then offer the PR. Never
push without a yes. Suggest re-running `/opm:assess <level>` after the fixes
to fill the Fixed column.
