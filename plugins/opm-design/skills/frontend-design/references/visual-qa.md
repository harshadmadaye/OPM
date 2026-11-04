# Visual QA

    node ${CLAUDE_PLUGIN_ROOT}/skills/frontend-design/scripts/visual-qa.mjs <url-or-html-file> <out-dir> [--mcp | --install | --manual]

- `<url-or-html-file>`: the dev server URL, or a local HTML file for static pages.
- `<out-dir>`: a folder in the scratchpad or the OS temp folder, never the repo. The script
  refuses a folder inside the current project.

It screenshots 375×812 and 1280×800, measures horizontal overflow at both and at 320 (F-05),
records console errors, runs axe-core when available, and writes `<out-dir>/visual-qa.json`.

## Tool ladder

The first available rung wins:

1. `OPM_DESIGN_TOOLS` points at a folder with Playwright installed.
2. The project has `playwright` or `@playwright/test` in its own `node_modules`.
3. An earlier consented install exists in `~/.opm/design-tools/`.
4. A Playwright MCP server is connected: pass `--mcp`. The script writes a report listing the
   viewports; you then drive the MCP server to load the page at each viewport, take the
   screenshots into the out-dir, and check console errors and overflow yourself.
5. Nothing is installed: the script exits with exit code 2. Ask the user with AskUserQuestion,
   stating the size: about 150 MB for Playwright, axe-core and Chromium, pinned versions, into
   `~/.opm/design-tools/`. On a yes, rerun with `--install`. On a no, rerun with `--manual`.
6. `--manual`, or a failed install: the script prints a checklist and the report says
   `visual QA: manual, tools unavailable`. Walk the checklist and report it as manual.

A broken install in `~/.opm/design-tools/` is not repaired automatically: delete that folder, then rerun with `--install` after the user agrees.

## Exit codes

- 0: a report was written. Read it; a 0 is not a pass.
- 1: an error, such as an unreachable dev server. The message names the URL; start the server
  and rerun. A page that did not render is never a pass.
- 2: tools are missing; ask before `--install`.

## Reading the report

- `summary`: one line to quote in your report.
- `screenshots`: Read every file. Look for overlap, clipped text, broken alignment and missing
  states.
- To check a colour pair yourself run `contrast.mjs '#1A1A1A' '#FFFFFF'`; quote hex values, because
  the shell reads an unquoted `#` as a comment.
- `horizontalOverflow`: any `true` breaks F-05 at that width.
- `consoleErrors`: fix them all or explain each.
- `axe`: each violation names a rule; map it to F-01, F-08 or F-09 where it fits.
- `accessibility`: `full` (axe ran), `partial` (only the DESIGN.md text/surface contrast was
  checked), or `manual`.
