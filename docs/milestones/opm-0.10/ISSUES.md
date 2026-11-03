# OPM 0.10 Issues

Deferred enhancements and known gaps found during execution, numbered ISS-NNN. Reviewed when planning each phase. Numbering restarts for this milestone; 0.9 issues are cited as "0.9 ISS-NNN".

- ISS-001: report-ownership Test A misses subjectless imperatives in briefs ("write the SUMMARY"); scan brief/prompt fences for imperative write verbs plus report-file names (found in 01-01, Task 1)
- ISS-002: milestone-planning (2982 tokens) and jump-start (2938) are far over the 1200 soft cap; move "Executing a phase" detail to references/; compound-learnings (1868) likewise, via its retrieval grep examples (found in 01-01 Task 2, 01-04)
- ISS-003: no eval checks that compound-learnings sets `component: opm` only for OPM-caused lessons and never runs `gh issue create` without a yes; candidate for Phase 4 (found in 01-04, Task 2)
- ISS-004: list `component` in compound-learnings step 3's frontmatter fields sentence, or restrict to a known set once a second value appears (found in 01-04, Task 1)
- ISS-005: the new hook tests (realpath, .cmd shims) have only run on macOS; run them on Windows when CI exists (found in 01-03, Task 1)
