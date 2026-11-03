# Code lenses

The scope is the whole repo or the path the developer gave. Every reviewer runs
in **Sweep mode**: the brief must say "Sweep mode", list the paths, and ask for
the assess finding format from `verify.md`.

| Lens | Agent | Brief |
|---|---|---|
| C1 Correctness | `opm:code-reviewer` | "Sweep mode. Paths: <scope>. Lenses: Correctness, Maintainability, Test coverage. Use the assess finding format. At most 15 findings." |
| C2 Stack | `opm:typescript-reviewer` for TS/JS; otherwise `general-purpose` told to apply `opm:python-patterns`, `opm:react-patterns` or `opm:flutter-patterns` | "Sweep mode. Paths: <scope>. Run the typecheck and lint, then review idiom and type safety. Use the assess finding format." |
| C3 Silent failures | `opm:silent-failure-hunter` | "Sweep the module(s) <scope>. Use the assess finding format." |
| C4 Security | `opm:security-reviewer` | "Review <scope> as a whole, not a diff. Include the secret greps and dependency audit. Use the assess finding format." |

Run C1 to C4 in one message. Skip C2 when no stack matches and say so.

## Large scopes

Above about 300 source files, split C1 by top-level directory into at most
three subagents, each with its own paths. Tell each one which directories the
others have, so they do not overlap.

## Baseline findings

Each failing or missing baseline gate becomes one finding:
- build or tests failing: HIGH, `file` is the first failing location, `effort`
  from the size of the failure;
- types or lint errors: one finding per rule with the count, MEDIUM;
- no test script, no linter or no type check configured: MEDIUM, effort S;
- coverage below 60% on the scope: LOW, with the lowest three files.
