# OPM 0.7-0.9 State

**Goal:** a measured, CI-gated, low-token OPM where status, safety and cost checks run as code instead of model turns.
**Current focus:** Phase 3 - First mod

## Position

Phase: 3 of 4 (First mod)
Plan: 0 of ? in this phase
Status: Ready to plan
Last activity: 2026-10-05 - Phase 2 complete (0.7.1 on feat/0.7.1-trim-the-core)
Progress: 11 / 11 planned plans done (phases 1-2)

## Recent decisions

- 02-03: references/ files do not count toward SKILL.md size; cap 1,200 tokens enforced for executing-plans and the three stack skills.
- 02-04: doctor injects process runner and fs; exits 1 only on a fail row; no network.
- 02-05: bypass guard inspects only real git invocations and drops heredoc bodies; no arms race.
- 02-06: explainer-video lives in the optional opm-video plugin (source ./plugins/opm-video).
- 02-07: plugin always-on 2,379 tokens, ceiling 2,650.

## Open blockers

- Pushing needs the personal `harshadmadaye` gh account; only dev-firsteconomy and harshadmadaye-fe are signed in. Unblock: `gh auth login` as harshadmadaye.
- Phase 3 mods need Claude Code >= 2.1.287; this machine runs 2.1.273. Mods cannot be exercised in a live session here until Claude Code is updated.

## Deferred issues

8 open - see ISSUES.md. Most relevant to the next phase:
- ISS-003: scheduled latest-CLI CI job.
- ISS-006: doctor should flag an installed plugin older than the package.

## Session continuity

Last session: 2026-10-05
Stopped at: Phase 2 closed
Next: plan Phase 3

Notes for executors: subagents cannot write SUMMARY files (harness guard); the orchestrator writes them from the subagent's report. Until 0.7.1 is installed, the session's live block-no-verify hook is the 0.6.1 copy, which blocks Bash text that mentions git commit hook-skip flags or husky env assignments even in heredocs; use Write/Edit for such content.
