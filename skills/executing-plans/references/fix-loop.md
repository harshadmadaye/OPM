### 4. The fix loop (up to 3 rounds)

The loop triggers on spec ISSUES, any Critical or Important finding, or a "Cannot verify" you confirmed as a gap. Two routes leave it immediately:

- **Minor findings** go to the ledger (`Task <N>: minor (deferred): <one-liner>`) for the final review to triage. They never enter the loop.
- **Plan-mandated findings**, or any finding that conflicts with the plan text: rule on it with the spec as authority, ledger the ruling, then either dispatch the fix or park it. Never dismiss a finding because the plan mandates it.

A fix round is one fix dispatch plus one scoped re-review.

- **Rounds 1-2:** resume the original implementer (SendMessage to its agent ID) with the open findings verbatim and the covering test files to re-run. If it cannot be resumed, dispatch a fresh implementer with the brief plus the findings.
- **Round 3:** dispatch a fresh implementer on a more capable model with the brief, the findings, and: "A prior implementer attempted this task twice; you own it now."
- **Every round:** the implementer fixes, re-runs the covering tests, and reports commits plus test output. Then dispatch a scoped re-review (mid tier or cheaper) with the findings list and `git diff <FIX_BASE>..<HEAD>` where FIX_BASE is the head the previous review saw. The re-reviewer verdicts each finding ADDRESSED or NOT ADDRESSED ("attempted" is not addressed), flags new Critical/Important breakage in the fix diff only, and lists out-of-scope observations, which go to the ledger as deferred minors.
- **After each round**, ledger: `Task <N>: fix round <R>/3 (<X> addressed, <Y> open - <one-liners>; commits <a7>..<b7>)`.

**The breaker.** If round 3 still leaves findings open, stop dispatching and adjudicate each open finding yourself:
- Reviewer wrong or contestable: `Task <N>: parked - <finding> - Ruling: <why the code stands>`.
- Real but nothing downstream builds on it: park it with a ruling that says real and deferred.
- Real and load-bearing (a later task builds on it, or it reveals a plan defect): rule on the smallest change that unblocks dependent work, ledger it, carry it into the next task's brief. Stop only if every path forward is a guess.

Adjudicate only at the cap. Every adjudication is a ledger entry; silent discards are forbidden.

### 5. Complete the task

When the review is clean, or every open finding is parked with a ruling at the cap, append:
- `Task <N>: complete (commits <base7>..<head7>, review clean)`, or
- `Task <N>: complete (commits <base7>..<head7>, <K> parked)`

Mark the todo complete and move to the next task. Never move on while Critical/Important findings are neither fixed nor parked-with-ruling.
