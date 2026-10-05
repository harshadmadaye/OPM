# OPM 0.7-0.9 Issues

Deferred enhancements and known gaps found during execution, numbered ISS-NNN. Reviewed when planning each phase.

- ISS-001: move scripts/push-via-api.sh to ~/.opm/bin/ by hand; the permission system denied the agent writing there (found in 01-02, Task 2).
- ISS-002: Windows parts of CI are unverified until the first real run: hooks test path fixes, Git Bash script-shell, npm via shell:true in the package test, the narrate test's python lookup (found in 01-03).
- ISS-003: add the scheduled latest-CLI job referenced by CLAUDE_CODE_VERSION in ci.yml (found in 01-03; planned for phase 3).
