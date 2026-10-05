---
phase: 02-trim-the-core
plan: 06
requires:
  - { phase: 02-trim-the-core, provides: routing table (02-01), merged verification skill (02-02), installer next step (02-04) }
provides:
  - optional opm-video plugin at plugins/opm-video holding explainer-video (plugin.json on the core version, discloses that edge-tts sends text to a Microsoft cloud service)
  - second marketplace entry (source ./plugins/opm-video); 13 core skills
  - plugin always-on 2,379 tokens (from 2,513)
affects: [02-07]
key_files: [plugins/opm-video/.claude-plugin/plugin.json, plugins/opm-video/skills/explainer-video/SKILL.md, .claude-plugin/marketplace.json, tests/manifest.test.js, bin/install.js, README.md]
key_decisions:
  - "relative source ./plugins/opm-video is accepted by the strict validator"
  - "manifest test pins every marketplace entry to the core version and checks core has no skills/explainer-video"
  - "the same pointer line appears in brew-idea, jump-start, milestone-planning and using-opm"
  - "the skill's ${CLAUDE_PLUGIN_ROOT}/skills/explainer-video/scripts path still resolves under the new plugin root"
issues_created: []
completed: 2026-10-05
---

# 02-06 Summary

explainer-video moved into an optional opm-video plugin, so core users no longer load its description (2,513 to 2,379 always-on tokens); it installs with `claude plugin install opm-video@opm` and runs as `/opm-video:explainer-video <path>`.

## Task commits
- 01a02c0 refactor(02-06): create the opm-video plugin and move the skill
- 53e43d7 docs(02-06): repoint pointers, installer and docs

## Verification
npm test 195 pass; npm run tokens exit 0; both strict validate commands passed.

## Deviations
- README count change (14 to 13) landed in task 1 because the manifest test required it.
- Core plugin.json and marketplace descriptions no longer mention the video skill (not in files_modified).
- 9 explainer-video test files existed, not 10; all repointed.
- README "Three things worth trying first" became "Two things"; a plugins/ line was added to the layout.
- docs/why-opm.md cost table is stale; 02-07 regenerates it.
