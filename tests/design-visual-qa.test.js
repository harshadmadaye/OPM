'use strict';
// Visual QA: tool ladder, argument checks, reports and error paths. Never launches a browser.
// Run with: node --test tests/design-visual-qa.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPTS = path.resolve(__dirname, '..', 'plugins', 'opm-design', 'skills', 'frontend-design', 'scripts');
const CLI = path.join(SCRIPTS, 'visual-qa.mjs');
const load = (rel) => import(pathToFileURL(path.join(SCRIPTS, rel)).href);
const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const UNREACHABLE_URL = 'http://127.0.0.1:9/';
const CLI_TIMEOUT_MS = 20000;

const envInstall = path.join(os.tmpdir(), 'tools-env');
const homeInstall = path.join(os.tmpdir(), 'tools-home');
const installed = (...dirs) => (p) => dirs.some((d) => p === path.join(d, 'node_modules', 'playwright', 'package.json') || p === path.join(d, '.opm-installed'));
const withoutMarker = (...dirs) => (p) => dirs.some((d) => p === path.join(d, 'node_modules', 'playwright', 'package.json'));

test('the tool ladder picks the first available rung', async () => {
  const { selectTool } = await load('lib/tool-ladder.mjs');
  const none = { env: {}, flags: {}, resolveInProject: () => null, exists: installed(), toolsDir: homeInstall };
  assert.deepEqual(selectTool({ ...none, flags: { manual: true }, exists: installed(envInstall) }), { mode: 'manual', reason: 'manual mode requested' });
  assert.deepEqual(selectTool({ ...none, env: { OPM_DESIGN_TOOLS: envInstall }, exists: installed(envInstall, homeInstall) }), { mode: 'playwright', source: 'env', toolsDir: envInstall });
  assert.deepEqual(selectTool({ ...none, resolveInProject: (n) => (n === '@playwright/test' ? '/p/node_modules/@playwright/test/index.js' : null), exists: installed(homeInstall) }), { mode: 'playwright', source: 'project', modulePath: '/p/node_modules/@playwright/test/index.js' });
  assert.deepEqual(selectTool({ ...none, exists: installed(homeInstall) }), { mode: 'playwright', source: 'home', toolsDir: homeInstall });
  assert.deepEqual(selectTool({ ...none, flags: { mcp: true } }), { mode: 'mcp' });
  assert.deepEqual(selectTool({ ...none, flags: { install: true } }), { mode: 'install', toolsDir: homeInstall });
  assert.deepEqual(selectTool(none), { mode: 'needs-consent', toolsDir: homeInstall });
});

test('OPM_DESIGN_TOOLS pointing at an empty folder falls through to the next rung', async () => {
  const { selectTool } = await load('lib/tool-ladder.mjs');
  const picked = selectTool({ env: { OPM_DESIGN_TOOLS: envInstall }, flags: {}, resolveInProject: () => null, exists: installed(), toolsDir: homeInstall });
  assert.equal(picked.mode, 'needs-consent');
});

test('pinned versions and the download note are stated', async () => {
  const { PINNED_VERSIONS, DOWNLOAD_NOTE, DEFAULT_TOOLS_DIR } = await load('lib/tool-ladder.mjs');
  assert.deepEqual(PINNED_VERSIONS, { playwright: '1.48.2', axeCore: '4.10.2' });
  assert.match(DOWNLOAD_NOTE, /150 MB/);
  assert.equal(DEFAULT_TOOLS_DIR, path.join(os.homedir(), '.opm', 'design-tools'));
});

