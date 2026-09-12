'use strict';
// OPM PostToolUse hook (matcher: Edit|Write|MultiEdit).
// Records every edited file path in a per-session list so the Stop hooks can
// format/typecheck/scan only what changed this response. Produces no output.
// List location: <tmpdir>/opm-edited-<session_id>.txt (one absolute path per line).

if (process.env.OPM_HOOKS_DISABLED === '1') process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;

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

function editedPaths(toolInput, cwd) {
  const candidates = [toolInput.file_path];
  if (Array.isArray(toolInput.edits)) for (const edit of toolInput.edits) candidates.push(edit && edit.file_path);
  return candidates
    .filter((candidate) => typeof candidate === 'string' && candidate.trim())
    .map((candidate) => path.resolve(cwd, candidate.trim()));
}

function appendUnique(listFile, newPaths) {
  let existing = [];
  try { existing = fs.readFileSync(listFile, 'utf8').split('\n').filter(Boolean); } catch { /* first write */ }
  const merged = [...new Set([...existing, ...newPaths])];
  if (merged.length === existing.length) return;
  fs.writeFileSync(listFile, merged.join('\n') + '\n', 'utf8');
}

readStdin((raw) => {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    const toolInput = input && input.tool_input;
    if (!toolInput || typeof toolInput !== 'object') return;
    const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
    const paths = editedPaths(toolInput, cwd);
    if (paths.length > 0) appendUnique(accumulatorFile(input.session_id), paths);
  } catch {
    // Never let bookkeeping failures surface to the user.
  }
});

// Adapted from affaan-m/ecc (MIT)
