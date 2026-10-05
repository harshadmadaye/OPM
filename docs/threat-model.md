# OPM hooks threat model

OPM's hooks keep the model on the workflow. They are guard rails against model
drift: an agent that, under pressure to finish, skips a failing git hook,
loosens a lint rule, or stops before the typechecker has spoken. They are
**not a security boundary**, and nothing here protects against a person or a
process that wants to get around them.

## What each hook is for

| Hook | Event | Guards against |
|---|---|---|
| `block-no-verify.js` | PreToolUse, Bash | Commands that bypass git hooks (denied). |
| `config-protection.js` | PreToolUse, Edit/Write | Weakening linter, formatter, typecheck or git hook config (asks first). |
| `stop-format-typecheck.js` | Stop | Ending a turn with unformatted files or tsc errors (tsc errors block). |
| `check-console-log.js` | Stop | Leftover debug output in edited files (warns). |

Every hook exits 0 on internal errors, so a hook bug never stalls a session.
The deliberate denies and blocks are the only non-silent outcomes.

## Evasions tested (rule `no-hook-bypass`)

Each one is denied with a message that names the rule and says to fix the
failing hook instead. Tests live in `tests/hooks.test.js`.

- `git commit -n`, including clusters such as `-an`.
- `--no-verify` (or any unambiguous prefix such as `--no-verif`) anywhere in
  the arguments of commit, push, merge, cherry-pick, rebase or am.
- `HUSKY=0` or `HUSKY_SKIP_HOOKS=1` before the git command, or set earlier in
  the same command line with `export HUSKY=0` or a bare `HUSKY=0;`.
- `git -c core.hooksPath=<path> commit` (and the other hooked subcommands).
- `git config core.hooksPath <path>`, `--unset`, `--add`, `--replace-all`,
  and `git config set|unset core.hooksPath`.
- Editing `.git/config` so that its `hooksPath` line changes (asks first).

## Look-alikes allowed

A command is only checked when git is actually being run: git must be in
command position (after `VAR=value` assignments, `env`, `sudo`, `if`, `then`
and similar), or open a `$(...)` or backtick substitution. These pass:

- Heredoc bodies, such as `cat > plan.md <<'EOF'` followed by text that
  mentions `git commit --no-verify` or `HUSKY=0`. This was the false positive
  of 2026-10-05.
- A commit message passed with `-m "..."` or through `-F - <<'EOF'` that
  mentions the flags.
- `echo`, `printf` and `grep` arguments, quoted or not.
- Read-only `git config core.hooksPath` and `git config --get core.hooksPath`.
- `echo HUSKY=0 && git commit ...`, where HUSKY=0 is only printed.

## Destructive-command hold (mod)

`hooks/mod/guard.mjs`, a `tool.call` hook on Bash in OPM's hooks module
(Claude Code 2.1.287 or later; older versions run only the settings hooks).
It holds, before they run:

- `rm -rf` (any spelling of recursive plus force) on `/`, `~`, `$HOME`,
  `..`, `*` at the repo root, the repo root itself, or a path outside it.
- A force-push (`-f`, `--force`, `--force-with-lease`, a `+` refspec) to
  `main` or `master`, or one that names no branch.
- `git reset --hard`.

A held command asks the user "Run it" or "Cancel"; it never approves on its
own, and "Run it" still goes through the normal permission check. Cancel, a
dismissed question, `claude -p` or any place the question cannot show means
a deny whose reason tells Claude to ask the user. If the guard itself fails,
it denies. The same look-alikes pass as above (`echo`, heredoc bodies), as do
`rm -rf ./dist` inside the repo, pushes to feature branches and
`git reset --soft`. Set `OPM_GUARD=off` in the environment to turn it off.

Like the settings hooks, it is a drift guard, not a security boundary: a
command run through a script, an alias or a variable is not seen.

## Out of scope

- A determined user. Anyone can set `OPM_HOOKS_DISABLED=1`, edit
  `hooks.json`, uninstall the plugin, or commit from another terminal.
- A malicious process or prompt-injected agent working to evade detection:
  scripts that run git for it (`bash -c`, `sh script.sh`, a heredoc fed to
  `bash`, `npm run` aliases, `xargs git`), variables that expand to flags,
  git aliases, `GIT_CONFIG_*` environment variables, or rewriting `.git/hooks`.
- Further variants of the above. Chasing them is an arms race the hooks
  cannot win, and each extra rule adds false positives. The list above
  covers the cheap evasions a drifting model actually reaches for.

If you need enforcement that holds against an adversary, run the checks on
the server: required CI status checks and branch protection.