test('parseArgs, toUrl and assertOutsideProject reject bad input', async () => {
  const { parseArgs, toUrl, assertOutsideProject } = await load('visual-qa.mjs');
  assert.throws(() => parseArgs(['http://x']), /usage/);
  assert.throws(() => parseArgs(['http://x', 'out', '--fast']), /unknown option --fast/);
  assert.deepEqual(parseArgs(['http://x', 'out', '--manual']).flags, { mcp: false, install: false, manual: true });
  assert.equal(toUrl('https://example.test/a'), 'https://example.test/a');
  assert.equal(toUrl('page.html', () => true), pathToFileURL(path.resolve('page.html')).href);
  assert.throws(() => toUrl('nope.html', () => false), /neither an http\(s\) URL nor an existing file/);
  const project = tmp('opm-vqa-project-');
  assert.throws(() => assertOutsideProject(path.join(project, 'shots'), project), /inside the project/);
  assert.throws(() => assertOutsideProject(project, project), /inside the project/);
  assert.doesNotThrow(() => assertOutsideProject(tmp('opm-vqa-out-'), project));
});

test('checkReachable names the URL and how to start the server', async () => {
  const { checkReachable } = await load('visual-qa.mjs');
  const refused = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); };
  await assert.rejects(checkReachable('http://localhost:5173/', refused), /Could not reach http:\/\/localhost:5173\/ \(ECONNREFUSED\)\. Start the dev server/);
  await assert.doesNotReject(checkReachable('file:///tmp/page.html', refused));
});

test('playwrightReport summarises errors, overflow and axe; partial without axe', async () => {
  const { playwrightReport } = await load('visual-qa.mjs');
  const capture = {
    results: [
      { viewport: '375x812', screenshot: '/o/375x812.png', consoleErrors: ['boom'], horizontalOverflow: true, axe: [{ id: 'color-contrast' }] },
      { viewport: '1280x800', screenshot: '/o/1280x800.png', consoleErrors: [], horizontalOverflow: false, axe: [] },
    ],
    probe: true,
  };
  const full = playwrightReport({ url: 'http://x/', selection: { source: 'project' }, capture, contrast: null });
  assert.equal(full.accessibility, 'full');
  assert.deepEqual(full.horizontalOverflow, { '375x812': true, '1280x800': false, 320: true });
  assert.equal(full.summary, 'visual QA: playwright, 2 screenshots, 1 console errors, overflow at 320, 375x812, 1 axe violations, accessibility full');
  const noAxe = { ...capture, results: capture.results.map((r) => ({ ...r, axe: 'unavailable' })) };
  const partial = playwrightReport({ url: 'http://x/', selection: { source: 'home' }, capture: noAxe, contrast: { ratio: 17.7, passes: true } });
  assert.equal(partial.axe, 'unavailable');
  assert.equal(partial.accessibility, 'partial');
});

test('the CLI exits 1 for an unreachable dev server and prints the URL', () => {
  const run = spawnSync(process.execPath, [CLI, UNREACHABLE_URL, tmp('opm-vqa-out-')], { cwd: tmp('opm-vqa-cwd-'), encoding: 'utf8', timeout: CLI_TIMEOUT_MS });
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(UNREACHABLE_URL), run.stderr);
  assert.match(run.stderr, /npm run dev/);
});

test('the CLI exits 2 and states the download size when no tools are installed', () => {
  const home = tmp('opm-vqa-home-');
  const page = path.join(tmp('opm-vqa-page-'), 'page.html');
  fs.writeFileSync(page, '<!doctype html><title>t</title><p>hi</p>');
  const env = { ...process.env, HOME: home, USERPROFILE: home, OPM_DESIGN_TOOLS: '' };
  const run = spawnSync(process.execPath, [CLI, page, tmp('opm-vqa-out-')], { cwd: tmp('opm-vqa-cwd-'), env, encoding: 'utf8', timeout: CLI_TIMEOUT_MS });
  assert.equal(run.status, 2, run.stderr);
  assert.match(run.stderr, /about 150 MB/);
  assert.match(run.stderr, /--install/);
  assert.match(run.stderr, /--manual/);
});

