'use strict';
// OPM Stop hook. Scans only the files edited this response (from the
// post-edit-accumulator list) for leftover debug output and reports a
// non-blocking systemMessage warning:
//   JS/TS  console.log(      Dart  print( / debugPrint(      Python  print(
// Skipped: test files, scripts/ directories, and files containing "opm-allow-console".

if (process.env.OPM_HOOKS_DISABLED === '1') process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const MAX_FINDINGS = 20;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOW_MARKER = 'opm-allow-console';
const RULES = [
  { ext: /\.[cm]?[jt]sx?$/i, pattern: /\bconsole\.log\s*\(/ },
  { ext: /\.dart$/i, pattern: /(?<![\w.])(debugPrint|print)\s*\(/ },
  { ext: /\.py$/i, pattern: /(?<![\w.])print\s*\(/ },
];
const SKIP_PATHS = [
  /\.(test|spec)\.[cm]?[jt]sx?$/i,
  /(^|[\\/])(__tests__|__mocks__|tests?|scripts|test_driver|integration_test)([\\/]|$)/i,
  /(^|[\\/])test_[^\\/]*\.py$/i,
  /_test\.(py|dart)$/i,
  /(^|[\\/])conftest\.py$/i,
];
const COMMENT_LINE = /^\s*(\/\/|#|\*|\/\*)/;

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

function readEditedFiles(sessionId) {
  try {
    const raw = fs.readFileSync(accumulatorFile(sessionId), 'utf8');
    return [...new Set(raw.split('\n').map((line) => line.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function scanFile(filePath, pattern) {
  let stat;
  try { stat = fs.statSync(filePath); } catch { return []; }
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(ALLOW_MARKER)) return [];
  const findings = [];
  content.split('\n').forEach((line, index) => {
    if (COMMENT_LINE.test(line) || !pattern.test(line)) return;
    findings.push(`${filePath}:${index + 1}  ${line.trim().slice(0, 100)}`);
  });
  return findings;
}

function collectFindings(files) {
  const findings = [];
  for (const file of files) {
    if (SKIP_PATHS.some((skip) => skip.test(file))) continue;
    const rule = RULES.find((candidate) => candidate.ext.test(file));
    if (!rule) continue;
    findings.push(...scanFile(file, rule.pattern));
    if (findings.length >= MAX_FINDINGS) break;
  }
  return findings;
}

readStdin((raw) => {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    const findings = collectFindings(readEditedFiles(input.session_id));
    if (findings.length === 0) return;
    const shown = findings.slice(0, MAX_FINDINGS);
    const more = findings.length > MAX_FINDINGS ? `\n  ...and more` : '';
    const message =
      'OPM: debug output left in edited files (remove it before committing, ' +
      `or add a "${ALLOW_MARKER}" comment to the file if intentional):\n  ` +
      shown.join('\n  ') + more;
    process.stdout.write(JSON.stringify({ systemMessage: message }) + '\n');
  } catch {
    // Scanning is advisory only; never fail the stop.
  }
});

// Adapted from affaan-m/ecc (MIT)
