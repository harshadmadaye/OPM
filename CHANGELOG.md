# Changelog

## 0.8.0 - 2026-10-05

- New `npx opm-core status`: prints the open plan ledger (tasks done, current task, last ruling), the milestone position and the git branch, on any Claude Code version. One shared ledger parser (`bin/lib/ledger.mjs`) feeds it and the mod. A malformed ledger counts as open so its error reaches you; plan paths outside the repo are never read.
- The SessionStart hook adds one resume line when a plan ledger is open, naming it and the next task. With no open ledger the start-up text is unchanged, and any ledger problem leaves it exactly as before.
- OPM's first mod (Claude Code 2.1.287+): `hooks/hooks.json` now loads `hooks/mod/register.mjs` beside the unchanged settings hooks, which older Claude Code keeps running. `/opm-status` is answered from code with no Claude turn. Commands use a hyphen (`/opm-status`), since names cannot contain a colon; output is plain text, so it works in the VS Code chat panel.
- Destructive-command hold (mod): `rm -rf` on root-like or out-of-repo paths, force-pushes to `main` or `master` (or naming no branch) and `git reset --hard` ask first. Anything but "Run it" denies, as does a session where nobody can answer or a failure of the guard itself. `OPM_GUARD=off` turns it off. `docs/threat-model.md` covers it.
- Opt-in token meter (mod): off by default. `/opm-report --enable` records each turn's token use and the skills that ran in one local store key (14 days, 256 KiB cap); `/opm-report` prints the summary and `--disable` stops it. Local only, nothing sent.
- Tested range: `package.json` declares Claude Code 2.1.273 - 2.1.289 and mods from 2.1.287. Doctor adds rows for the tested range, mod availability and an installed plugin older than the package (with `claude update` and `claude plugin update opm@opm` as fixes).
- CI runs the mod tests (`claude plugin test .`) in the gate job and a weekly or manual job against the latest Claude Code. The README lists the events and calls the mod declares. The mod features are tested with the Claude Code test kit, not yet in a live session.

## 0.7.1 - 2026-10-05

- Always-on cost drops from about 2,541 tokens per session to about 2,379, and the CI ceiling drops from 2,850 to 2,650. `rules/common` is unchanged at about 1,401 (ceiling 1,550). `docs/why-opm.md` carries the regenerated table.
- Breaking: `verification-loop` is merged into `verification-before-completion`. Use `/opm:verification-before-completion` and ask for the full gate; the six-gate loop (build, types, lint, tests, secrets scan, diff review) now loads on demand from its `references/full-loop.md`.
- Breaking: `explainer-video` moves out of the core into the optional `opm-video` plugin, so core sessions no longer carry its description. Install it with `claude plugin install opm-video@opm`, then run `/opm-video:explainer-video <path>`. The marketplace lists it beside `opm`, on the same version.
- `using-opm` routes by job size: a routing table sends spikes to `tdd-workflow`, bounded features to `brainstorming` and `writing-plans`, multi-week work to `milestone-planning`, unattended projects to `jump-start` and contested ideas to `brew-idea`. A 30-prompt fixture test pins the table.
- `executing-plans`, `react-patterns`, `python-patterns` and `flutter-patterns` are split into short cores with on-demand `references/` files (executing-plans goes from about 5,000 tokens to about 1,056 per run). Conventions the rules already state are no longer repeated in the stack skills. `npm run tokens` fails if any of the four cores grows past 1,200 tokens.
- New `npx opm-core doctor`: checks Node, Claude Code, the plugin, whether the copied rules are current, the tools the hooks call, and replays each hook offline. It exits 1 only on a failed check. The installer now writes a hashed `.claude/rules/opm/.opm-version` stamp and points at doctor when it finishes.
- The Stop hook reports what it did: one "OPM checks:" line per language saying what ran, what was skipped and why, or which tool is missing. It stops starting new tools at 75% of its 60-second budget and says so; type errors still block.
- The hook-bypass guard inspects only real git invocations. It blocks the short and long hook-skip flags, husky-disabling environment assignments, `git -c core.hooksPath` and `git config core.hooksPath` writes, and no longer blocks heredocs, commit messages or `echo` text that only mention them. Editing `core.hooksPath` in `.git/config` now asks first.
- New `docs/threat-model.md`: what each hook is for, the evasions tested, the look-alikes allowed and what is out of scope. The hooks are guard rails, not a security boundary.
- `brew-idea` is unchanged: it was already user-invoked only.

## 0.7.0 - 2026-10-05

- CI: every pull request runs the suite on macOS, Linux and Windows with Node 18, 20 and 22. A gate job then checks the token budget, the npm package contents and both manifests with `claude plugin validate --strict`.
- `npm run tokens` measures the always-on cost and fails when it passes a ceiling. The plugin costs about 2,541 tokens per session (ceiling 2,850) and `rules/common` about 1,401 when the rules are installed (ceiling 1,550). These are bytes / 4 estimates. The README's earlier 2,300 figure was an underestimate. `docs/why-opm.md` carries the generated table.
- Breaking: `/opm:story-video` is removed. Use `/opm:explainer-video`. Existing tool installs under `~/.opm/story-video-tools/` still work.
- `scripts/push-via-api.sh` is removed from the repo. It was a maintainer helper and no longer ships.
- Windows scope: the installer, hooks and tests run on Windows. `scripts/dev-server.sh` and `scripts/install-rules.sh` are macOS, Linux and WSL only.

