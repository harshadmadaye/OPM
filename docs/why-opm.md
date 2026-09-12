# Why OPM exists

OPM was assembled on 2026-09-12 after reviewing four public Claude Code
workflow systems. This note records the decisions so nobody re-litigates them.

## What we looked at

| System | Shape | Verdict |
|---|---|---|
| ECC (affaan-m/ecc 2.2.1) | 292 skills, 68 agents, 24 hooks, 16 harness adapters | Strong 15-file core buried in bloat. Default hooks deny first edits, spawn about 10 node processes per tool call and run hidden Haiku summaries. Cherry-picked. |
| GSD (get-shit-done) | 26 commands, pure markdown, `.planning/` artefacts | Best context hygiene and plan format, but solo-oriented and ceremonial. Took the plan schema, waves, STATE digest and deviation rules. |
| superpowers (obra) | 14 skills, 1 hook | Best process discipline: hard gates, TDD plans, fresh subagent per task, verification before completion. Took the whole loop. |
| compound-engineering (Every) | 35 skills, ~40 embedded agents, no hooks | Best idea for institutional memory: write learnings back into the repo. Took the compound step and reviewer lenses. |

## Design rules

1. Always-on context stays under 10 KB (about 2k tokens): one injected skill plus the common rules.
2. Hooks never call a model, never touch the network, never block on first use.
3. One way to do each thing. TDD lives in one skill, review in one agent.
4. Stack-specific content only for stacks we ship: TypeScript/React, Python, Flutter, Firebase.
5. Every adapted file names its source. Licenses are in `THIRD_PARTY_NOTICES.md`.
