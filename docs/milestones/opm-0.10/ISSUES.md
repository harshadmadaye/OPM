# OPM 0.10 Issues

Deferred enhancements and known gaps found during execution, numbered ISS-NNN. Reviewed when planning each phase. A closed entry is struck through (`- ~~ISS-NNN: ...~~ closed in <plan>`); `status --report` counts it as closed. Numbering restarts for this milestone; 0.9 issues are cited as "0.9 ISS-NNN".

- ISS-001: report-ownership Test A misses subjectless imperatives in briefs ("write the SUMMARY"); scan brief/prompt fences for imperative write verbs plus report-file names (found in 01-01, Task 1)
- ~~ISS-002: milestone-planning (3156 tokens after 01-02) and jump-start (3106) are far over the 1200 soft cap; move "Executing a phase" detail to references/; compound-learnings (1868) likewise, via its retrieval grep examples (found in 01-01 Task 2, 01-04)~~ closed in 02-01
- ISS-003: no eval checks that compound-learnings sets `component: opm` only for OPM-caused lessons and never runs `gh issue create` without a yes; candidate for Phase 4 (found in 01-04, Task 2)
- ISS-004: list `component` in compound-learnings step 3's frontmatter fields sentence, or restrict to a known set once a second value appears (found in 01-04, Task 1)
- ISS-005: the new hook tests (realpath, .cmd shims) have only run on macOS; run them on Windows when CI exists (found in 01-03, Task 1)
- ISS-006: brew-idea prompts carry a brief, not a plan, yet the preamble says "The plan below is your task"; allow a "brief" variant and let tests/run-discipline.test.js accept either (found in 01-02, Task 2)
- ISS-007: stop hook runTool uses `shell: true` on Windows with unquoted file paths; a space breaks the call and `&`/`^` reach cmd.exe. Quote args or avoid the shell (Phase 1 review, LOW; pre-existing)
- ISS-008: skill-text tests are loose: run-discipline A/B/C match anywhere in a section (preamble need not open the brief; "background" alone half-satisfies B); report-ownership exempts any sentence naming the orchestrator; compound-learnings consent test does not check for "Neither"; nothing mechanically checks that only a person edits a REVIEW-QUEUE.md row; evidence-env and human-gates tests are regex-only too (a simulator-only performance claim should be shown to come out NOT JUDGEABLE). Phase 4 behaviour evals should prove these (Phase 1 review, LOW)
- ~~ISS-009: after a no-commit escalation, resuming from the ledger shows the task as current with no "escalated" marker in status output; bin/status.js should surface it (Phase 1 review, LOW; fits 04-04)~~ closed in 04-04
- ISS-010: tdd-workflow (2784), brainstorming (2690) and brew-idea (2557) are over the soft cap and unenforced; split into references/ and add to SKILL_CEILING_TOKENS (found in 02-01)
- ISS-011: token-budget.js has ENFORCED_SOFT_CAP_SKILLS and SKILL_CEILING_TOKENS for the same job; merge into one per-skill ceiling map (found in 02-01)
- ISS-012: milestone-planning's mid-run chat notice now lives only in references/executing-a-phase.md; consider a one-line mention in the core (found in 02-01)
- ~~ISS-013: STATE's "complete, N human checks pending" is counted by hand; bin/status.js should count pending REVIEW-QUEUE.md rows (found in 02-02; fits 04-04)~~ closed in 04-04
- ISS-014: review-pack.js is regex-only and misses risks outside its eight categories (skill-text rules, changed defaults); consider a per-project `.opm/risk-paths` list (found in 02-03)
- ISS-015: review-pack.js runs one `git show` per commit; a single `git log -p` pass would be faster on large ranges (found in 02-03)
- ~~ISS-016: milestone-planning (2389) and jump-start (2396) cores have almost no room under the 2400 ceiling; move Red flags / Safety / Gates tables to references/ before adding rules (found in 02-04)~~ closed in 02-05
- ISS-017: "wait for the developer to confirm rotation" is prose only; an unattended run stopped on a secret leaves no durable marker. Write a REVIEW-QUEUE.md row or a STATE.md blocker when the gate fires (found in 02-04)
- ISS-018: review-pack.js skips merges (`--no-merges`), so conflict resolutions are invisible; any deleted file scores as data deletion (noisy); path-only test/doc hits still rank at 0.75 (Phase 2 review, LOW)
- ISS-019: the expected-commit-count rule ignores REVIEW-PACK and queue commits at phase close; it undercounts slightly (Phase 2 review, LOW)
- ISS-020: review-pack.js `unquote` strips quotes but not C escapes, so paths git still quotes (tab, quote, backslash, newline) keep escapes and may miss path categories (found in 02-05, Task 3)
- ~~ISS-021: the VERIFICATION REPORT has no gate line for E2E or smoke runs, which are the checks that run in a simulator or on a device; every example line defaults to env: unit. Add an optional "Real-env" line (found in 03-01)~~ closed in 0bfdc1b
- ~~ISS-022: finishing.md counts findings "from reviewer reports and ledger", but the ledger has no line for a finding's outcome; define `Finding: <SEVERITY> <fixed|parked|dismissed> - <summary>` (found in 03-02; taken into 04-04)~~ closed in 04-04
- ISS-023: the executing-plans reviewer prompt uses Critical / Important / Minor while the agents and report tables use CRITICAL / HIGH / MEDIUM / LOW; align or state the mapping (found in 03-02)
- ISS-024: `status --report` sums every ledger in docs/plans/, including earlier milestones, so "tasks done" and "rulings made" mix history; consider `--since` or scoping to the milestone (found in 04-04)
- ISS-025: the strike-through closing rule for ISSUES.md is documented in this file and `status` usage only; add it to milestone-planning's ISSUES.md guidance (found in 04-04)
- ISS-026: a finding recorded both as a ledger `Finding:` line and in a REVIEW-PACK table is counted twice; dedupe or count packs only (found in 04-04)
- ISS-027: formatReport and mergeSeverityCounts are tested only through the CLI; add direct unit tests (found in 04-04)
- ISS-028: `claude plugin eval` has no git-state or shell grader, so "no push" and "no re-dispatch" are proven only through tool inputs and file contents; re-check when custom graders exist (found in 04-01)
- ISS-029: no mid-run user message injection in `claude plugin eval`; the mid-run chat rule is tested only as a quoted background message (found in 04-01)
- ISS-030: tests/evals-structure.test.js validates grader `type` but not the shape of keys like `max`, `match`, `target` (found in 04-01, LOW)
- ISS-031: the six behaviour evals are authored but not run; the developer chose not to pay for eval runs for 0.10.0. Run `npm run eval:behaviour -- --yes` (smoke one case first) and turn failures into issues (04-02, deferred)
- ISS-032: the full 30-prompt trigger eval was not run for 0.10.0 (about $0.70); 0.9 ISS-016 stays open (04-03, deferred)
