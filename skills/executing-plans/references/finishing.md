## Finishing

1. **Final whole-branch review.** Dispatch a `code-reviewer` subagent (most capable tier) with the plan path, the spec path, `git diff <branch-base>..HEAD`, and the ledger's deferred-minor and parked lines to triage. For security-relevant diffs, also dispatch `security-reviewer`; for diffs heavy in error handling, `silent-failure-hunter`. If findings come back, dispatch ONE fix subagent with the complete list (never one fixer per finding), then one scoped re-review. Residual findings get adjudicated and ledgered; there is no second fix wave.
2. **Verify.** Invoke `opm:verification-before-completion`: run the full test suite, linter, type check, and build fresh; walk the spec requirement by requirement. No claims without output.
3. **Report rulings.** Collect every ledger line containing `Ruling:` or `parked` into your final message under "Rulings I made", in order, each with what it costs if wrong. This list is the only place decisions you took on the user's behalf reach them.
4. **Offer the PR.** Present a summary of the branch and ask whether to open a pull request (`gh pr create`) or leave the branch for them. Do not push or open the PR without a yes; that is stop condition 3.
5. **Compound learnings.** If anything non-obvious was learned (a gotcha in the toolchain, a plan defect pattern, a reviewer finding that recurred), invoke `opm:compound-learnings` to capture it. Skip it if nothing surprised you, and say so.

Leave the ledger in place; it is the record of how the branch was built.
