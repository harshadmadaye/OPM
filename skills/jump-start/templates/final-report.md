# <project-name> is running

## Human checks pending
Each pending row of `docs/milestones/v0.1/REVIEW-QUEUE.md` (ID, what to check, how, evidence), or "None". These come before everything else: no agent has passed them.

## Where
- URL or device:
- Stop with: `sh "${CLAUDE_PLUGIN_ROOT}/scripts/dev-server.sh" stop --project <abs path> --name <web|mobile>`
- Logs: `<project>/.opm/<name>.log`

## What was built
Phases completed, screens and flows delivered, stack used.

## Evidence
| Check | Result | Env |
|---|---|---|
| Unit tests | N passed, M failed | unit |
| Typecheck | | unit |
| Lint | | unit |
| E2E or smoke | routes tested | simulator, physical-device or prod-like |

### Review findings
| Severity | Found | Fixed | Parked | Dismissed |
|---|---|---|---|---|
| CRITICAL | 0 | | | |
| HIGH | 0 | | | |
| MEDIUM | 0 | | | |
| LOW | 0 | | | |

Code and security review combined. Dismissed: "[finding]" and why. Every CRITICAL or HIGH is fixed, parked or dismissed with a reason.

## Decisions made for you
Link to `docs/milestones/v0.1/DECISIONS.md` and list the three that matter most.

## Known gaps and assumptions
What is stubbed, what needs real credentials, what was assumed.

## Next steps
Three suggested follow-ups, each one plan-sized.