test('--manual writes a manual report and prints the checklist', () => {
  const page = path.join(tmp('opm-vqa-page-'), 'page.html');
  fs.writeFileSync(page, '<!doctype html><title>t</title><p>hi</p>');
  const out = tmp('opm-vqa-out-');
  const run = spawnSync(process.execPath, [CLI, page, out, '--manual'], { cwd: tmp('opm-vqa-cwd-'), encoding: 'utf8', timeout: CLI_TIMEOUT_MS });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /visual QA: manual, tools unavailable/);
  assert.match(run.stdout, /F-05/);
  const report = JSON.parse(fs.readFileSync(path.join(out, 'visual-qa.json'), 'utf8'));
  assert.equal(report.tool, 'manual');
  assert.equal(report.accessibility, 'manual');
  assert.deepEqual(report.viewports, ['375x812', '1280x800']);
  assert.ok(Array.isArray(report.checklist) && report.checklist.length >= 6);
});

test('designContrast reads DESIGN.md tokens when present', async () => {
  const { designContrast } = await load('lib/design-contrast.mjs');
  const dir = tmp('opm-vqa-design-');
  assert.equal(designContrast(dir), null);
  fs.writeFileSync(path.join(dir, 'DESIGN.md'), '---\ncolors:\n  ink:\n    value: "#000000"\n    role: text\n  paper:\n    value: "#FFFFFF"\n    role: surface\n---\n');
  assert.deepEqual(designContrast(dir), { text: 'ink', surface: 'paper', ratio: 21, passes: true, source: 'DESIGN.md' });
});

test('a home install without the marker is not trusted; --install repairs it', async () => {
  const { selectTool, INSTALL_MARKER } = await load('lib/tool-ladder.mjs');
  assert.equal(INSTALL_MARKER, '.opm-installed');
  const base = { env: {}, flags: {}, resolveInProject: () => null, toolsDir: homeInstall };
  assert.equal(selectTool({ ...base, exists: withoutMarker(homeInstall) }).mode, 'needs-consent');
  assert.deepEqual(selectTool({ ...base, flags: { install: true }, exists: withoutMarker(homeInstall) }), { mode: 'install', toolsDir: homeInstall });
  assert.equal(selectTool({ ...base, exists: installed(homeInstall) }).source, 'home');
});

test('npmInvocation handles npm_execpath, win32 quoting and plain npm', async () => {
  const { npmInvocation } = await load('lib/install.mjs');
  const args = ['install', '--prefix', 'C:\\My Tools\\x'];
  assert.deepEqual(npmInvocation(args, { platform: 'win32', npmExecPath: '/n/npm-cli.js', execPath: '/node' }), { command: '/node', args: ['/n/npm-cli.js', ...args], shell: false });
  assert.deepEqual(npmInvocation(args, { platform: 'win32', npmExecPath: '', execPath: '/node' }), { command: 'npm', args: ['install', '--prefix', '"C:\\My Tools\\x"'], shell: true });
  assert.deepEqual(npmInvocation(args, { platform: 'linux', npmExecPath: '', execPath: '/node' }), { command: 'npm', args, shell: false });
});

test('checkReachable rejects an HTTP error status', async () => {
  const { checkReachable } = await load('visual-qa.mjs');
  await assert.rejects(checkReachable('http://localhost:5173/', async () => ({ ok: false, status: 500 })), /HTTP 500/);
  await assert.doesNotReject(checkReachable('http://localhost:5173/', async () => ({ ok: true, status: 200 })));
});

test('a contrast error is not a partial accessibility result', async () => {
  const { playwrightReport } = await load('visual-qa.mjs');
  const capture = { results: [{ viewport: '375x812', screenshot: '/o/a.png', consoleErrors: [], horizontalOverflow: false, axe: 'unavailable' }], probe: false };
  assert.equal(playwrightReport({ url: 'http://x/', selection: { source: 'home' }, capture, contrast: { error: 'DESIGN.md bad' } }).accessibility, 'unavailable');
});

test('assertOutsideProject treats ..foo inside the project as inside', async () => {
  const { assertOutsideProject } = await load('visual-qa.mjs');
  const project = tmp('opm-vqa-project-');
  assert.throws(() => assertOutsideProject(path.join(project, '..foo'), project), /inside the project/);
});
