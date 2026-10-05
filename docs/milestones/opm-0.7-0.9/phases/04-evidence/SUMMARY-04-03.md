---
phase: 04-evidence
plan: 03
requires:
  - { phase: 02-trim-the-core, provides: tests/fixtures/trigger-prompts.json (02-01) }
provides:
  - docs/evals.md: spike evidence and how to run the eval
  - scripts/evals/trigger-eval.js (parseSkillInvocations, observedSkill, runEval, formatReport; --yes, --limit, --only)
  - tests/trigger-eval.test.js (12 tests); npm script eval:triggers (not part of npm test or CI)
affects: [04-04, 04-05]
key_files: [scripts/evals/trigger-eval.js, tests/trigger-eval.test.js, docs/evals.md, package.json]
key_decisions:
  - "observed skill = first opm: skill other than using-opm; a refused user-invoked skill still counts as the routing choice"
  - "manual only, guarded by --yes; each prompt runs in a temp directory with --setting-sources project,local"
  - "runner uses --max-turns 2 because haiku sometimes reloads using-opm first"
issues_created: [ISS-016, ISS-017, ISS-018]
completed: 2026-10-05
---

# 04-03 Summary

A headless spike showed `claude -p` emits a Skill tool_use naming the OPM skill, so a manual eval runner with a tested parser now measures routing for about $0.02 per prompt.

## Spike (Claude Code 2.1.273, haiku, --max-turns 1, --plugin-dir)
1. spike, "fix the off-by-one in pagination.ts": opm:tdd-workflow (hit)
2. bounded, "add password reset by email to our Next.js app": opm:using-opm (reload; the one-turn limit stopped it)
3. contested, "I am not sure whether a marketplace for tutors is worth building, brew this idea": opm:brew-idea (correct choice, refused because brew-idea is user-invoked only)
Cost: $0.0235 + $0.0239 + $0.0231, about $0.07; a full 30-prompt run is about $0.70.

## Task commits
- febdaff docs(04-03): Spike on 3 prompts
- d5c41f7 feat(04-03): Eval runner (TDD for the parser)

## Deviations
- Spike ran in empty temp directories (git init was blocked in the scratchpad).
- One contested fixture prompt was swapped for another after the session refused it.
- Recorded JSON lines live inside the test file, trimmed of ids and paths.
