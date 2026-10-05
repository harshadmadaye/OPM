---
phase: 04-evidence
plan: 02
requires:
  - { phase: 03-first-mod, provides: mod skeleton and guard pattern (03-02, 03-03) }
provides:
  - hooks/lib/bypass-rules.mjs: pure findBypass, bypassDenial, configLookup, configEditKind, configAskReason
  - hooks/mod/bypass.mjs: tool.call checks (Bash deny; Edit and Write ask via $.ui.ask; fail-closed .catch)
  - OPM_MOD_ACTIVE=<session id> set at session.start; block-no-verify and config-protection step aside only for that session
affects: [04-04, 04-05]
key_files: [hooks/lib/bypass-rules.mjs, hooks/mod/bypass.mjs, hooks/mod/register.mjs, hooks/scripts/block-no-verify.js, hooks/scripts/config-protection.js, tests/hooks.test.js, docs/threat-model.md]
key_decisions:
  - "dedupe through an environment variable, proven live on 2.1.289 (settings-hook process saw the value the mod set)"
  - "the value is the session id, compared with stdin session_id, so an inherited variable in a nested older Claude Code never silences its checks; if ids differ both sides check"
  - "the caller reads files and the rules module only judges; OPM_HOOKS_DISABLED and OPM_ALLOW_CONFIG_EDITS behave the same on both sides"
  - "nobody answering the config question is a deny"
issues_created: [ISS-014, ISS-015]
completed: 2026-10-05
---

# 04-02 Summary

OPM's hook-bypass and config checks run once per tool call: in process on Claude Code 2.1.287+, as settings hooks on older builds, sharing one rules module.

## Spike evidence
Temp plugin copy loaded with `npx -y @anthropic-ai/claude-code@2.1.289 --plugin-dir <copy> -p ... --model haiku --max-turns 2`, a temporary log line in each script: `block-no-verify pid=58327 OPM_MOD_ACTIVE=1` and `pid=58434 OPM_MOD_ACTIVE=1` while the parent shell had it unset. Cost total_cost_usd 0.0464.

## Task commits
- 7e297a3 feat(04-02): Dedupe spike
- 5f6bb67 refactor(04-02): shared rules module and mod checks (committed by the orchestrator)
- 95d9852 fix(04-02): scope the mod dedupe to the session that set it (orchestrator, test-first)
- cb9971d docs(04-02): describe the session-scoped dedupe in the threat model

## Verification
npm test 237 pass after merge; validate --strict passes on both CLIs; mod tests run in CI on PR #5 (the kit is switched off on this machine). Substitutes run locally: strict tsc on bypass.test.ts and a hand smoke run of 7 cases.

## Deviations
- The mod hooks Edit and Write only; 2.1.289 has no MultiEdit tool.
- The session-id scoping was added by the orchestrator after the executor flagged the inherited-variable gap.
