'use strict';
// OPM PreToolUse hook (matcher: Edit|Write|MultiEdit).
// Asks for confirmation before an agent edits a linter/formatter/typecheck
// config, so checks get satisfied by fixing code rather than weakening rules.
// Set OPM_ALLOW_CONFIG_EDITS=1 to allow such edits without asking.
// Creating a config that does not exist yet is always allowed.

if (process.env.OPM_HOOKS_DISABLED === '1' || process.env.OPM_ALLOW_CONFIG_EDITS === '1') process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const PROTECTED_BASENAMES = [
  /^\.eslintrc(\..+)?$/i,
  /^eslint\.config\.[cm]?[jt]s$/i,
  /^\.prettierrc(\..+)?$/i,
  /^prettier\.config\.[cm]?js$/i,
  /^biome\.jsonc?$/i,
  /^tsconfig(\..+)?\.json$/i,
  /^\.?ruff\.toml$/i,
  /^analysis_options\.yaml$/i,
  /^\.editorconfig$/i,
];
const HUSKY_DIR = /(^|[\\/])\.husky[\\/]/;
const PYPROJECT = /^pyproject\.toml$/i;
const LINT_SECTION_HEADER = /^\s*\[tool\.(ruff|mypy)(\.|\])/;
const ANY_SECTION_HEADER = /^\s*\[/;

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

// The [tool.ruff*] / [tool.mypy*] sections of a pyproject.toml, as one string.
function lintSections(toml) {
  const kept = [];
  let inLintSection = false;
  for (const line of toml.split('\n')) {
    if (ANY_SECTION_HEADER.test(line)) inLintSection = LINT_SECTION_HEADER.test(line);
    if (inLintSection) kept.push(line.trim());
  }
  return kept.join('\n');
}

// Apply the proposed Write/Edit/MultiEdit to the current pyproject content.
function simulateEdit(toolName, toolInput, existing) {
  if (toolName === 'Write') return typeof toolInput.content === 'string' ? toolInput.content : existing;
  const edits = toolName === 'MultiEdit' && Array.isArray(toolInput.edits) ? toolInput.edits : [toolInput];
  let result = existing;
  for (const edit of edits) {
    if (!edit || typeof edit.old_string !== 'string' || typeof edit.new_string !== 'string') continue;
    result = edit.replace_all
      ? result.split(edit.old_string).join(edit.new_string)
      : result.replace(edit.old_string, () => edit.new_string);
  }
  return result;
}

function pyprojectTouchesLintConfig(toolName, toolInput, filePath) {
  const existing = readFileOrNull(filePath);
  if (existing === null) return false;
  const proposed = simulateEdit(toolName, toolInput, existing);
  return lintSections(existing) !== lintSections(proposed);
}

function classify(toolName, toolInput) {
  const filePath = toolInput.file_path;
  if (typeof filePath !== 'string' || !filePath) return null;
  const basename = path.basename(filePath);
  if (HUSKY_DIR.test(filePath)) return fileExists(filePath) ? 'git hook script' : null;
  if (PYPROJECT.test(basename)) {
    return pyprojectTouchesLintConfig(toolName, toolInput, filePath) ? '[tool.ruff]/[tool.mypy] config' : null;
  }
  if (!PROTECTED_BASENAMES.some((pattern) => pattern.test(basename))) return null;
  return fileExists(filePath) ? 'linter/formatter/typecheck config' : null;
}

function ask(filePath, kind) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `OPM: ${path.basename(filePath)} is a ${kind}. Agents often loosen these to make ` +
        'checks pass instead of fixing the code. Approve only if this config change is ' +
        'genuinely intended (or set OPM_ALLOW_CONFIG_EDITS=1 to skip this prompt).',
    },
  };
  process.stdout.write(JSON.stringify(output) + '\n');
}

readStdin((raw) => {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    const toolInput = input && input.tool_input;
    if (!toolInput || typeof toolInput !== 'object') return;
    const kind = classify(input.tool_name || 'Edit', toolInput);
    if (kind) ask(toolInput.file_path, kind);
  } catch {
    // Malformed input or internal error: never block the user.
  }
});

// Adapted from affaan-m/ecc (MIT)
