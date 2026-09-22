# Changelog

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
