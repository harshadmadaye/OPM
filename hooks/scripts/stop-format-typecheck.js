'use strict';
// OPM Stop hook. Formats and typechecks the files edited this response
// (from the post-edit-accumulator list), grouped by project root.
//   JS/TS : prettier --write (local bin or npx --no-install), then tsc --noEmit
//           when tsconfig.json + node_modules/.bin/tsc exist in the root.
//   Python: ruff format + ruff check (when ruff is on PATH).
//   Dart  : dart format (when dart is on PATH).
// Reports one status line per check (what ran, what was skipped and why, which
// tool is missing) and stops starting tools at EARLY_STOP_RATIO of the budget.
// tsc errors block the stop ({"decision":"block"}) so Claude fixes them.
// Env: OPM_SKIP_FORMAT=1, OPM_SKIP_TYPECHECK=1, OPM_HOOKS_DISABLED=1,
//      OPM_STOP_BUDGET_MS=<ms> (can only lower the time budget).

if (process.env.OPM_HOOKS_DISABLED === '1') process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const TOTAL_BUDGET_MS = 60000;
const MIN_TOOL_TIMEOUT_MS = 1000;
const TOOL_PROBE_TIMEOUT_MS = 5000;
// check-console-log runs in parallel and reads the same list; keep it alive briefly.
const MIN_LIST_LIFETIME_MS = 1000;
const MAX_REPORT_LINES = 30;
// Stop starting new tools once this share of the budget is spent, so the
// report still gets written before Claude Code's hook timeout kills us.
const EARLY_STOP_RATIO = 0.75;
const MS_PER_SECOND = 1000;
// Lower-only override of TOTAL_BUDGET_MS (used by tests to force the early stop).
const BUDGET_OVERRIDE_ENV = 'OPM_STOP_BUDGET_MS';
const SKIP_FORMAT_ENV = 'OPM_SKIP_FORMAT';
const ROOT_MARKERS = ['package.json', 'pyproject.toml', 'pubspec.yaml'];
const JS_TS = /\.[cm]?[jt]sx?$/i;
const PYTHON = /\.py$/i;
const DART = /\.dart$/i;
const IS_WINDOWS = process.platform === 'win32';
const startedAt = Date.now();

function readStdin(cb) {
  let data = '';
  let done = false;
  const finish = () => { if (done) return; done = true; clearTimeout(timer); cb(data); };
  const timer = setTimeout(() => { process.stdin.destroy(); finish(); }, STDIN_TIMEOUT_MS);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    if (data.length < MAX_STDIN) data += chunk.slice(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', finish);
  process.stdin.on('error', finish);
  process.stdin.on('close', finish);
}

function accumulatorFile(sessionId) {
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'default';
  return path.join(os.tmpdir(), `opm-edited-${safe}.txt`);
}

function budgetMs() {
  const override = Number(process.env[BUDGET_OVERRIDE_ENV]);
  return Number.isInteger(override) && override > 0 && override < TOTAL_BUDGET_MS ? override : TOTAL_BUDGET_MS;
}

function elapsedMs() {
  return Date.now() - startedAt;
}

function remainingMs() {
  return Math.max(MIN_TOOL_TIMEOUT_MS, budgetMs() - elapsedMs());
}

function pastEarlyStop() {
  return elapsedMs() > budgetMs() * EARLY_STOP_RATIO;
}

function seconds(ms) {
  return ms < MS_PER_SECOND ? '<1s' : `${Math.round(ms / MS_PER_SECOND)}s`;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function runTool(command, args, cwd) {
  const begun = Date.now();
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: remainingMs(), shell: IS_WINDOWS,
  });
  return {
    ok: !result.error && result.status === 0,
    timedOut: Boolean(result.error && result.error.code === 'ETIMEDOUT'),
    output: (result.stdout || '') + (result.stderr || ''),
    ms: Date.now() - begun,
  };
}

function onPath(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore', timeout: TOOL_PROBE_TIMEOUT_MS, shell: IS_WINDOWS });
  return !result.error && result.status === 0;
}

function localBin(root, name) {
  const bin = path.join(root, 'node_modules', '.bin', IS_WINDOWS ? `${name}.cmd` : name);
  return fs.existsSync(bin) ? bin : null;
}

function findProjectRoot(filePath, fallback) {
  let dir = path.dirname(filePath);
  const top = path.parse(dir).root;
  for (let depth = 0; depth < 40 && dir !== top; depth++) {
    if (ROOT_MARKERS.some((marker) => fs.existsSync(path.join(dir, marker)))) return dir;
    dir = path.dirname(dir);
  }
  return fallback;
}

function firstLines(text) {
  return text.split('\n').filter(Boolean).slice(0, MAX_REPORT_LINES).join('\n');
}

function notOnPath() {
  return `not found on PATH, install it or set ${SKIP_FORMAT_ENV}=1`;
}

function outcome(result, okText) {
  if (result.timedOut) return `timed out after ${seconds(result.ms)}`;
  return result.ok ? `${okText} in ${seconds(result.ms)}` : `failed in ${seconds(result.ms)}`;
}

// Each check returns { status, detail?, blocker? }; status is the one-line summary.
function checkPrettier(root, files) {
  if (process.env[SKIP_FORMAT_ENV] === '1') return { status: `skipped (${SKIP_FORMAT_ENV}=1)` };
  let command = localBin(root, 'prettier');
  let args = ['--write', '--ignore-unknown', ...files];
  if (!command) {
    if (!fs.existsSync(path.join(root, 'package.json'))) return { status: 'skipped (no package.json or local prettier)' };
    command = IS_WINDOWS ? 'npx.cmd' : 'npx';
    args = ['--no-install', 'prettier', ...args];
  }
  const result = runTool(command, args, root);
  if (!result.ok && !result.timedOut && command.startsWith('npx')) {
    return { status: 'not installed (npx --no-install prettier failed), add it to devDependencies' };
  }
  return { status: outcome(result, `formatted ${plural(files.length, 'file')}`) };
}

