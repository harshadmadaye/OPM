# Feature lenses

The developer named one feature (from the map's list, or their own words).

## F0 Trace (runs first, alone)

One `Explore` subagent:

> Trace the feature "<feature>" end to end. Start at its entry point (route,
> screen, command, handler). Follow it through UI, state, API or service calls,
> data access and storage, and find its tests. Return: the ordered list of
> files with the line where the feature enters each, the data it reads and
> writes, external calls, and the test files that cover it (or "none").

Show the trace to the developer in five lines or fewer. If it found nothing,
ask them to point at the entry point; do not guess.

## Lenses on the traced files only

Run in one message, each with the trace and the finding format:

| Lens | Agent | Looks for |
|---|---|---|
| T1 Flow correctness | `opm:code-reviewer` (Sweep mode, traced paths) | Wrong behaviour across the layers: mismatched shapes between client and server, missing states (loading, empty, error), race conditions |
| T2 Errors | `opm:silent-failure-hunter` (traced paths) | Failures in this flow that the user never sees |
| T3 Test gaps | `general-purpose` | Behaviours in the trace with no test; tests that mock the part that breaks. List each missing case as one finding with effort |
| T4 Security | `opm:security-reviewer` (traced paths) | Only when the feature takes user input, handles auth, money or personal data |

Feature findings should say which layer they are in, in the title.
