#!/usr/bin/env node
// Screenshots a page at phone and desktop widths and reports console errors, horizontal
// overflow (also at 320px) and axe-core results. Never reports a pass for a page that did not render.
// Usage: node visual-qa.mjs <url-or-html-file> <out-dir> [--mcp | --install | --manual]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMain } from '../../../shared/is-main.mjs';
import { selectTool, projectResolver, DOWNLOAD_NOTE } from './lib/tool-ladder.mjs';
import { installTools } from './lib/install.mjs';
import { capture, loadPlaywright, axeSourceFor, VIEWPORTS, OVERFLOW_PROBE_WIDTH, viewportLabel } from './lib/capture.mjs';
import { designContrast } from './lib/design-contrast.mjs';
import { redactUrl } from './lib/redact-url.mjs';

export { redactUrl };

export const EXIT = Object.freeze({ ok: 0, error: 1, needsConsent: 2 });
const FLAGS = Object.freeze(['--mcp', '--install', '--manual']);
const REACH_TIMEOUT_MS = 5000;
const REPORT_FILE = 'visual-qa.json';
const USAGE = 'usage: visual-qa.mjs <url-or-html-file> <out-dir> [--mcp | --install | --manual]';

export const MANUAL_CHECKLIST = Object.freeze([
  'Open the page at 375px and 1280px wide and look at every section.',
  'F-01: check body text and button labels against their backgrounds with contrast.mjs.',
  'F-02: Tab through every control; each shows a visible focus style.',
  'F-03: turn on reduced motion in the OS; animations stop or shorten.',
  'F-04: every button and link in a list is at least 44x44 CSS px.',
  'F-05: at 320px wide there is no horizontal scroll.',
  'F-08 and F-09: images have alt text and every field has a label.',
  'Open the browser console; it shows no errors.',
]);

export class UsageError extends Error {}
export class UnreachableError extends Error {}

export function parseArgs(argv) {
  const unknown = argv.find((a) => a.startsWith('--') && !FLAGS.includes(a));
  if (unknown) throw new UsageError(`unknown option ${unknown}. ${USAGE}`);
  const positional = argv.filter((a) => !a.startsWith('--'));
  if (positional.length !== 2) throw new UsageError(USAGE);
  return {
    target: positional[0],
    outDir: path.resolve(positional[1]),
    flags: { mcp: argv.includes('--mcp'), install: argv.includes('--install'), manual: argv.includes('--manual') },
  };
}

export function toUrl(target, exists = fs.existsSync) {
  if (/^https?:\/\//i.test(target)) return target;
  if (exists(target)) return pathToFileURL(path.resolve(target)).href;
  throw new UsageError(`${target} is neither an http(s) URL nor an existing file`);
}

// The nearest ancestor of cwd holding a .git file or folder, else cwd itself.
export function findProjectRoot(cwd, exists = fs.existsSync) {
  const start = path.resolve(cwd);
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (exists(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return start;
  }
}

// Real path of the deepest existing ancestor, with the not-yet-created remainder appended.
function realPathOfPlanned(target, realpath = fs.realpathSync) {
  const remainder = [];
  let current = path.resolve(target);
  for (;;) {
    try {
      return path.join(realpath(current), ...remainder);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      remainder.unshift(path.basename(current));
      current = parent;
    }
  }
}

export function assertOutsideProject(outDir, projectRoot) {
  const relative = path.relative(realPathOfPlanned(projectRoot), realPathOfPlanned(outDir));
  const isOutside = relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
  if (!isOutside) {
    throw new UsageError(`out-dir ${outDir} is inside the project; use the scratchpad or the OS temp folder`);
  }
}

export async function checkReachable(url, fetchImpl = fetch) {
  if (!/^https?:/i.test(url)) return;
  let response;
  try {
    response = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(REACH_TIMEOUT_MS) });
  } catch (error) {
    const reason = (error.cause && error.cause.code) || error.message;
    throw new UnreachableError(`Could not reach ${redactUrl(url)} (${reason}). Start the dev server, for example with npm run dev, then run visual QA again.`);
  }
  if (!response.ok) throw new UnreachableError(`${redactUrl(url)} answered HTTP ${response.status}. Start the dev server or fix the page, then run visual QA again.`);
}

function summarize(report) {
  if (report.tool === 'manual') return 'visual QA: manual, tools unavailable';
  if (report.tool === 'mcp') return 'visual QA: mcp, drive the Playwright MCP server at the listed viewports';
  const errorCount = Object.values(report.consoleErrors).flat().length;
  const overflowAt = Object.entries(report.horizontalOverflow).filter(([, isOver]) => isOver).map(([at]) => at);
  const axeText = report.axe === 'unavailable' ? 'axe unavailable' : `${Object.values(report.axe).flat().length} axe violations`;
  return `visual QA: playwright, ${report.screenshots.length} screenshots, ${errorCount} console errors, `
    + `overflow at ${overflowAt.join(', ') || 'none'}, ${axeText}, accessibility ${report.accessibility}`;
}

