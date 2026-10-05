# Orchestration: when and how to scale up

Read this when the "Scale the approach" ladder in using-opm says to escalate. The goal is to use Claude Code's parallelism and planning by default, while keeping cost visible and the user in control.

## Do not escalate when

- The job is a spike (one file, about 10 lines). Stay small: `opm:tdd-workflow` in the main thread.
- You already know which file or symbol holds the answer. Read it directly; a subagent only adds overhead.
- The pieces depend on each other. Parallel agents on dependent work produce conflicts, not speed.

## Subagents

- Use one for a wide search, a review, or an audit whose detail you do not need in the main context. Ask it for conclusions, not file dumps.
- Run independent subagents in parallel: several Agent calls in a single message.
- Give each subagent a complete brief: the goal, the files, the rules it must follow, and the exact shape of its final report. It starts with none of this conversation.
- When subagents edit files in parallel, give each its own git worktree so commits cannot collide; merge their branches afterwards.

## Plans and milestones

- More than about 3 tasks, or work that must survive a context reset: `opm:writing-plans`, then `opm:executing-plans` (fresh subagent per task, reviewer gate, ledger).
- More than about a week or 8 tasks: `opm:milestone-planning` (phases, waves of parallel plans, STATE digest).

## Multi-agent Workflows (opt-in only)

- Claude Code runs the Workflow tool only after explicit opt-in: the user's own words ("use a workflow", "fan out agents"), the keyword `ultracode`, or a skill the user invoked that calls for it (for example `/opm:brew-idea`). This skill is injected automatically, so it is never that opt-in.
- When a task would clearly benefit (many independent agents, a debate, a sweep across modules), offer it in one or two lines: what it would do, roughly how many agents, and that it costs more tokens than a single thread. Then wait for yes.
- Cost guide: each agent is roughly one full conversation of tokens. A 4-agent review costs about 4 times a single review; say so.

## Announce, collect, verify

- Announce every escalation in one line before doing it, so the user can stop it.
- If you delegate, you own collection: wait for every agent, integrate the results, then answer. Never end a turn with agents still running and their results unread.
- A subagent's report is a claim. Before relaying it, verify: run the tests it says pass, read the diff it says it made, search once for what it says does not exist.
