'use strict';
// OPM Stop hook. Formats and typechecks the files edited this response
// (from the post-edit-accumulator list), grouped by project root.
//   JS/TS : prettier --write (local bin or npx --no-install), then tsc --noEmit
//           when tsconfig.json + node_modules/.bin/tsc exist in the root.
//   Python: ruff format + ruff check (when ruff is on PATH).
//   Dart  : dart format (when dart is on PATH).
// tsc errors block the stop ({"decision":"block"}) so Claude fixes them.
// Env: OPM_SKIP_FORMAT=1, OPM_SKIP_TYPECHECK=1, OPM_HOOKS_DISABLED=1.

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

function remainingMs() {
  return Math.max(MIN_TOOL_TIMEOUT_MS, TOTAL_BUDGET_MS - (Date.now() - startedAt));
}

function runTool(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: remainingMs(), shell: IS_WINDOWS,
  });
  return { ok: !result.error && result.status === 0, output: (result.stdout || '') + (result.stderr || '') };
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

function formatJs(root, files) {
  if (process.env.OPM_SKIP_FORMAT === '1') return;
  let command = localBin(root, 'prettier');
  let args = ['--write', '--ignore-unknown', ...files];
  if (!command) {
    if (!fs.existsSync(path.join(root, 'package.json'))) return;
    command = IS_WINDOWS ? 'npx.cmd' : 'npx';
    args = ['--no-install', 'prettier', ...args];
  }
  runTool(command, args, root);
}

function typecheck(root) {
  if (process.env.OPM_SKIP_TYPECHECK === '1') return null;
  if (!fs.existsSync(path.join(root, 'tsconfig.json'))) return null;
  const tsc = localBin(root, 'tsc');
  if (!tsc) return null;
  const result = runTool(tsc, ['--noEmit', '--pretty', 'false', '-p', root], root);
  if (result.ok) return null;
  const lines = result.output.split('\n').filter(Boolean);
  const count = lines.filter((line) => /error TS\d+/.test(line)).length;
  if (count === 0) return null;
  return `OPM: tsc reported ${count} error${count === 1 ? '' : 's'} in ${root}:\n${lines.slice(0, MAX_REPORT_LINES).join('\n')}`;
}

function formatPython(root, files, warnings) {
  if (process.env.OPM_SKIP_FORMAT === '1' || !onPath('ruff')) return;
  runTool('ruff', ['format', ...files], root);
  const check = runTool('ruff', ['check', ...files], root);
  if (!check.ok && check.output.trim()) {
    warnings.push(`OPM: ruff check reported issues in ${root}:\n${check.output.split('\n').slice(0, MAX_REPORT_LINES).join('\n')}`);
  }
}

function formatDart(root, files) {
  if (process.env.OPM_SKIP_FORMAT === '1' || !onPath('dart')) return;
  runTool('dart', ['format', ...files], root);
}

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

function processList(listFile, fallbackRoot) {
  const files = [...new Set(fs.readFileSync(listFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))];
  const blockers = [];
  const warnings = [];
  for (const [root, group] of groupByRoot(files, fallbackRoot)) {
    const js = group.filter((f) => JS_TS.test(f));
    const py = group.filter((f) => PYTHON.test(f));
    const dart = group.filter((f) => DART.test(f));
    if (js.length) formatJs(root, js);
    if (py.length) formatPython(root, py, warnings);
    if (dart.length) formatDart(root, dart);
    if (js.length) { const report = typecheck(root); if (report) blockers.push(report); }
  }
  return { blockers, warnings };
}

readStdin((raw) => {
  let listFile = null;
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    if (input.stop_hook_active === true) return;
    listFile = accumulatorFile(input.session_id);
    if (!fs.existsSync(listFile)) return;
    const fallbackRoot = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
    const { blockers, warnings } = processList(listFile, fallbackRoot);
    if (blockers.length) {
      process.stdout.write(JSON.stringify({ decision: 'block', reason: blockers.join('\n\n') }) + '\n');
    } else if (warnings.length) {
      process.stdout.write(JSON.stringify({ systemMessage: warnings.join('\n\n') }) + '\n');
    }
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
