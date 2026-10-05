'use strict';
// OPM PreToolUse hook (matcher: Edit|Write|MultiEdit).
// Asks for confirmation before an agent edits a linter/formatter/typecheck
// config, so checks get satisfied by fixing code rather than weakening rules.
// Set OPM_ALLOW_CONFIG_EDITS=1 to allow such edits without asking.
// Creating a config that does not exist yet is always allowed. A .git/config
// edit asks only when it changes core.hooksPath (see docs/threat-model.md).
// The rules live in hooks/lib/bypass-rules.mjs, shared with the mod; when the
// mod is running (OPM_MOD_ACTIVE=<session id>) it asks in process and this script steps aside.

if (
  process.env.OPM_HOOKS_DISABLED === '1' ||
  process.env.OPM_ALLOW_CONFIG_EDITS === '1'
) process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const fs = require('fs');

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

function fileExists(filePath) {
  try { fs.lstatSync(filePath); return true; } catch (err) { return !(err && err.code === 'ENOENT'); }
}

function readFileOrNull(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

// The file facts configEditKind needs, read only as far as configLookup asks.
function fileFacts(lookup, filePath) {
  if (lookup === 'content') {
    const content = readFileOrNull(filePath);
    return { exists: content !== null || fileExists(filePath), content };
  }
  return { exists: fileExists(filePath), content: null };
}

function ask(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(output) + '\n');
}

// The mod sets OPM_MOD_ACTIVE to its session id; only a hook call from that
// same session steps aside, so a variable inherited by a nested, older Claude
// Code (a different session) never silences these checks.
function isHandledByMod(input) {
  const active = process.env.OPM_MOD_ACTIVE;
  return Boolean(active) && Boolean(input) && input.session_id === active;
}

readStdin(async (raw) => {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    if (isHandledByMod(input)) return;
    const toolInput = input && input.tool_input;
    if (!toolInput || typeof toolInput !== 'object') return;
    const { configLookup, configEditKind, configAskReason } = await import('../lib/bypass-rules.mjs');
    const lookup = configLookup(toolInput.file_path);
    if (lookup === null) return;
    const kind = configEditKind(input.tool_name || 'Edit', toolInput, fileFacts(lookup, toolInput.file_path));
    if (kind) ask(configAskReason(toolInput.file_path, kind));
  } catch {
    // Malformed input or internal error: never block the user.
  }
});

// Adapted from affaan-m/ecc (MIT)
