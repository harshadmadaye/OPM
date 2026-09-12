# Delegation Completion Contract

Applies to every agent at every depth (parent, child, grandchild).

## The Contract

1. **Your final message is the deliverable.** Never end a turn with "waiting for background agents". A spawned task is not a completed task. Ending your turn while children are running orphans their results.
2. **If you delegate, you own collection.** Wait for results, integrate them, then return. Fire-and-forget delegation is forbidden.
3. **Decompose only when the work cannot fit in one context.** Do not re-delegate a task already sized for a single agent. Depth is an outcome, not a plan.

## Verify Subagent Claims

A subagent's report is a claim, not evidence. Before relaying it:

- If it says tests pass, run the tests (or read the test output it produced).
- If it says a file was changed, read the diff.
- If it says something does not exist, do one search yourself.
- Attribute anything you did not verify as "reported by the subagent".

## Parallelism

Run independent subagents in parallel, then collect all results before responding. Parallelism without the completion contract produces zombie tasks whose output nobody reads.

<!-- Adapted from affaan-m/ecc (MIT) -->
