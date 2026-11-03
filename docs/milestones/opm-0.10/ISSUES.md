# OPM 0.10 Issues

Deferred enhancements and known gaps found during execution, numbered ISS-NNN. Reviewed when planning each phase. Numbering restarts for this milestone; 0.9 issues are cited as "0.9 ISS-NNN".

- ISS-001: report-ownership Test A misses subjectless imperatives in briefs ("write the SUMMARY"); scan brief/prompt fences for imperative write verbs plus report-file names (found in 01-01, Task 1)
- ISS-002: milestone-planning (3156 tokens after 01-02) and jump-start (3106) are far over the 1200 soft cap; move "Executing a phase" detail to references/; compound-learnings (1868) likewise, via its retrieval grep examples (found in 01-01 Task 2, 01-04)
- ISS-003: no eval checks that compound-learnings sets `component: opm` only for OPM-caused lessons and never runs `gh issue create` without a yes; candidate for Phase 4 (found in 01-04, Task 2)
- ISS-004: list `component` in compound-learnings step 3's frontmatter fields sentence, or restrict to a known set once a second value appears (found in 01-04, Task 1)
- ISS-005: the new hook tests (realpath, .cmd shims) have only run on macOS; run them on Windows when CI exists (found in 01-03, Task 1)
- ISS-006: brew-idea prompts carry a brief, not a plan, yet the preamble says "The plan below is your task"; allow a "brief" variant and let tests/run-discipline.test.js accept either (found in 01-02, Task 2)
- ISS-007: stop hook runTool uses `shell: true` on Windows with unquoted file paths; a space breaks the call and `&`/`^` reach cmd.exe. Quote args or avoid the shell (Phase 1 review, LOW; pre-existing)
- ISS-008: skill-text tests are loose: run-discipline A/B/C match anywhere in a section (preamble need not open the brief; "background" alone half-satisfies B); report-ownership exempts any sentence naming the orchestrator; compound-learnings consent test does not check for "Neither". Phase 4 behaviour evals should prove these (Phase 1 review, LOW)
- ISS-009: after a no-commit escalation, resuming from the ledger shows the task as current with no "escalated" marker in status output; bin/status.js should surface it (Phase 1 review, LOW; fits 04-04)
- ISS-010: tdd-workflow (2784), brainstorming (2690) and brew-idea (2557) are over the soft cap and unenforced; split into references/ and add to SKILL_CEILING_TOKENS (found in 02-01)
- ISS-011: token-budget.js has ENFORCED_SOFT_CAP_SKILLS and SKILL_CEILING_TOKENS for the same job; merge into one per-skill ceiling map (found in 02-01)
- ISS-012: milestone-planning's mid-run chat notice now lives only in references/executing-a-phase.md; consider a one-line mention in the core (found in 02-01)
