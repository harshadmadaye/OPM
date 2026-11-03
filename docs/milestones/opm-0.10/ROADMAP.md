# OPM 0.10 Roadmap

## Retrospective (2026-11-03)

Shipped locally as 0.10.0 in one session: 16 plans planned, 14 done (including two review-fix plans the reviews called for), 2 deferred. Tests 241 -> 350; always-on tokens unchanged at 2526 / 2650; milestone-planning and jump-start cores cut from about 3100 to about 2300 tokens.

- Worked: a code review at every phase close found real contradictions (Phase 2's stop rules, Phase 3's env legend, Phase 4's double count) that the plan-level tests passed straight through. Keep the per-phase review.
- Worked: the orchestrator writing every report file; no SUMMARY was lost.
- Cost us: the installed 0.9.1 Stop hook restyled files in this repo on most turns; fixed in this release (prettier and ruff opt-in).
- Cost us: agent worktrees start at main, not the current branch; briefs must name the base sha.
- Missed: the definition of done asked for behaviour evals run once. They are authored and gated but not run, because the developer chose not to pay for eval runs; paid steps need an explicit yes even under auto-approve.
- Open: 26 issues in ISSUES.md; most relevant next are ISS-031/032 (run the evals), ISS-008 (loose text tests), ISS-010/011 (other skills over the soft cap).

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

- [x] 01-01 Report files are written by the orchestrator (item 1)
- [x] 01-02 Self-contained briefs and "no commits means not done" (items 2, 3)
- [x] 01-03 Formatter hook respects project config and only the turn's files (item 4)
- [x] 01-04 OPM learnings flow back to OPM (item 5)

Waves: 01-01, 01-03 and 01-04 in wave 1; 01-02 in wave 2 (it edits the same skill files as 01-01).

Phase close: review pack (5 riskiest changes, diff ranges, questions), read by the developer before Phase 2 is planned.

Status: Complete (2026-11-03). 260 tests green, always-on 2526 / 2650. Review pack: phases/01-orchestration-reliability/REVIEW-PACK.md

## Phase 2: A person in the loop

Goal: no human check is passed by an agent, the developer gets a 20 to 30 minute review pack per phase, chooses the review cadence, and an exposed secret stops the run at once.

- [x] 02-01 Slim milestone-planning and jump-start into references/, cap their size (ISS-002)
- [x] 02-02 Review queue for human checks in unattended runs (item 6)
- [x] 02-03 Review pack at every phase close, with a risk-ranking script (item 7)
- [x] 02-04 Review cadence choice and the exposed-secret gate (items 8, 9)
- [x] 02-05 Phase 2 review fixes: one stop list, cadence asked once, review-pack quoted paths

Waves: 1 to 5 in order (all edit milestone-planning and jump-start), run in the main checkout.

Status: Complete (2026-11-03). 293 tests green. Review pack: phases/02-person-in-the-loop/REVIEW-PACK.md

## Phase 3: Evidence quality

Goal: every check says where it ran, simulator-only claims about performance are called out, and reviewer blind spots are visible in numbers.

- [x] 03-01 `env:` label in the verification gate, "not judgeable" rule for simulator performance claims, optional real-environment pass in a milestone's definition of done (item 10)
- [x] 03-02 Reviewer calibration: confidence and cited line in every agent's output, finding counts by severity and outcome in the final reports (item 11)

Waves: 03-01 then 03-02 (both edit jump-start final-report.md).

Status: Complete (2026-11-03). 309 tests green. Review pack: phases/03-evidence-quality/REVIEW-PACK.md

## Phase 4: Prove OPM works, release 0.10.0

Goal: behaviour evals prove the rules above on small sample repos, the full trigger eval is measured, the outcome report comes from data, and 0.10.0 ships.

- [x] 04-01 Six behaviour evals on sample repos and a gated runner, nothing paid (item 12)
- [ ] 04-02 Run the behaviour evals once (deferred 2026-11-03: the developer chose not to pay for eval runs; ISS-031)
- [ ] 04-03 (deferred, ISS-032) Full 30-prompt trigger eval with `--max-turns 2`, hit-rate table in docs/evals.md (item 13, closes 0.9 ISS-016)
- [x] 04-04 `status --report` outcome report from ledger and milestone files (item 14, ISS-009, ISS-013, ISS-022)
- [x] 04-05 Release 0.10.0: README, docs/using-opm.md, CHANGELOG, versions in package.json and `.claude-plugin/*.json`

Waves: 1 = 04-01 + 04-04 (parallel, worktrees); 2 = 04-02 and 3 = 04-03 deferred (paid); 4 = 04-05 (local release, nothing pushed).

Status: Complete (2026-11-03) with 04-02 and 04-03 deferred. 350 tests green, 0.10.0 committed locally. Review pack: phases/04-prove-and-release/REVIEW-PACK.md

## Definition of done

- `npm test` green, including new tests for items 1, 3, 4 and 6; `npm run tokens` within the ceiling.
- Behaviour evals run once with results committed; every failure is an ISS entry. **Not met for 0.10.0**: evals are authored and gated but not run, by the developer's choice (ISS-031, ISS-032).
- README, docs/using-opm.md and CHANGELOG updated; version 0.10.0.
- Each phase ended with a review pack the developer read before the next phase started.
