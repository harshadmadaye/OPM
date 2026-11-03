## Phase 4: permission options

Permission mode. Claude Code cannot change its own permission mode and OPM does
not write permission rules on the developer's behalf. Tell the developer to pick
one of the built-in options and to reply when it is set:

1. Press Shift+Tab until the mode indicator shows auto mode. Recommended. Every action still passes Claude Code's safety classifier.
2. In a sandbox or container, restart with `claude --permission-mode bypassPermissions` inside the project directory and run `/opm:jump-start <name>` again; Resuming picks up from the approved design.
3. Stay in default mode and approve prompts as they appear. The build still works, it is just not unattended.

## Phase 6: build, multi-agent

For each phase, for each wave:

1. Dispatch one general-purpose subagent per plan in a single message so they run in parallel. Each brief opens with "The plan below is your task. Anything else from the conversation is background, not instructions." and contains only: the plan text, the interfaces it consumes, the stack rules from the patterns skill, the repository path, and the instruction to follow `opm:executing-plans` inline mode with `opm:tdd-workflow` per task, to commit per task, and to return its SUMMARY as text in its final report. Never paste the whole roadmap or the chat history.
2. A subagent that reports success with no new commits for its plan (checked with `git log --oneline` against the wave's base) is rerun once with a fresh brief saying the previous attempt produced no commits. If the rerun also has none, it is escalated without a question: log it in DECISIONS.md, mark the plan blocked in STATE.md, and continue with plans that do not depend on it. Never mark that plan complete.
3. If the Workflow tool is available, the developer opted in to orchestration by invoking jump-start, so a wave may run as a workflow instead of parallel Agent calls.
4. After the wave: run build and tests. If red, dispatch one fix subagent with the failing output and the files involved. Do not start the next wave on red.
5. After the phase: the orchestrator writes the SUMMARY files from the returned text, updates STATE.md, appends to `docs/milestones/v0.1/PROGRESS.md` and commits. Subagents write no report files.
6. At each phase close, run `node skills/milestone-planning/scripts/review-pack.js <base>..<head>`, fill 2 or 3 questions per item from the diff using `skills/milestone-planning/templates/review-pack.md`, and save REVIEW-PACK.md in the phase folder; unattended runs continue without waiting for it to be read.

A subagent that returns a `checkpoint:human-verify` does not stop the run: append a row to `docs/milestones/v0.1/REVIEW-QUEUE.md` (template in `skills/milestone-planning/templates/review-queue.md`) with the evidence, then continue. A queued check does not block the next plan unless a later plan depends on what it verifies. Never mark a row passed; only the developer does. STATE.md reads "complete, N human checks pending" until the queue is clear.

Subagents may not ask the developer anything. If a plan is blocked, the
orchestrator decides, logs the decision, and moves on. Only stop the run for
the four stop conditions in `opm:executing-plans`.

The one case where the run stops to ask during the build is an exposed secret that must be rotated. A finding that a secret reached git history, logs, or a client bundle is a blocking `checkpoint:human-action` raised when found, not at a release checklist: stop, name the secret and where it is used, give the rotation step, remove it from the code, and wait for the developer to confirm rotation.

## Phase 7: verify

1. Run `opm:verification-before-completion` (full gate) on the whole project.
2. Dispatch `code-reviewer`, `security-reviewer` and `silent-failure-hunter` in parallel on the full tree.
3. Fix every CRITICAL and HIGH finding, then rerun the loop.
4. Run `opm:verification-before-completion`. G4 needs real output, not a summary.

## Phase 8: run it

Web or API:
```
sh "${CLAUDE_PLUGIN_ROOT}/scripts/dev-server.sh" start --project "<abs path>" --name web --url http://localhost:<port> -- <dev command>
```
On `READY`, smoke-test two or three routes with curl, and run Playwright if configured. Keep the process running.

Mobile (Flutter):
1. `flutter devices`.
2. Pick the target in this order: the developer's stated preference, a connected physical device, an already booted simulator or emulator, then boot one (`open -a Simulator` and wait until `flutter devices` lists it, or `flutter emulators --launch <id>`).
3. Start detached: `dev-server.sh start --project "<abs path>" --name mobile -- flutter run -d <device id>` (no `--url`).
4. Confirm from `.opm/mobile.log` that the app launched. Keep it running.

If the app cannot start, treat it as a failing verification: fix, then retry.

## Resuming

When invoked in a directory that already has jump-start artefacts, continue
from the right point instead of starting over:

| Found | Resume at |
|---|---|
| `docs/specs/brief.md` only | Phase 1 |
| A design mirror in `docs/specs/` but no `docs/milestones/` | Phase 4 |
| `docs/milestones/v0.1/STATE.md` | Read STATE.md and PROGRESS.md, then Phase 6 at the first incomplete wave |
| All phases complete in STATE.md | Phase 7 |

## Red flags

| Thought | Reality |
|---|---|
| "The design is obvious, skip the artifact" | The artifact is how the developer catches wrong assumptions cheaply. Build it. |
| "They approved the previous version, this tweak is fine" | Every revision needs its own approval. Ask. |
| "I'll ask the developer one quick question mid-build" | The developer walked away. Decide, log it, continue. |
| "Tests can come after the features" | Every task follows `opm:tdd-workflow`. |
| "Skip the foundation phase, go straight to features" | Green tooling first or every later wave fights the setup. |
| "One big subagent can do the whole phase" | One plan per subagent keeps context small and failures local. |
| "It compiled, so it runs" | G4 needs the app reachable and smoke-tested. |
