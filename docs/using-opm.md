# using-opm: the front door to OPM

`using-opm` is the one skill every OPM session starts with. A session-start hook loads it before your first message, so Claude begins every session knowing how the rest of the plugin fits together. You do not need to learn the other skill names to benefit from them.

## Why start every session with it

| Benefit | What it means for you |
|---|---|
| The right amount of process | Claude sizes the job before it starts. A small fix goes straight to a test-first change; a feature gets a short design and a plan; weeks of work get a milestone. No spec and review cycle for a one-line change. |
| Lower token cost | Wide searches and reviews run in subagents that return conclusions, not file dumps, so your main conversation stays short. Big skills load a small core and pull in detail only when a step needs it. |
| Parallel work by default | Independent pieces run at the same time in parallel subagents, each in its own git worktree when it edits files, then get merged. |
| The big tools, offered not hidden | When a job would clearly benefit from many agents at once (a debate, a sweep across modules), Claude offers a multi-agent run with a rough agent count and starts it only after you say yes. |
| You always know what is happening | Every step up is announced in one line, such as "Using 3 parallel subagents to audit the forms", so you can stop or redirect it. |
| Fewer "done" claims that are not | Subagent reports are verified, tests are actually run, and nothing is called finished without fresh command output. |
| Work that survives a reset | Plans and milestones keep their progress on disk, so a compacted or new session picks up where the last one stopped. |

## How it decides

**First, the size of the job:**

| Size | Signal | What happens |
|---|---|---|
| spike | one file or about 10 lines | test-first change, no spec or plan |
| bounded | a feature of a few tasks | short design, then a plan |
| multi-week | more than about a week or 8 tasks | milestone with phases |
| unattended | a whole new project from one brief | `/opm:jump-start` |
| contested | the idea itself is unsettled | `/opm:brew-idea` |

**Then, how far to scale:**

- Wide search, review or audit: a subagent.
- Independent pieces: parallel subagents; separate git worktrees when they edit files.
- More than about 3 tasks: a written plan, executed one fresh subagent per task with a reviewer after each.
- Weeks of work: a milestone with waves of parallel plans.
- Many agents at once: an offer of a multi-agent run, which starts only after your yes.

It does not scale up for small jobs, when the answer is in a file it can read directly, or when the pieces depend on each other.

## Why some things are offered, not automatic

Claude Code runs multi-agent workflows only when you opt in: you ask for one in your own words, type `ultracode`, or run a skill such as `/opm:brew-idea` that calls for one. `using-opm` loads automatically, so it cannot opt in for you. Each extra agent costs roughly one more conversation's worth of tokens, so OPM asks first instead of spending them quietly. Subagents and plans need no opt-in and are used whenever they help.

## When to run `/opm:using-opm` yourself

It loads on its own, but running it at the start of a session is useful when:

- a long session was compacted and you want the rules back in full,
- your editor or integration did not run the session-start hook,
- you want to read the rules Claude is following.

## What it costs

`using-opm` is part of OPM's always-on cost, which CI measures and caps (see [the cost table](why-opm.md#what-opm-costs-per-session)). The scaling detail lives in `skills/using-opm/references/orchestration.md` and loads only when Claude is about to scale up.
