<div align="center">

# OPM

**Design it. Prove it. Ship it.**

An engineering workflow for [Claude Code](https://claude.com/claude-code) that
refuses to call anything done without evidence, and keeps the bill down while
it does.

[![npm](https://img.shields.io/npm/v/opm-core.svg)](https://www.npmjs.com/package/opm-core)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757.svg)](https://docs.claude.com/en/docs/claude-code/plugins)

</div>

```bash
npx opm-core@latest
```

---

## The problem, in plain terms

You open Claude Code and describe what you want. It starts writing. For twenty
minutes this feels like magic.

Then it drifts. It says the tests pass, and it never ran them. It rewrites a
file it already got right. It forgets a decision you made an hour ago, because
that decision is now buried under forty thousand words of conversation.

Here is the part nobody mentions. **Every message you send re-reads the whole
conversation.** Hour one, that is cheap. Hour three, you are paying to re-read
the same hour-one chat again on every single turn, and the model is getting
worse at its job while the cost climbs.

That is one long conversation doing everything. It is the default, and it is
the expensive way.

## What OPM does instead

OPM splits the work. A small main thread holds the plan. Each task goes to a
**fresh worker that sees only that one task** and then disappears. The main
thread never balloons, so it does not get slower, dumber or pricier as the day
goes on.

Then it refuses to take anyone's word for anything. A reviewer reads every
task's diff before the next one starts. Nothing is called done, fixed or
passing without real command output. A ledger on disk survives the context
being wiped, so if the session resets, the work does not restart.

|  | One long chat | OPM |
|---|---|---|
| What the model re-reads each turn | Everything so far | The current task |
| Cost as the day goes on | Climbs | Stays flat |
| Quality as the day goes on | Drifts | Held by a reviewer gate |
| "Tests pass" | Sometimes a guess | Pasted output, or it does not count |
| If the session resets | Start over | The ledger picks up where it stopped |

Carrying all of this costs about **2,300 tokens** in every session. That is the
entire always-on price. Everything else loads only when it is actually used,
and you can check the number yourself with `claude plugin details opm`.

---

## Three things worth trying first

### 🧠 `/opm:brew-idea` — argue with your idea before you build it

A single AI agrees with you. Ask it to build the wrong thing and it will build
the wrong thing, enthusiastically, and you find out three weeks later.

Brew-idea puts four agents in a room and makes them fight:

- **Product** asks who this is for, and what nobody actually asked for
- **Engineering** asks what is cheap, what is expensive, and what breaks
- **Skeptic** is paid to attack it: how it fails, what makes it pointless
- **Market** searches the web for who already built this, and says so plainly when it could not verify a claim

Then every agent has to take a position on every other agent's idea. No
fence-sitting. A judge reads the whole argument and marks each feature
**keep, improve, add or cut**, with the reason and who argued for it. Anything
the skeptic lands a serious hit on gets cut unless there is a real answer.

```
/opm:brew-idea A field-sales app for our reps: visit planning, GPS check-in,
order capture synced to the ERP.
```

You get a ranked feature list and a plain-language page to approve.
**Why it matters: the cheapest feature is the one you talked yourself out of
building.**

### 🚀 `/opm:jump-start` — a whole project from one prompt

You could paste that same brief straight into Claude Code. Here is what differs.

| Pasting the brief directly | `/opm:jump-start` |
|---|---|
| Starts writing code in the first minute | Asks only about gaps that would change the architecture |
| Picks your stack and data model silently | Shows you a design with flows, wireframes and the data model, then waits |
| You see the result once it is built | You approve the shape before a line is written |
| One context, filling up all day | One fresh subagent per plan, running in parallel waves |
| Tests if you remember to ask | Every task is a failing test first, then code, then a commit |
| "It's done" | Verified, reviewed, then actually started so you can open it |

```
/opm:jump-start my-app A field-sales app for our reps: visit planning, GPS
check-in, order capture synced to our ERP, manager dashboard on web. Android
first, offline capable.
```

It ends by handing you a running app and a URL, or launching it on a connected
device. For the build to run unattended, switch Claude Code to auto mode with
Shift+Tab when it asks. OPM never changes your permission mode itself.

### 🎬 `/opm:story-video` — turn a spec into a narrated video

Point it at a spec, a brew-idea result, or any document. You get a 1920x1080
MP4 with a neural voice-over and subtitles, plus the editable storyboard and
slides. It is a narrated slideshow with fades, not animation.

```
/opm:story-video docs/specs/2026-09-17-field-sales-brew.md
```

**Here is the interesting part.** The first version of this pipeline was run by
hand, with an AI drawing every slide. Fourteen slides cost about **190,000
tokens, 77 tool calls and 22 minutes.**

So the AI was taken out of the drawing. Slides are now rendered by script from
a kit of nine layouts and 24 icons, filled in from the storyboard like a form.
**Drawing a slide now costs no AI tokens at all** — it is a script, and scripts
are free. What is left is writing the storyboard, which is words and genuinely
needs judgement, plus hand-drawing the occasional scene no layout can express.

| | Hand-drawn by AI | Layout kit |
|---|---|---|
| Who draws the slides | An AI, one at a time | A script, all at once |
| Tokens to draw them | ~190,000 | none |
| Reviewing the result | 14 images, one by one | one contact sheet, looked at once |
| Changing one word | redraw the slide | re-render; only that scene rebuilds |

It asks before any audio leaves your machine, and offers a fully offline voice
if you would rather nothing did. Every fact in the video has to trace back to
the source document, and a validator enforces it.

---

## How the whole loop fits together

1. **Brew** the idea, if it is not settled. Four agents argue, a judge ranks.
2. **Design** it. One question at a time. Nothing is written until you agree the shape.
3. **Plan** it. The spec becomes bite-sized tasks, each with a failing test and a commit.
4. **Execute** it. One fresh subagent per task, a reviewer gate after each.
5. **Verify** it. Build, types, lint, tests, secrets scan. Real output, or it did not happen.
6. **Capture** what was non-obvious, so the next project starts from it.

Every step is a skill you can use on its own. You do not have to run the whole
loop to get value from any one of them.

---

## Install

```bash
npx opm-core@latest
```

That installs the plugin and copies the coding rules into your repo. It takes
options if you want to skip a step:

```bash
npx opm-core@latest --rules typescript,react   # no questions
npx opm-core@latest --plugin-only              # skip the rules
npx opm-core@latest --rules-only ../other-repo # rules for another repo
```

Or the native route, two commands:

```bash
claude plugin marketplace add harshadmadaye/OPM
claude plugin install opm@opm
```

The rules are plain markdown that Claude Code loads from
`<repo>/.claude/rules/opm/`. A plugin cannot ship them, which is why they are
copied per repository. Keep `common/` small: it loads in every session.

This repository is public, so no GitHub credentials are needed. Upgrading from
an older install? Run `claude plugin marketplace remove opm` first, otherwise
you keep pulling from wherever it pointed before. If `/opm:` commands are not
recognised afterwards, run `/reload-plugins`. If your git reaches GitHub over
SSH and that fails, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`.

Nothing here phones home and nothing runs a model behind your back.

---

## Everything in the box

<details>
<summary><b>All 15 skills</b> — invoked as <code>/opm:&lt;name&gt;</code>, or picked up automatically when they match the task</summary>

**The loop**

| Skill | What it does |
|---|---|
| `using-opm` | Injected at session start. Tells Claude to check for an applicable skill before any other action. |
| `brew-idea` | Four agents argue the idea from product, engineering, skeptic and market angles; a judge ranks features. |
| `brainstorming` | No code before the design is agreed. One question at a time, scaled to the size of the job. |
| `writing-plans` | Turns an approved spec into bite-sized tasks, each with a failing test, implementation and commit. |
| `executing-plans` | Runs a plan with one fresh subagent per task and a reviewer gate after each. Ledger survives compaction. |
| `verification-before-completion` | No "done", "fixed" or "passing" without fresh command output as evidence. |
| `compound-learnings` | Captures non-obvious fixes as short docs, and reads them back before planning. |

**Bigger scope**

| Skill | What it does |
|---|---|
| `milestone-planning` | Multi-week work: roadmap, short STATE digest, phased plans with wave scheduling for parallel subagents. |
| `jump-start` | A whole project from one prompt. |
| `story-video` | A spec becomes a narrated explainer video, rendered from a layout kit. macOS, Linux and Windows. |

**Engineering**

| Skill | What it does |
|---|---|
| `tdd-workflow` | Strict red, green, refactor with a "fails for the right reason" gate and an evidence report. |
| `verification-loop` | Build, types, lint, tests, secrets scan and diff review, with a pass or fail report. |

**Stack patterns**

| Skill | What it does |
|---|---|
| `react-patterns` | React 18/19 and Next.js App Router: hooks discipline, server and client boundaries, measured performance work. |
| `python-patterns` | Modern Python: typing, dataclasses and pydantic at boundaries, async basics, uv, ruff and pytest layout. |
| `flutter-patterns` | Flutter and Dart 3: widget composition, state management choice, async and streams, Firebase, tests. |

</details>

<details>
<summary><b>5 reviewer subagents</b> — dispatched automatically when a task matches, or ask for one by name</summary>

| Agent | Model | Use it for |
|---|---|---|
| `planner` | opus | Turning an agreed spec into an implementation plan |
| `code-reviewer` | sonnet | Diff review with a confidence gate and an explicit false-positive list |
| `typescript-reviewer` | sonnet | TypeScript and Node specifics: types, async pitfalls, merge readiness |
| `security-reviewer` | sonnet | OWASP checks, dependency audits for npm, Python and Dart, Firebase rules |
| `silent-failure-hunter` | sonnet | Swallowed errors, empty catches, misleading fallbacks |

</details>

<details>
<summary><b>6 safety hooks</b> — dependency-free scripts that never call a model or the network</summary>

| Event | Effect |
|---|---|
| SessionStart | Injects the workflow map on startup, `/clear` and compaction |
| PreToolUse on Bash | Denies `git commit --no-verify` and other hook bypasses |
| PreToolUse on Edit/Write | Asks before editing lint, format, typecheck or `.husky` config |
| PostToolUse on Edit/Write | Records edited files for the Stop hooks |
| Stop | Formats edited files, runs tsc, ruff or dart, blocks on type errors |
| Stop | Warns about leftover `console.log`, `print` or `debugPrint` |

Set `OPM_HOOKS_DISABLED=1` to turn them all off. Per-hook switches are
`OPM_ALLOW_CONFIG_EDITS`, `OPM_SKIP_FORMAT` and `OPM_SKIP_TYPECHECK`; see
[hooks/README.md](hooks/README.md).

</details>

<details>
<summary><b>Repository layout</b></summary>

```
.claude-plugin/   plugin.json, marketplace.json
agents/           5 subagents
skills/           15 skills (SKILL.md plus templates/scripts where needed)
hooks/            hooks.json and 6 dependency-free Node scripts
rules/            copied into <repo>/.claude/rules/opm/ by the installer
bin/              the npx installer
scripts/          install-rules.sh, dev-server.sh
tests/            node --test tests/*.test.js
docs/             specs, plans and design notes
```

</details>

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the rules the tests enforce,
and how to open a pull request. By taking part you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Licence

MIT. See [LICENSE](LICENSE).
