# OPM 0.7-0.9 Issues

Deferred enhancements and known gaps found during execution, numbered ISS-NNN. Reviewed when planning each phase.

- ISS-001: move scripts/push-via-api.sh to ~/.opm/bin/ by hand; the permission system denied the agent writing there (found in 01-02, Task 2).
- ISS-002: Windows parts of CI are unverified until the first real run: hooks test path fixes, Git Bash script-shell, npm via shell:true in the package test, the narrate test's python lookup (found in 01-03). First CI run (2026-10-05): 9 Windows failures, fixed by .gitattributes eol=lf (aece761) and doctor path normalisation (4a8dc45); rerun green on all 9 jobs. Resolved.
- ISS-003: add the scheduled latest-CLI job referenced by CLAUDE_CODE_VERSION in ci.yml (found in 01-03; planned for phase 3). Addressed in 03-05; confirm after the first scheduled run.
- ISS-004: brainstorming uses "spike" for a throwaway feasibility question while the using-opm routing table uses it for a 10-line fix; reconcile the wording (found in 02-01).
- ISS-005: brainstorming says bounded work proceeds with no plan document, but the routing table sends bounded work to brainstorming then writing-plans; writing-plans needs an inline mode for up to 3 tasks (found in 02-01).
- ISS-006: doctor does not flag an installed plugin older than the package (seen: 0.6.1 installed vs 0.7.0); fold into the tested-range check in phase 3 (found in 02-04). Resolved in 03-05.
- ISS-007: the regex heredoc detector in block-no-verify can be fooled by `<<` inside quotes or arithmetic; accepted as out of scope per docs/threat-model.md (found in 02-05).
- ISS-008: verification-before-completion SKILL.md is 1,371 tokens, over the 1,200 soft cap (warn only, not an enforced skill); trim or enforce later (found in 02-02).
- ISS-009: bin/install.js USAGE text lists neither `doctor` nor `status` (found in 03-01).
- ISS-010: the weekly scheduled CI run shares the main concurrency group (can cancel or be cancelled by a push) and runs the full matrix, not only latest-cli (found in 03-05).
