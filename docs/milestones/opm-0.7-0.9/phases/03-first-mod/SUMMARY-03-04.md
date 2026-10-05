---
phase: 03-first-mod
plan: 04
requires:
  - { phase: 03-first-mod, provides: mod skeleton with meterCommands stub (03-02) }
provides:
  - hooks/mod/meter.mjs: opt-in, local-only turn meter (store key opm.meter, 14 days, 256 KiB cap)
  - /opm-report with --enable / --disable; exports parseEntries and formatReport
  - hooks/mod/tests/meter.test.ts (20 tests)
affects: [03-06, 04-04]
key_files: [hooks/mod/meter.mjs, hooks/mod/tests/meter.test.ts]
key_decisions:
  - "skill.prompt has no turn id, so skills are credited to the next turn that completes"
  - "off by default: when disabled, turn.complete only passes through"
  - "a corrupt stored value is reset with one notice line; store errors go to the debug log and never break a turn"
  - "turns without e.usage (interrupts, API errors) are not recorded"
issues_created: [ISS-012]
completed: 2026-10-05
---

# 03-04 Summary

OPM measures real per-turn token use and skill runs locally, and `/opm-report` prints them from code with nothing sent.

## Task commits
- 71901db feat(03-04): Recording and capping
- 16f5f8e feat(03-04): The report command

## Verification
Pinned plugin test 27 pass at the time; npm test 223 pass; validate --strict passes on both CLIs; no $.http or $.model in hooks/mod/.

## Sample output
```
meter: on (toggle with --enable / --disable)
last 14 days: 3 turns (1 subagent)
tokens: input 6,000, output 600, cache read 27,000, cache write 1,500
skill                          turns  median input
opm:tdd-workflow                   2         2,000
opm:writing-plans                  1         3,000
store: 0.6 KiB of 256 KiB
local only, nothing sent
```

## Deviations
- Changed one line in hooks/mod/tests/status.test.ts (registration check now uses toContainEqual) because a second command broke its exact-one assertion.
- An unknown option prints one line naming it; unreadable stored data is reported.
