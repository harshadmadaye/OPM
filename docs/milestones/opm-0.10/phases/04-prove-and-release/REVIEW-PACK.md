# Phase 4 review pack: prove OPM works, release 0.10.0

Range: `git diff e8250be..cff4b91`, 3 plans done (04-01, 04-04, 04-05), 2 deferred (04-02, 04-03: no paid eval runs, your choice), 312 -> 350 tests, version 0.10.0. Target: about 20 minutes.

## 1. The paid eval runner (the only path that spends money)

`git show 0d04f4a 356ed9d` - scripts/evals/behaviour-eval.js, package.json `eval:behaviour`.

- Explain how a run without `--yes` is stopped before anything spawns, and what stops a `--yes` run from publishing a report.
- Explain why it grants Bash, Write and Edit, and where those tools can act.
- Explain how `--case <glob>` reaches `claude` and why it cannot add flags.

## 2. Scaffolded sample repos

`git show ba3bd6e 0d04f4a` - evals/*/scaffold.sh, case.yaml, graders/, README.md.

- Explain how `no-push-without-yes` makes sure a push cannot reach a real remote.
- Explain what each case's README says it cannot prove (mid-run injection, git state).
- Explain what the one smoke score (0.25, before the grader fix) does and does not tell you.

## 3. `status --report`

`git show a46d393 1887bb6 cff4b91` - bin/lib/ledger.mjs (countLedgerOutcomes, countMilestoneOutcomes, formatReport), bin/status.js.

- Explain how a symlinked ISSUES.md or ledger pointing outside the repo is handled.
- Explain how findings avoid being counted twice from ledger `Finding:` lines and review packs.
- Explain how an issue counts as closed (strike-through) and why words like "fixed" do not count.

## 4. Release claims

`git show 04dd378 cddffe3 706c987` - CHANGELOG.md 0.10.0, README.md, docs/using-opm.md, docs/evals.md, version fields.

- Explain how items 12 and 13 are worded so nobody reads them as measured.
- Explain which files carry the version and how tests/manifest.test.js checks them.
- Explain what the definition of done says about evals and why 0.10.0 does not meet that line (ISS-031, ISS-032).

## Review findings (opm:code-reviewer on e8250be..bb3f247)

| Severity | Found | Fixed | Parked | Dismissed |
|---|---|---|---|---|
| CRITICAL | 0 | | | |
| HIGH | 0 | | | |
| MEDIUM | 1 | 1 (double-counted findings, cff4b91) | | |
| LOW | 2 | 1 (docs said "and git", cff4b91) | 1 (ISS-033) | |

## Things that went differently than planned

- The paid behaviour-eval run was started under your blanket auto-approve and stopped after one smoke case ($0.44) when you asked about cost; you chose to skip paid evals.
- 04-02 committed one harness fix before it was stopped (`356ed9d`: tool_used graders need `min: 0`, no ablation arm); kept, since a future run needs it.