function checkTsc(root) {
  if (process.env.OPM_SKIP_TYPECHECK === '1') return { status: 'skipped (OPM_SKIP_TYPECHECK=1)' };
  if (!fs.existsSync(path.join(root, 'tsconfig.json'))) return { status: 'skipped (no tsconfig.json)' };
  const tsc = localBin(root, 'tsc');
  if (!tsc) return { status: 'not found in node_modules/.bin, install typescript or set OPM_SKIP_TYPECHECK=1' };
  const result = runTool(tsc, ['--noEmit', '--pretty', 'false', '-p', root], root);
  const count = result.output.split('\n').filter((line) => /error TS\d+/.test(line)).length;
  if (result.ok || result.timedOut || count === 0) return { status: outcome(result, 'passed') };
  const errors = plural(count, 'error');
  return {
    status: `${errors} in ${seconds(result.ms)}`,
    blocker: `OPM: tsc reported ${errors} in ${root}:\n${firstLines(result.output)}`,
  };
}

function checkRuff(root, files) {
  if (process.env[SKIP_FORMAT_ENV] === '1') return { status: `skipped (${SKIP_FORMAT_ENV}=1)` };
  if (!onPath('ruff')) return { status: notOnPath() };
  const format = runTool('ruff', ['format', ...files], root);
  const formatted = `formatted ${plural(files.length, 'file')}`;
  if (!format.ok) return { status: `format ${outcome(format, formatted)}` };
  if (pastEarlyStop()) return { status: `${formatted}, check skipped (time budget)` };
  const check = runTool('ruff', ['check', ...files], root);
  const totalMs = format.ms + check.ms;
  if (check.ok) return { status: `${formatted}, check passed in ${seconds(totalMs)}` };
  if (check.timedOut) return { status: `${formatted}, check timed out after ${seconds(totalMs)}` };
  return {
    status: `${formatted}, check found issues in ${seconds(totalMs)}`,
    detail: `OPM: ruff check reported issues in ${root}:\n${firstLines(check.output)}`,
  };
}

function checkDart(root, files) {
  if (process.env[SKIP_FORMAT_ENV] === '1') return { status: `skipped (${SKIP_FORMAT_ENV}=1)` };
  if (!onPath('dart')) return { status: notOnPath() };
  return { status: outcome(runTool('dart', ['format', ...files], root), `formatted ${plural(files.length, 'file')}`) };
}

const CHECKS = [
  { name: 'prettier', matches: JS_TS, kind: '.js/.ts', run: checkPrettier },
  { name: 'ruff', matches: PYTHON, kind: '.py', run: checkRuff },
  { name: 'dart', matches: DART, kind: '.dart', run: checkDart },
  { name: 'tsc', matches: JS_TS, kind: '.js/.ts', run: (root) => checkTsc(root) },
];

function groupByRoot(files, fallbackRoot) {
  const groups = new Map();
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const root = findProjectRoot(file, fallbackRoot);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(file);
  }
  return groups;
}

function sleepUntil(timestamp) {
  const wait = timestamp - Date.now();
  if (wait > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
}

function runChecks(groups) {
  const report = { lines: [], details: [], blockers: [], skipped: 0 };
  const multiRoot = groups.size > 1;
  for (const check of CHECKS) {
    const touched = [...groups].filter(([, group]) => group.some((file) => check.matches.test(file)));
    if (!touched.length) { report.lines.push(`${check.name}: skipped (no ${check.kind} changed)`); continue; }
    for (const [root, group] of touched) {
      if (pastEarlyStop()) { report.skipped++; continue; }
      const result = check.run(root, group.filter((file) => check.matches.test(file)));
      report.lines.push(`${check.name}: ${result.status}${multiRoot ? ` (${root})` : ''}`);
      if (result.detail) report.details.push(result.detail);
      if (result.blocker) report.blockers.push(result.blocker);
    }
  }
  if (report.skipped) {
    report.lines.push(`stopped early: ${plural(report.skipped, 'check')} skipped to stay inside the hook timeout`);
  }
  return report;
}

function processList(listFile, fallbackRoot) {
  const files = [...new Set(fs.readFileSync(listFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))];
  const groups = groupByRoot(files, fallbackRoot);
  const checkable = [...groups.values()].some((group) => group.some((file) => CHECKS.some((c) => c.matches.test(file))));
  return checkable ? runChecks(groups) : null;
}

function emit(report) {
  const summary = ['OPM checks:', ...report.lines.map((line) => `  ${line}`)].join('\n');
  const body = [...report.blockers, ...report.details, summary].join('\n\n');
  const output = report.blockers.length ? { decision: 'block', reason: body } : { systemMessage: body };
  process.stdout.write(JSON.stringify(output) + '\n');
}

readStdin((raw) => {
  let listFile = null;
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    if (input.stop_hook_active === true) return;
    listFile = accumulatorFile(input.session_id);
    if (!fs.existsSync(listFile)) return;
    const fallbackRoot = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
    const report = processList(listFile, fallbackRoot);
    if (report) emit(report);
  } catch (err) {
    process.stderr.write(`[opm] stop-format-typecheck: ${err && err.message}\n`);
  } finally {
    if (listFile && fs.existsSync(listFile)) {
      sleepUntil(startedAt + MIN_LIST_LIFETIME_MS);
      try { fs.unlinkSync(listFile); } catch { /* best effort */ }
    }
  }
});

// Adapted from affaan-m/ecc (MIT)
