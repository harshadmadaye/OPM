# Changelog

## 0.2.0 - 2026-09-12

- New skill `opm:jump-start <name> <brief>`: brief to running project in one command. Gap-driven brainstorming, design artifact with per-revision approval, unattended multi-agent build under the developer's chosen permission mode, verification, local run or device launch.
- New helper `scripts/dev-server.sh` to start, stop and inspect detached dev processes, with tests.
- `using-opm` mentions jump-start in the workflow map.

## 0.1.0 - 2026-09-12

Initial release, assembled from a review of ECC, superpowers, compound-engineering and GSD.

- Workflow skills: using-opm, brainstorming, writing-plans, executing-plans, verification-before-completion
- Engineering skills: tdd-workflow, verification-loop, compound-learnings, milestone-planning
- Stack skills: react-patterns, python-patterns, flutter-patterns
- Agents: code-reviewer, typescript-reviewer, planner, silent-failure-hunter, security-reviewer
- Hooks: session-start context, block-no-verify, config-protection, post-edit accumulator, stop format/typecheck, console-log check
- Rules to copy into repos: common, typescript, react, python, dart
