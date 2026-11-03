# Phase 3 review pack: evidence quality

Range: `git diff 652f599..HEAD` (Phase 3 commits plus 0bfdc1b), 2 plans, 293 -> 312 tests, always-on tokens unchanged (2526 / 2650). Target: about 15 minutes; a short phase.

All Phase 3 changes are rule text and report formats, so items were picked by hand (review-pack.js sees no risk categories here).

## 1. Where a check ran, and what it can prove

`git show c664295` 0bfdc1b - skills/verification-before-completion/references/full-loop.md (VERIFICATION REPORT, env legend), SKILL.md claim table.

- Explain how Playwright against localhost, a CI run, an integration test against a local database, and a run on a real phone are each labelled.
- Explain what a NOT JUDGEABLE line does to `Overall:`, and how a developer waives a requirement.
- Explain how an old report with no labels is read.

## 2. Real-environment pass in a milestone's definition of done

`git show 09a2ff0` 0bfdc1b - references/executing-a-phase.md, milestone-planning SKILL.md ROADMAP.md section.

- Explain how a milestone declares the requirement and which check satisfies `(physical-device)` versus `(prod-like)`.
- Explain when it is enforced (milestone close) and what happens to a docs-only phase.

## 3. Reviewer confidence and cited lines

`git show d6bcb99 c3b168a` - agents/code-reviewer.md, security-reviewer.md, silent-failure-hunter.md, typescript-reviewer.md, skills/executing-plans/references/reviewer.md.

- Explain how `Confidence:` interacts with code-reviewer's 80% filter, and what the other three agents do with low-confidence findings.
- Explain what happens to a finding that cannot cite a line.
- Explain why agent frontmatter must not change (always-on tokens) and what pins it.

## 4. Findings counted by outcome

`git show c3b168a` - skills/executing-plans/references/finishing.md step 3, skills/jump-start/templates/final-report.md.

- Explain where Fixed, Parked and Dismissed counts come from (the ledger `Finding:` line arrives in 04-04, ISS-022).
- Explain how severity names in the reviewer prompt (Critical / Important / Minor) map to the table (ISS-023).

## Review findings (opm:code-reviewer on 652f599..c3b168a)

| Severity | Found | Fixed | Parked | Dismissed |
|---|---|---|---|---|
| CRITICAL | 0 | | | |
| HIGH | 0 | | | |
| MEDIUM | 3 | 3 (real-env rule, env legend, NOT JUDGEABLE vs Overall) | | |
| LOW | 3 | 1 (code-reviewer uncited wording) | 2 (loose tests, ISS-008; finding-outcome source, ISS-022) | |

## Things that went differently than planned

- The orchestrator added the ROADMAP declaration line during 03-01 and resolved the review's three MEDIUM findings in one follow-up commit, test-first.
- Test E pinned the old "physical-device or prod-like" wording, which the review showed was wrong; it now checks the corrected rule.
