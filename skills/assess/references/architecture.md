# Architecture lenses

Each lens is one subagent (`general-purpose`, or `Explore` when it only reads).
Give it the fact sheet, the scope, its brief below, and the finding format from
`verify.md`. Ask for at most 10 findings, strongest first.

## A1 Boundaries and coupling

> Map the modules (top-level directories or packages) and who imports whom.
> Use grep on import statements, not guesses. Report: import cycles, modules
> with the widest fan-in that also change often (`git log --format= --name-only
> | sort | uniq -c | sort -rn | head -30`), layers that reach past their
> neighbour (UI importing the database client, a domain module importing a
> framework), and shared "utils" modules that everything depends on. Cite the
> import line for each finding.

## A2 Layering and data flow

> Trace how data moves for the two or three main flows in the fact sheet:
> where input is validated, where state lives, where side effects happen.
> Report: validation that happens in more than one place or nowhere, state
> duplicated across layers, business rules inside UI or route handlers, and
> side effects in code that looks pure. Cite the line where each rule lives.

## A3 Drift from docs

> Compare README, `docs/specs/`, architecture notes and comments that describe
> structure against the code. Report each claim the code no longer matches
> (a module that moved, a flow that changed, a documented env var that is never
> read) with both locations.

## A4 Maintainability hotspots

> List the 10 largest source files and the 10 longest functions you can find.
> For each above 800 lines (file) or 50 lines (function), say what
> responsibilities it mixes and where it could split. Report only the ones
> where the split is clear; effort is usually M or L.

Architecture findings are rarely S effort. Do not inflate severity: coupling is
HIGH only when it already causes a concrete problem you can name.
