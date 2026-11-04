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

export function assertOutsideProject(outDir, projectRoot) {
  const relative = path.relative(path.resolve(projectRoot), path.resolve(outDir));
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
    throw new UnreachableError(`Could not reach ${url} (${reason}). Start the dev server, for example with npm run dev, then run visual QA again.`);
  }
  if (!response.ok) throw new UnreachableError(`${url} answered HTTP ${response.status}. Start the dev server or fix the page, then run visual QA again.`);
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

async function buildReport({ selection, url, outDir, cwd, contrast }) {
  if (selection.mode !== 'playwright') return fallbackReport({ tool: selection.mode, url, reason: selection.reason, contrast });
  const playwright = await loadPlaywright(selection);
  const captured = await capture({ playwright, url, outDir, axeSource: axeSourceFor(selection, cwd) });
  return playwrightReport({ url, selection, capture: captured, contrast });
}

export async function run(argv, { env = process.env, cwd = process.cwd() } = {}) {
  const args = parseArgs(argv);
  const url = toUrl(args.target);
  assertOutsideProject(args.outDir, cwd);
  await checkReachable(url);
  let selection = selectTool({ env, flags: args.flags, resolveInProject: projectResolver(cwd) });
  if (selection.mode === 'needs-consent') {
    console.error(`Visual QA tools are not installed. Ask the user first, then rerun with --install to download ${DOWNLOAD_NOTE} into ${selection.toolsDir}, or rerun with --manual.`);
    return EXIT.needsConsent;
  }
  if (selection.mode === 'install') selection = installOrFallBack(selection);
  fs.mkdirSync(args.outDir, { recursive: true });
  const report = await buildReport({ selection, url, outDir: args.outDir, cwd, contrast: designContrast(cwd) });
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