## 0.6.1 - 2026-09-29

- `explainer-video` can no longer ship a silent video. Before encoding, `build-video.js` measures every scene's narration and stops, naming the scene, when it is silent (loudest moment under -50 dB) or too short to hold its words. After encoding it confirms the MP4 has an audio track. The done line ends `narration checked`, and the skill forbids covering a failed narration with silent audio.

## 0.6.0 - 2026-09-28

- Installer: the rules step is a checkbox list instead of a typed comma-separated list. Arrow keys or j/k move, enter or space ticks, `a` or the Select all row toggles everything, enter on Submit finishes, Esc cancels. Languages guessed from the repo start ticked. Piped input still gets the typed prompt, and `--rules` still skips the question.
- Installer: the Next list names `/opm:explainer-video`.
- `story-video` is renamed `explainer-video` (`/opm:explainer-video <path>`), a name that says what you get. `/opm:story-video` stays for this release as an alias that forwards to it. Tools now install into `~/.opm/explainer-video-tools/` with `OPM_EXPLAINER_TOOLS` as the override; an existing `~/.opm/story-video-tools/` and `OPM_STORY_TOOLS` are still honoured, so nothing is downloaded again. Videos still land in `docs/story/<slug>/`.

## 0.5.0 - 2026-09-28

- `brew-idea` now ends with a design, not a debate report. A fifth workflow phase, Design, has an opus designer turn the judge's verdict into personas and flows, surfaces with low-fidelity wireframe layouts, navigation, data model, architecture and stack. The page follows jump-start's design outline; the debate is one collapsed "Why these choices" section. The chat summary is three lines and the link. Change requests rerun the judge and the designer.
- Tests: the Design phase, its schema, feedback reaching the designer, the spec template's order and the skill's render and summary rules.

## 0.4.0 - 2026-09-21

- New skill `opm:story-video <path>`: a spec or document becomes a narrated explainer video (1920x1080 MP4 plus `.srt`). A narrated slideshow with fades, not animation. The main thread writes `storyboard.json`; scripts do the rest: nine script-rendered slide layouts and 24 pictograms, headless-browser frames, edge-tts or local-voice narration, ffmpeg encoding, a contact sheet for one-look review, and a per-scene hash manifest so edits rebuild only what changed. Works on macOS, Linux and Windows; tools install into `~/.opm/story-video-tools/`.
- Gates for length, storyboard plus audio consent, and the final video. Sourcing and planned-feature labelling are fields the validator checks.
- `brew-idea`, `jump-start`, `milestone-planning` and `using-opm` carry a one-line pointer to it. They hold none of its rules.
- Tests: nine `story-video-*` test files covering the libraries, kit, layouts, validator, slide rendering, frame rendering, encoding arguments, narration planning and the skill documents. None needs a network, a browser, ffmpeg or audio.

## 0.3.0 - 2026-09-16

- New skill `opm:brew-idea <brief>`: one Workflow launch where four angle agents (product, engineering, skeptic, market research with WebSearch) propose and rebut each other and an opus judge ranks features keep / improve / add / cut with a phased plan. The main thread writes `docs/specs/<date>-<slug>-brew.md`, one opus agent renders `docs/brew/<slug>.html`, and change requests rerun only the judge through workflow resume.
- `using-opm` and the README mention brew-idea.
- Tests: static checks on the workflow script and the skill, plus a manifest test that the two version fields and the changelog agree.

## 0.2.2 - 2026-09-16

- Add design spec for `opm:brew-idea`, a multi-agent idea debate skill (`docs/specs/2026-09-16-brew-idea.md`). Spec only, no new skill yet.

## 0.2.1 - 2026-09-15

- Fix: plugin failed to load because the manifest listed `hooks/hooks.json` and `skills/` explicitly; both are standard locations that Claude Code loads automatically, so the duplicate made the whole plugin fail. Removed the entries.

## 0.2.0 - 2026-09-12

- New skill `opm:jump-start <name> <brief>`: brief to running project in one command. Gap-driven brainstorming, design artifact with per-revision approval, unattended multi-agent build under the developer's chosen permission mode, verification, local run or device launch.
- New helper `scripts/dev-server.sh` to start, stop and inspect detached dev processes, with tests.
- `using-opm` mentions jump-start in the workflow map.

## 0.1.0 - 2026-09-12

Initial release, assembled from a review of ECC, superpowers, compound-engineering and GSD.

- Workflow skills: using-opm, brainstorming, writing-plans, executing-plans, verification-before-completion
- Engineering skills: tdd-workflow, verification-loop, compound-learnings, milestone-planning
- Stack skills: react-patterns, python-patterns, flutter-patterns
- Agents: code-reviewer, typescript-reviewer, planner, silent-failure-hunter, security-reviewer
- Hooks: session-start context, block-no-verify, config-protection, post-edit accumulator, stop format/typecheck, console-log check
- Rules to copy into repos: common, typescript, react, python, dart
