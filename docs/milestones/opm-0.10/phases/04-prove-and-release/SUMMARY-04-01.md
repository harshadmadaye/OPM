---
phase: 04-prove-and-release
plan: 01
requires:
  - { phase: 02-person-in-the-loop, provides: "stop list, review queue and run-discipline rules the evals prove" }
provides:
  - "six behaviour eval cases under evals/ (case.yaml schema 1.1, scaffold.sh, graders/*.md, README naming the rule, file and section)"
  - "scripts/evals/behaviour-eval.js and `npm run eval:behaviour`: refuses without --yes; runs `claude plugin eval . --scaffold --trust-plugin --runs 1 --no-publish --allow-tools Bash Write Edit --max-cost-usd 5 --json evals/results/<date>.json`"
  - "tests/evals-structure.test.js: case structure, every scaffold runs clean offline in a temp dir, runner refusal and argument building"
affects: [04-02, 04-05]
key_files: [evals/, scripts/evals/behaviour-eval.js, tests/evals-structure.test.js, package.json, .gitignore]
key_decisions:
  - "Graded on observable outcomes: tool_used (max 0) and regex file graders plus one LLM criterion per case; the eval tool has no git or shell grader"
  - "Runner grants Bash, Write and Edit to the eval runs (approved by the orchestrator: cases act only inside each temp sample repo)"
  - "Mid-run chat is quoted in the first prompt as background; the tool cannot inject a second message"
  - "evals/results/ is git-ignored raw output; 04-02 commits a cleaned copy under docs/evals/"
issues_created: [ISS-028, ISS-029, ISS-030]
completed: 2026-11-03
---

# 04-01: Behaviour evals and a gated runner

**Six behaviour evals (architecture stop, fresh evidence, mid-run chat, queued human checks, completed ledger tasks, no push without a yes) on scaffolded sample repos, and a runner that spends nothing without --yes.**

## Cases

| Case | Rule proved | Limitation |
|---|---|---|
| stops-on-architecture-change | deviation rule 4, attended | unattended "ruled, logged, queued" path not covered |
| refuses-done-without-output | verification Iron Law | fresh vs re-quoted output only via the Bash check |
| ignores-mid-run-chat | brief preamble | message quoted as background, no real injection |
| queues-human-checks | unattended review queue | checks end state, not who wrote the row |
| skips-completed-ledger-tasks | ledger complete = never re-dispatch | a Bash heredoc rewrite would pass the tool graders |
| no-push-without-yes | finishing step 4 | proven via Bash inputs, not remote refs |

## Task commits

1. Behaviour evals for architecture stop, fresh evidence and mid-run chat - `ba3bd6e`
2. Six behaviour evals and a gated runner - `0d04f4a`

(Cherry-picked from the worktree branch, where they were ee8781c and 33b602b.)

## Deviations from plan

### Auto-fixed
- **[Rule 3]** `--allow-tools Bash Write Edit` added; the eval tool gates those tools.
- **[Rule 3]** `evals/results/` git-ignored; cleaned results go to docs/evals/ instead (orchestrator updated PLAN-04-02).
- **[Noise]** The installed hook reformatted the new test file to double quotes; kept (new file).

### Deferred to ISSUES.md
- ISS-028, ISS-029, ISS-030. The test-file quote style proposal is dismissed (cosmetic; the hook fix ships in 0.10).

## Verification

- `npm test` 349 passed, 0 failed after merge; `node scripts/evals/behaviour-eval.js` prints the cost warning and exits 1; no paid run happened  env: unit
