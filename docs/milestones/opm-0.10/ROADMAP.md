# OPM 0.10 Roadmap

Source spec: [docs/specs/2026-11-03-opm-0.10.md](../../specs/2026-11-03-opm-0.10.md). Item numbers below match the spec.

Goal: OPM protects the developer's judgment on long runs. A person checks what only a person can judge, every piece of evidence says where it came from, and OPM's own rules are proven by evals, without slowing the default flow.

Branch: `feat/0.10-human-judgment`, cut from `main` at 104c7fd (not from `feat/mod-on-by-default`).

Decisions taken at milestone start (2026-11-03):
- Rules go into existing skills and templates; no new skill. Long text goes in `references/` so the enforced soft cap on executing-plans still holds.
- Always-on budget is 2,526 of 2,650 tokens (124 left). using-opm is not edited unless a plan proves it must be, and any edit is measured with `npm run tokens`.
- Backward compatibility: every new field (`env`, review cadence, REVIEW-QUEUE.md, new ledger lines) is optional. A missing field means the old behaviour, and the ledger parser keeps reading old ledgers.
- Only Phase 1 is planned in detail now. Phases 2 to 4 are planned when the previous phase closes and the developer has read its review pack, so the plans can use what was learned.
- Phase 1 closes with a review pack written by hand in the item 7 format, because the tooling for it ships in Phase 2.

## Phase 1: Orchestration reliability

Goal: unattended runs stop losing work. The orchestrator owns report files, briefs cannot be hijacked by chat, an agent with no commits is never marked done, and formatters follow the project's own config.

- [ ] 01-01 Report files are written by the orchestrator (item 1)
- [ ] 01-02 Self-contained briefs and "no commits means not done" (items 2, 3)
- [ ] 01-03 Formatter hook respects project config and only the turn's files (item 4)
- [ ] 01-04 OPM learnings flow back to OPM (item 5)

Waves: 01-01, 01-03 and 01-04 in wave 1; 01-02 in wave 2 (it edits the same skill files as 01-01).

Phase close: review pack (5 riskiest changes, diff ranges, questions), read by the developer before Phase 2 is planned.

Status: Planned (2026-11-03)

## Phase 2: A person in the loop

Goal: no human check is passed by an agent, the developer gets a 20 to 30 minute review pack per phase, chooses the review cadence, and an exposed secret stops the run at once.

Planned plans (written in full when Phase 1 closes):
- 02-01 Review queue: REVIEW-QUEUE.md template, `checkpoint:human-verify` routes there in unattended runs, STATE shows "complete, N human checks pending", final reports list pending checks first; test (item 6)
- 02-02 Review pack at phase close: risk ranking, diff range per change, "explain how X handles Y" questions (item 7)
- 02-03 Review cadence question in jump-start and milestone-planning, logged as a decision with the expected commit count; exposed secrets become a blocking human-action checkpoint (items 8, 9)

Status: Not planned

## Phase 3: Evidence quality

Goal: every check says where it ran, simulator-only claims about performance are called out, and reviewer blind spots are visible in numbers.

Planned plans:
- 03-01 `env:` label in the verification gate, "not judgeable" rule for simulator performance claims, optional real-environment pass in a milestone's definition of done (item 10)
- 03-02 Reviewer calibration: confidence and cited line in every agent's output, finding counts by severity and outcome in the final reports (item 11)

Status: Not planned

## Phase 4: Prove OPM works, release 0.10.0

Goal: behaviour evals prove the rules above on small sample repos, the full trigger eval is measured, the outcome report comes from data, and 0.10.0 ships.

Planned plans:
- 04-01 Eval harness spike: `claude plugin eval` (present in Claude Code 2.1.317) against `scripts/evals/`, sample repo fixtures, `--yes` gate (item 12)
- 04-02 Six behaviour evals, run once, results committed, failures logged as issues (item 12)
- 04-03 Full 30-prompt trigger eval with `--max-turns 2`, hit-rate table in docs/evals.md (item 13, closes 0.9 ISS-016)
- 04-04 Outcome report in `bin/status.js` from ledger and git (item 14)
- 04-05 Release 0.10.0: README, docs/using-opm.md, CHANGELOG, versions in package.json and `.claude-plugin/*.json`

Status: Not planned

## Definition of done

- `npm test` green, including new tests for items 1, 3, 4 and 6; `npm run tokens` within the ceiling.
- Behaviour evals run once with results committed; every failure is an ISS entry.
- README, docs/using-opm.md and CHANGELOG updated; version 0.10.0.
- Each phase ended with a review pack the developer read before the next phase started.
