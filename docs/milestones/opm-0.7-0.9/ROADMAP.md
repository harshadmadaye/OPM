# OPM 0.7-0.9 Roadmap

Source spec: [docs/specs/2026-10-02-opm-brew.md](../../specs/2026-10-02-opm-brew.md) (brew-idea run wf_8a106824-7a3, revision 1, approved 2026-10-05).

Goal: a measured, low-token, test-first Claude Code workflow where status, safety and cost checks run as code instead of model turns, and every release is gated by CI.

Decisions taken at milestone start (2026-10-05):
- Token ceiling = today's measured always-on cost plus 10% headroom; the README is corrected to measured numbers; later trims lower the ceiling.
- `push-via-api.sh` moves out of the repo (a copy lives in `~/.opm/bin/`).
- Native Windows support covers the Node parts (installer, hooks, tests); the shell helpers are documented as macOS, Linux and WSL only.

## Phase 1: Gate and measure (0.7.0)

Goal: every release is tested on macOS, Linux and Windows, and the token-cost claim becomes a number enforced in CI.

- [ ] 01-01 Token budget linter (`npm run tokens`) with an always-on ceiling and warn-only per-skill soft caps
- [ ] 01-02 Remove the story-video alias, move push-via-api.sh out, untrack firebase-debug.log
- [ ] 01-03 GitHub Actions CI: test matrix, release gate, package contents, plugin validate
- [ ] 01-04 Release 0.7.0: measured numbers in README and why-opm.md, Windows scope, changelog, versions

Status: Planned

## Phase 2: Trim and steady the core (0.7.1)

Goal: cut per-run tokens, make routing obvious, make install and hook failures visible, on every Claude Code version.

Features: routing table in using-opm plus a 30-prompt fixture; split large skills into SKILL.md plus references/; merge verification-loop into verification-before-completion; `npx opm-core doctor` and the installer's next-step line; Stop hook skips unchanged languages and warns visibly; hook threat model and evasion tests; brew-idea user-invoked only; spin explainer-video out into an optional plugin; dedupe stack pattern skills against rules.

Status: Not planned

## Phase 3: First mod (0.8.0)

Goal: status, safety and measured tokens with no model turns, as text that works in the VS Code chat panel. Needs Claude Code v2.1.287 or later; settings hooks stay as the fallback.

Features: `/opm:status` mod command plus `npx opm-core status` fallback and a SessionStart resume line; destructive-command guard as a `tool.call` mod; opt-in local token meter plus `/opm:report`; declared tested Claude Code range plus a scheduled latest-CLI CI job.

Status: Not planned

## Phase 4: Evidence-driven growth (0.9.0)

Goal: use measured data to decide merges, migration, positioning and the multi-project view.

Features: skill-trigger eval harness after a design spike; hot-path hooks to mod hooks, gated on a dedupe spike; README positioning rewrite around measured numbers; marketplace submissions; `/opm:status --all`.

Status: Not planned
