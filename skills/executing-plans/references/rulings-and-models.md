## Continuous Execution and Rulings

Do not pause to check in between tasks. "Should I continue?" prompts and progress summaries waste the user's time; they asked you to execute the plan, so execute it. Between tool calls, narrate at most one short line.

**Rulings, not stalls.** Conflicts, ambiguities, plan defects, a cap you would have asked to exceed: decide them. Record every decision in the ledger as `Ruling: <what you decided> - <why> - <what it costs if wrong>` and keep going. A wrong ruling costs rework the user can see and undo; a session parked on a question costs their whole day.

**Only four things stop the run:**
1. An irreversible or destructive operation (data deletion, history rewrite, force push).
2. A security-sensitive action (secrets, auth changes, permission grants).
3. A side effect outside this branch that norms say you ask about first (merge, push to a shared branch, publish, deploy).
4. A plan so broken that every path forward is a guess.

For those, stop and ask. For everything else, rule and ledger.

## Model Selection

Always specify the model when dispatching; an omitted model inherits your session's (usually the most expensive).

- Task text contains the complete code to write (transcription plus testing), or a single-file mechanical fix: cheapest tier (`haiku`).
- Implementation from prose, multi-file integration, reviewers: mid tier (`sonnet`).
- Design judgment, broad codebase understanding, the final whole-branch review, fix round 3 escalation: most capable tier (`opus`).

Turn count beats token price: the cheapest models take 2-3x the turns on multi-step work. Use mid tier as the floor for anything that is not transcription.
