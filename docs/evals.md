# Skill-trigger evals

`tests/routing.test.js` checks statically that the routing table in `skills/using-opm/SKILL.md` agrees with the 30-prompt fixture in `tests/fixtures/trigger-prompts.json`. It cannot show what a real model does with those prompts. This page records whether a headless Claude Code run shows which OPM skill a prompt triggers, and how to measure it.

## Spike (2026-10-05)

**Question:** does `claude -p` trigger OPM skills, and can a script see it?

**Answer: yes.** All 3 runs emitted a `Skill` tool_use naming an `opm:` skill on the first turn.

### Method

- Claude Code 2.1.273, `--model haiku`, one run per prompt, 3 prompts in total (one spike, one bounded, one contested from the fixture).
- Each run started in an empty throwaway directory under the session scratchpad, with the plugin loaded from the repo checkout through `--plugin-dir`. Nothing in the repo was edited.
- `--setting-sources project,local` keeps the user's installed plugins and hooks out, so the `init` event lists only this checkout as the `opm` plugin (`"source":"opm@inline"`).
- The plugin's SessionStart hook ran in every session (`hook_started SessionStart:startup`) and injected using-opm, so the runs went through the real front door.
- `--max-turns 1` is the smallest limit. The model's first assistant message, with its tool_use, is still emitted before the run stops with `error_max_turns`.

Exact command (from inside the temp directory):

```sh
claude -p "<prompt>" --output-format stream-json --verbose \
  --model haiku --max-turns 1 --setting-sources project,local \
  --no-session-persistence --plugin-dir <path to this repo>
```

### Results

| Run | Size class | Prompt | Expected | Observed skill | Cost (USD) |
|---|---|---|---|---|---|
| 1 | spike | fix the off-by-one in pagination.ts | tdd-workflow | opm:tdd-workflow | 0.0235 |
| 2 | bounded | add password reset by email to our Next.js app | brainstorming | opm:using-opm | 0.0239 |
| 3 | contested | I am not sure whether a marketplace for tutors is worth building, brew this idea | brew-idea | opm:brew-idea | 0.0231 |

The assistant `tool_use` block from each run, copied verbatim from the stream-json output (the session ids on the surrounding event are left out):

```json
{"type":"tool_use","id":"toolu_012FKPnmeBfEsLAfYrTBoE3J","name":"Skill","input":{"skill":"opm:tdd-workflow"},"caller":{"type":"direct"}}
{"type":"tool_use","id":"toolu_015pgGsru3APMw4ZHuA8tbLm","name":"Skill","input":{"skill":"opm:using-opm"},"caller":{"type":"direct"}}
{"type":"tool_use","id":"toolu_01CNViXw49579oTdkLfZrnmA","name":"Skill","input":{"skill":"opm:brew-idea","args":"marketplace for tutors"},"caller":{"type":"direct"}}
```

Each run reported `"subtype":"error_max_turns"`, took 4 to 7 seconds, and read about 21k cached input tokens. The 3 runs cost about $0.07 in total.

Notes on the results:

- **spike:** a hit. The tool_result was `"Launching skill: opm:tdd-workflow"`, followed by the skill body.
- **bounded:** the model loaded `opm:using-opm` again, even though the hook had already injected it, and the one-turn limit stopped it before it could pick the next skill. This is not a miss on brainstorming; the run simply could not tell. A real eval needs `--max-turns 2` and has to skip `using-opm` when it picks the observed skill.
- **contested:** the model chose brew-idea, but brew-idea is `disable-model-invocation: true`, so the call was refused with: `"Skill opm:brew-idea cannot be used with Skill tool due to disable-model-invocation. Ask the user to run /opm:brew-idea themselves"`. The routing choice can still be seen in the tool_use. The same applies to jump-start.

The prompt `should our app be a Flutter mobile app or a web app first? argue it out` was swapped for another contested prompt from the fixture. The session's command guard refused to run it, not Claude Code.

### Conclusion

Headless triggering works and can be detected: a `Skill` tool_use event in stream-json names the skill. The static check stays the routing test in `npm test`. The behavioural eval is a manual run that costs money (about $0.02 per prompt on haiku, so about $0.70 for all 30).
