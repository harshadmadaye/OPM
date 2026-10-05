# Plugin marketplace listing kit

Text and a checklist for listing OPM in a plugin marketplace. Nothing here has
been submitted. Submission is the maintainer's step, under their own account.

The submission requirements were not checked while writing this. Field names,
length limits and categories below are assumptions until the checklist's first
step is done.

## Name

- Plugin: `opm` (display name "OPM Engineering Workflow")
- Optional add-on: `opm-video` (display name "OPM Explainer Video")
- Marketplace: `opm`, at `harshadmadaye/OPM`

## Descriptions (drafts)

The lengths assume a tagline of about 80 characters and a short description of
about 250, which is common for listing forms. Trim to the real limits.

One line (75 characters):

> Spec-driven, test-first workflow for Claude Code, with measured token cost.

Short (227 characters):

> Brainstorm, plan, build test-first with fresh-context subagents, review and
> verify before done. Always-on cost is 2,379 tokens (bytes / 4), checked in CI
> on macOS, Linux and Windows. The hooks never call a model or the network.

The token figure comes from `npm run tokens`. Update it if it changes before
submission.

## Category and keywords

package.json has no category field. Suggested category: developer tools, from
the `developer-tools` keyword. Pick the nearest category the form offers.

Keywords, from package.json: claude-code, claude-code-plugin, ai-agents,
agentic-workflow, tdd, code-review, developer-tools, anthropic, claude,
claude-code-skills, subagents, multi-agent, spec-driven-development,
ai-coding-assistant, workflow.

## Install

```bash
claude plugin marketplace add harshadmadaye/OPM
claude plugin install opm@opm
claude plugin install opm-video@opm   # optional, after the core
```

Or, for the plugin plus the coding rules: `npx opm-core@latest`.

## Requirements

- Node 18 or later.
- Claude Code: tested with 2.1.273 - 2.1.289 (`opm.claudeCode.tested` in package.json).
- Mod features (`/opm-status`, `/opm-report`, the destructive-command hold):
  Claude Code 2.1.287 or later. Older versions ignore the mod and keep every
  settings hook. The mod is tested with the Claude Code test kit in CI, not yet
  in a live session.
- opm-video only: a headless browser (Chrome, Chromium, Edge or Brave), and
  Python for the neural voice. It installs pinned ffmpeg, ffprobe and edge-tts
  into `~/.opm/explainer-video-tools` on first build.

## What the hooks and the mod touch

Settings hooks (`hooks/hooks.json`), six dependency-free Node scripts:

| Event | Script |
|---|---|
| SessionStart (startup, clear, compact) | session-start.js |
| PreToolUse on Bash | block-no-verify.js |
| PreToolUse on Edit, Write, MultiEdit | config-protection.js |
| PostToolUse on Edit, Write, MultiEdit | post-edit-accumulator.js |
| Stop | stop-format-typecheck.js, check-console-log.js |

The mod (`hooks/mod/register.mjs`), from
`claude plugin validate --strict --json .claude-plugin/plugin.json` on Claude
Code 2.1.289 (success, no errors, no warnings):

| | Declared |
|---|---|
| Hooks | `session.start`, `command.run{command=opm-status}`, `turn.complete{isAborted=false}`, `tool.call{tool=Bash}`, `tool.call{tool=Edit}`, `tool.call{tool=Write}`, `tool.call{tool=Bash}`, `command.run{command=opm-report}`, `skill.prompt`, `turn.complete` |
| Calls | `$.clock.now`, `$.command.register`, `$.env.get`, `$.env.set`, `$.fs.exists`, `$.fs.list`, `$.fs.read`, `$.fs.stat`, `$.process.run` (only `git branch --show-current`), `$.session.cwd`, `$.session.id`, `$.session.root`, `$.store.delete`, `$.store.get`, `$.store.keys`, `$.store.set`, `$.ui.ask`, `$.ui.log` |
| Env writes | `OPM_MOD_ACTIVE` |
| Env reads | `OPM_ALLOW_CONFIG_EDITS`, `OPM_GUARD`, `OPM_HOOKS_DISABLED` |

`tool.call{tool=Bash}` appears twice because the destructive-command hold and
the hook-bypass check each register one.

## Privacy

- Nothing phones home. The hooks and the mod make no network calls and no
  model calls.
- The `/opm-report` meter is off by default. When enabled it keeps 14 days of
  turn data in one local store key, capped at 256 KiB. Nothing is sent.
- `/opm-status` keeps per-repo snapshots in the local store under a hashed key,
  with no path in the key.
- opm-video: the neural voice uses edge-tts, which sends the narration text to
  a Microsoft cloud speech service. The skill asks first, and the local OS
  voice keeps everything on the machine.

## Support

- Issues: https://github.com/harshadmadaye/OPM/issues
- Docs: https://github.com/harshadmadaye/OPM#readme
- Contributing: https://github.com/harshadmadaye/OPM/blob/main/CONTRIBUTING.md
- Threat model: https://github.com/harshadmadaye/OPM/blob/main/docs/threat-model.md
- Licence: MIT

## Submission checklist

1. Check the current submission requirements on the official Claude Code
   plugin docs. They were not verified for this kit: fields, length limits,
   categories, review steps and any policy terms.
2. Confirm the version on main matches package.json, both plugin.json files
   and both marketplace entries.
3. Run `npm test` and `npm run tokens`; update the token figure above if it moved.
4. Run `claude plugin validate --strict --json .claude-plugin/plugin.json` and
   `claude plugin validate --strict .claude-plugin/marketplace.json`; paste any
   change into the tables above.
5. Check CI is green on main.
6. Fit the descriptions to the real limits.
7. Submit under the maintainer's own account.