export function playwrightReport({ url, selection, capture: captured, contrast }) {
  const byViewport = (key) => Object.fromEntries(captured.results.map((r) => [r.viewport, r[key]]));
  const isAxeAvailable = captured.results.every((r) => r.axe !== 'unavailable');
  const report = {
    tool: 'playwright',
    source: selection.source,
    url,
    generatedAt: new Date().toISOString(),
    viewports: captured.results.map((r) => r.viewport),
    screenshots: captured.results.map((r) => r.screenshot),
    consoleErrors: byViewport('consoleErrors'),
    horizontalOverflow: { ...byViewport('horizontalOverflow'), [OVERFLOW_PROBE_WIDTH]: captured.probe },
    axe: isAxeAvailable ? byViewport('axe') : 'unavailable',
    accessibility: isAxeAvailable ? 'full' : contrast && !contrast.error ? 'partial' : 'unavailable',
    contrast,
  };
  return { ...report, summary: summarize(report) };
}

export function fallbackReport({ tool, url, reason, contrast }) {
  const report = {
    tool,
    url,
    reason: reason || null,
    generatedAt: new Date().toISOString(),
    viewports: VIEWPORTS.map(viewportLabel),
    overflowProbeWidth: OVERFLOW_PROBE_WIDTH,
    screenshots: [],
    consoleErrors: {},
    horizontalOverflow: {},
    axe: 'unavailable',
    accessibility: contrast && !contrast.error ? 'partial' : 'manual',
    contrast,
    ...(tool === 'manual' ? { checklist: [...MANUAL_CHECKLIST] } : {}),
  };
  return { ...report, summary: summarize(report) };
}

function installOrFallBack(selection) {
  try {
    installTools(selection.toolsDir);
    return { mode: 'playwright', source: 'home', toolsDir: selection.toolsDir };
  } catch (error) {
    return { mode: 'manual', reason: `install failed: ${error.message}` };
  }
}

const MISSING_BROWSER = /Executable doesn't exist|playwright install/i;

// A project Playwright without a browser must not steer toward an unconsented download:
// resolve again without the project rung and continue down the ladder.
export function nextSelectionAfterLaunchFailure(selection, error, selectArgs) {
  if (selection.source !== 'project' || !MISSING_BROWSER.test(error?.message ?? '')) throw error;
  const firstLine = error.message.split('\n')[0];
  return {
    selection: selectTool({ ...selectArgs, resolveInProject: () => null }),
    reason: `project Playwright has no browser: ${firstLine}`,
  };
}

async function buildReport({ selection, url, shownUrl, outDir, cwd, contrast }) {
  if (selection.mode !== 'playwright') return fallbackReport({ tool: selection.mode, url: shownUrl, reason: selection.reason, contrast });
  const playwright = await loadPlaywright(selection);
  const captured = await capture({ playwright, url, outDir, axeSource: axeSourceFor(selection, cwd) });
  return playwrightReport({ url: shownUrl, selection, capture: captured, contrast });
}

function needsConsentMessage(selection) {
  return `Visual QA tools are not installed. Ask the user first, then rerun with --install to download ${DOWNLOAD_NOTE} into ${selection.toolsDir}, or rerun with --manual.`;
}

// Builds the report; when a project Playwright has no browser, falls down the ladder once.
async function reportWithFallback({ selection, selectArgs, ...rest }) {
  try {
    return { report: await buildReport({ selection, ...rest }) };
  } catch (error) {
    const next = nextSelectionAfterLaunchFailure(selection, error, selectArgs);
    if (next.selection.mode === 'needs-consent') return { consent: next };
    const settled = next.selection.mode === 'install' ? installOrFallBack(next.selection) : next.selection;
    const report = await buildReport({ selection: settled, ...rest });
    return { report: { ...report, reason: next.reason } };
  }
}

export async function run(argv, { env = process.env, cwd = process.cwd() } = {}) {
  const args = parseArgs(argv);
  const url = toUrl(args.target);
  assertOutsideProject(args.outDir, findProjectRoot(cwd));
  await checkReachable(url);
  const selectArgs = { env, flags: args.flags };
  let selection = selectTool({ ...selectArgs, resolveInProject: projectResolver(cwd) });
  if (selection.mode === 'needs-consent') {
    console.error(needsConsentMessage(selection));
    return EXIT.needsConsent;
  }
  if (selection.mode === 'install') selection = installOrFallBack(selection);
  fs.mkdirSync(args.outDir, { recursive: true });
  const outcome = await reportWithFallback({
    selection, selectArgs, url, shownUrl: redactUrl(url), outDir: args.outDir, cwd, contrast: designContrast(cwd),
  });
  if (outcome.consent) {
    console.error(`${outcome.consent.reason}. ${needsConsentMessage(outcome.consent.selection)}`);
    return EXIT.needsConsent;
  }
  const { report } = outcome;
  const reportPath = path.join(args.outDir, REPORT_FILE);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(report.summary);
  if (report.reason) console.log(`reason: ${report.reason}`);
  (report.checklist || []).forEach((item) => console.log(`- ${item}`));
  console.log(`report: ${reportPath}`);
  return EXIT.ok;
}

if (isMain(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (error) => {
      console.error(`visual-qa: ${error.message}`);
      process.exitCode = EXIT.error;
    },
  );
}
