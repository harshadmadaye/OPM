# Phase 2 review pack: a person in the loop

Range: `git diff 7e7fe00..1e637c1`, 5 plans, 261 -> 293 tests, always-on tokens unchanged (2526 / 2650), milestone-planning core 3156 -> 2295, jump-start 3106 -> 2298. Target: 20-30 minutes.

`review-pack.js 7e7fe00..HEAD` ranked only the script's own commits (its regexes contain the risky words). This phase's risk is in rule text, so items were picked by hand, as the template now says.

## 1. What stops a run (rules that decide when you are interrupted)

`git show 6932480 ffc160d 1e637c1` - "What stops a run" in skills/jump-start/references/build-and-run.md and skills/milestone-planning/references/executing-a-phase.md; jump-start Phase 4; milestone-planning lifecycle step 1.

- Explain how a jump-start run with the default cadence handles a phase close, given "no questions".
- Explain how an architecture change is handled in an attended milestone run versus an unattended one.
- Explain where the cadence is logged, when milestone-planning asks for it, and what an old milestone with no logged cadence does.

## 2. Exposed secret gate

`git show 4909c2c ffc160d 1e637c1` - rulings-and-models.md stop condition 2, full-loop.md section 5, agents/security-reviewer.md, both references.

- Explain how a secret found by a subagent mid-wave reaches the developer, and what happens to sibling plans in that wave.
- Explain what "exposed" covers (git history, logs, client bundle) and what the developer is asked to confirm.
- Explain why the reviewer agent does not remove the secret itself.

## 3. Moving execution detail out of the skill cores

`git show bc6eacb 01d579b 2c1f2fb` - both SKILL.md files against their references/ files; scripts/token-budget.js `SKILL_CEILING_TOKENS`.

- Explain how a planner writing PLAN files with checkpoints now finds the checkpoint table and batching rule.
- Explain how a jump-start run resumed at Phase 7 or 8 finds the dev-server commands.
- Explain what fails if either core passes 2400 tokens, and which skills the ceiling does not cover (ISS-010, ISS-011).

## 4. Review queue for human checks

`git show de54482 7d04a82` - templates/review-queue.md, executing-a-phase.md "Unattended runs", templates/state.md, final-report.md, finishing.md.

- Explain who writes REVIEW-QUEUE.md, who may set a row to passed, and what a failed row becomes.
- Explain how a later plan that depends on a queued check is handled.
- Explain how "complete, N human checks pending" is kept accurate (by hand today; ISS-013).

## 5. review-pack.js

`git show 304909d dac89be` - skills/milestone-planning/scripts/review-pack.js, tests/review-pack.test.js.

- Explain how the range argument is validated and why git cannot receive an option from it.
- Explain how added lines are attributed to files, including quoted and non-ASCII paths and a literal `+++ b/x` line.
- Explain what the script cannot see (merges, prose rules; ISS-014, ISS-018) and how the orchestrator compensates.

## Review findings (opm:code-reviewer on 7e7fe00..4909c2c)

| Severity | Found | Fixed | Parked | Dismissed |
|---|---|---|---|---|
| CRITICAL | 0 | | | |
| HIGH | 1 | 1 (cadence vs no questions, ffc160d) | | |
| MEDIUM | 3 | 3 ("the one case", plan-time read trigger, quoted paths: 2c1f2fb, ffc160d, dac89be) | | |
| LOW | 4 | 2 (Phase 4 read trigger, stale why-opm table) | 2 (ISS-018, ISS-019) | |

Follow-ups found while fixing: deviation rule 4 vs the stop list, and the full gate telling a subagent to stop (both fixed in 1e637c1).

## Things that went differently than planned

- A fifth plan (02-05) was added after the review found contradictions between the new stop rules.
- The orchestrator made the ruling for 02-05 (a cadence pause is a stop for reading; architecture changes in unattended runs are ruled, logged and queued). Check that you agree.
- The installed 0.9.1 Stop hook reformatted untouched files twice more; restored each time.
