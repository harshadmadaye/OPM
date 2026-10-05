# OPM 0.7-0.9 Roadmap

## Retrospective (2026-10-05)

All four phases shipped on stacked branches (PRs #1-#5): 22 plans, 0.7.0 to 0.9.0.

- Measured instead of claimed: always-on cost went from an unmeasured "2,300" (really 2,541) to 2,379 tokens under a CI ceiling of 2,650; executing-plans dropped from about 5,000 to 1,056 tokens per run.
- CI paid for itself on the first run: 9 Windows failures (CRLF checkouts, mixed path separators in doctor), then 3 mod-test failures that only showed once features shared the same events. Both were invisible locally.
- Mods worked as designed but the API differed from the docs in small ways (no colon in command names, $ never crosses an import, one unmatched hook per event per module). Plans written from docs needed correcting after the first mod plan.
- Not yet proven: any mod feature in a live interactive session (this machine runs Claude Code 2.1.273, and the mods switch is cached off), and the full 30-prompt trigger eval.
- Process friction: subagents cannot write report files, so the orchestrator wrote every SUMMARY; the installed 0.6.1 bypass hook blocked heredocs that only mentioned its trigger words (fixed in 0.7.1, still live until the plugin is updated).

Source spec: [docs/specs/2026-10-02-opm-brew.md](../../specs/2026-10-02-opm-brew.md) (brew-idea run wf_8a106824-7a3, revision 1, approved 2026-10-05).

Goal: a measured, low-token, test-first Claude Code workflow where status, safety and cost checks run as code instead of model turns, and every release is gated by CI.

Decisions taken at milestone start (2026-10-05):
- Token ceiling = today's measured always-on cost plus 10% headroom; the README is corrected to measured numbers; later trims lower the ceiling.
- `push-via-api.sh` no longer ships: untracked and git-ignored, kept in the maintainer working copy (ISS-001: move it to `~/.opm/bin/` by hand).
- Native Windows support covers the Node parts (installer, hooks, tests); the shell helpers are documented as macOS, Linux and WSL only.

## Phase 1: Gate and measure (0.7.0)

Goal: every release is tested on macOS, Linux and Windows, and the token-cost claim becomes a number enforced in CI.

- [x] 01-01 Token budget linter (`npm run tokens`) with an always-on ceiling and warn-only per-skill soft caps
- [x] 01-02 Remove the story-video alias, move push-via-api.sh out, untrack firebase-debug.log
- [x] 01-03 GitHub Actions CI: test matrix, release gate, package contents, plugin validate
- [x] 01-04 Release 0.7.0: measured numbers in README and why-opm.md, Windows scope, changelog, versions

Status: Complete (2026-10-05), released as 0.7.0 on the branch

## Phase 2: Trim and steady the core (0.7.1)

Goal: cut per-run tokens, make routing obvious, make install and hook failures visible, on every Claude Code version.

Features: routing table in using-opm plus a 30-prompt fixture; split large skills into SKILL.md plus references/; merge verification-loop into verification-before-completion; `npx opm-core doctor` and the installer's next-step line; Stop hook skips unchanged languages and warns visibly; hook threat model and evasion tests; brew-idea user-invoked only; spin explainer-video out into an optional plugin; dedupe stack pattern skills against rules.

Status: Complete (2026-10-05), released as 0.7.1 on the branch. Plans 02-01..02-07 done; see SUMMARY files.

## Phase 3: First mod (0.8.0)

Goal: status, safety and measured tokens with no model turns, as text that works in the VS Code chat panel. Needs Claude Code v2.1.287 or later; settings hooks stay as the fallback.

Features: `/opm:status` mod command plus `npx opm-core status` fallback and a SessionStart resume line; destructive-command guard as a `tool.call` mod; opt-in local token meter plus `/opm:report`; declared tested Claude Code range plus a scheduled latest-CLI CI job.

Status: Complete (2026-10-05), released as 0.8.0 on the branch. Commands are /opm-status and /opm-report (names cannot contain a colon).

## Phase 4: Evidence-driven growth (0.9.0)

Goal: use measured data to decide merges, migration, positioning and the multi-project view.

Features: skill-trigger eval harness after a design spike; hot-path hooks to mod hooks, gated on a dedupe spike; README positioning rewrite around measured numbers; marketplace submissions; `/opm:status --all`.

Status: Complete (2026-10-05), released as 0.9.0 on the branch. The hot-path migration was proven and done (session-scoped OPM_MOD_ACTIVE).
