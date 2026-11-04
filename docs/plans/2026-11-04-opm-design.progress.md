# OPM ledger - plan: docs/plans/2026-11-04-opm-design.md
Branch: worktree-design-skills  Base: 6077e93
Spec: docs/specs/2026-11-03-opm-design.md (reachable)
Preflight: T1 manifest test vs plugin.json/marketplace copy (asks before, 150 MB, ~/.opm/design-tools) - consistent
Preflight: T3 contrast exports -> T4 validator imports (isHex, contrastRatio, AA_NORMAL_TEXT) - consistent
Preflight: T4 exports -> T6 design-contrast imports (parseDesignMd, textSurfaceContrast, DesignFormatError) - consistent
Preflight: T5 parseInventory/checkFlows -> T9 handoff-template test - consistent (first matching table is the inventory)
Preflight: T6 flags/exit codes -> T8 visual-qa.md test needles - consistent
Preflight: T7-T9 SKILL.md 4800-byte test cap == T11 1200-token enforced cap - consistent
Preflight: T8 reviewer brief (change.diff, DESIGN.md, screenshots, visual-qa.json) -> T10 agent inputs - consistent
Preflight: T2 lint scans all plugin .md -> T7-T10 citations - re-checked on each later task
Preflight: T12 changes parseArgs shape -> existing trigger-eval test updated in same task; test file lacks fs/ROOT requires, task says to add them - consistent
Preflight: T13 manifest pointer count (3 x "opm-design:") vs using-opm line - consistent
Ruling: model tiers - haiku for full-code transcription tasks (1-5, 7-10), sonnet for 6, 11, 12, 13 and all reviewers, opus for final review - plan carries complete code - cost if wrong: extra fix rounds
Ruling: tests/hooks.test.js "unchanged when the cwd has no open ledger" fails while this ledger is open (cwd 42 falls back to process.cwd = repo root) - pre-existing test fragility, not task-caused; passes once the ledger is fully complete - cost if wrong: final verification must confirm it is green
Ruling: installed OPM 0.9.1 Stop hook prettier-reformats edited JS after each subagent turn (uncommitted) - revert with git checkout after each task before review; not editing user settings to set OPM_SKIP_FORMAT - cost if wrong: a reformat slips into a commit, caught by review
Task 1: complete (commits 6077e93..eabaa33, review clean)
Task 1: minor (deferred): plugin.json has no icon (claude plugin validate ICON_MISSING warning), same as opm-video
Task 2: complete (commits eabaa33..b02e91e, review clean)
Task 2: minor (deferred): lint checks cited IDs exist, not their tier (citing F-* as waivable passes) - plan-mandated
Ruling: batch Tasks 3-5 (three independent zero-dep scripts, full code in plan) into one sequential implementer with one commit per task and one reviewer - same-shape transcription work - cost if wrong: one larger fix round
Task 3: complete (commits b02e91e..e448072, review clean)
Task 4: complete (commits e448072..fa82e43, review clean)
Task 5: complete (commits fa82e43..0014791, review clean)
Task 5: minor (deferred): check-flows splits on escaped pipes and reads tables inside code fences; does not check that link targets are real screens
Task 4: minor (deferred): YAML subset accepts `__proto__` key (prototype mutation, silently dropped); quoted-value regex accepts `"x" and "y"`; only first text/surface pair checked
Task 3: minor (deferred): ratio display rounds (4.496 prints 4.50 FAIL); isMain false => silent exit 0, no symlink/Windows CLI test
Ruling: Task 6 review findings 1-4 (HTTP status not checked, unrepairable partial install, win32 spaces in npm prefix, CSP blocks axe) are plan defects against the spec's "never a pass for a page that did not render" and consent/install guarantees - fix in round 1 with tests, plus minors 5, 6, 8 (contrast error counted partial, ..foo path, missing chromium export) - cost if wrong: small extra code
Task 6: minor (deferred): networkidle may time out on SSE/HMR dev servers; project Playwright without Chromium not routed to consent; home install versions not checked against pins
Task 6: fix round 1/3 (7 addressed, 0 open; commits dc31d34..982c52c)
Task 6: complete (commits 0014791..982c52c, review clean)
Task 6: minor (deferred): stale install marker survives a failed re-install; capture.mjs browser paths (assertPageLoaded, bypassCSP) untested - need one manual Playwright run before release
Ruling: batch Tasks 7-10 (markdown skills/agent plus doc tests, full text in plan) into one sequential implementer, one commit per task, one reviewer - same-shape transcription - cost if wrong: one larger fix round
Ruling: Tasks 7-10 review - agent rejected every manual report (contradicted its four-input rule) and may not get ${CLAUDE_PLUGIN_ROOT} expanded - fix in round 1: manual reports reviewed from diff + report checklist, Glob fallback for the plugin root; keep P/ shorthand in skills (same pattern as opm-video S/) - cost if wrong: reviewer cannot find scripts in some hosts
Task 8: minor (deferred): redesign.md sentence reworded to "never blend" (lowercase) to satisfy its test - meaning unchanged
Task 10: minor (deferred): "stale" screenshots in verdict but no staleness check
Task 7-10: fix round 1/3 (3 addressed, 0 open; commits 64a6592..43ac1fd; 3-line diff verified by controller)
Task 7: complete (commits 982c52c..353c94a, review clean)
Task 8: complete (commits 353c94a..a491491, review clean)
Task 9: complete (commits a491491..07ad125 + 43ac1fd, review clean)
Task 10: complete (commits 07ad125..64a6592 + 43ac1fd, review clean)
Ruling: batch Tasks 11-12 (two small edits to existing core scripts + tests, disjoint files) into one sequential implementer, one commit each, one reviewer - cost if wrong: one larger fix round
Task 11: complete (commits 43ac1fd..9247c1d, review clean)
Task 12: complete (commits 9247c1d..7c3de67, review clean)
Task 12: minor (deferred): COST_WARNING still quotes "$0.70 for all 30" for the 14-prompt design suite - plan-mandated
Ruling: Task 13 licence lookups via unauthenticated GitHub REST (active gh account is a work account; memory forbids it) - verified 6 sources, 5 left out as unresolved/not design - cost if wrong: a credit missing, fixable later
Task 13: fix round 1/3 (1 addressed, 0 open - Apache paragraph named unverified anthropics/skills; commits a97185a..66d024e; diff verified by controller)
Task 13: complete (commits 7c3de67..66d024e, review clean)
Task 13: minor (deferred): README simplifies the tool ladder ("your project's own Playwright"); craft-floor credit omits ux-flow-designer (flows source)
Final review: code-reviewer (opus) 1 Important (mcp runs always recapture) + 3 Minor; security-reviewer 0 CRIT/HIGH/MED, 2 LOW (URL credentials in report, out-dir check vs cwd not project root)
Ruling: final fix pass covers the Important, all 3 Minors, 4 triaged "fix now" minors (ratio truncation, networkidle grace, project-Playwright launch failure -> consent path, COST_WARNING) and both security LOWs - one fixer, one scoped re-review
Ruling: left as-is per triage - check-flows escaped pipes/fences/link targets, YAML __proto__ and quote edge cases, first text/surface pair only, isMain silent exit, home pin check, reviewer staleness, README ladder summary - all low risk, documented here
Final fix pass: 11/11 addressed (commits 66d024e..3d3ec67), scoped re-review clean; stray formatter reformat of redact-url.mjs reverted
Final review: minor (deferred): page console errors not URL-redacted; reportWithFallback overwrites an earlier reason; reviewer mcp test is a wording pin only
Verification: npm test 422/422 pass; npm run tokens exit 0 (core 2563/2650, opm-design 346); package-contents pass; claude plugin validate --strict passed; no secrets or debug residue in main..HEAD
