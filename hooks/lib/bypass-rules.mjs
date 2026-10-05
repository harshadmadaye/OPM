// OPM's hook-bypass and config-protection rules, pure: no Node APIs, no I/O.
// Two callers share them: the settings-hook scripts in hooks/scripts (any
// Claude Code) and the mod in hooks/mod/bypass.mjs (2.1.287+). The caller
// reads files and decides how to deny or ask; this module only judges.
// See docs/threat-model.md.

// ---------------------------------------------------------------------------
// Hook bypass: git commands that skip commit/push hooks.
// ---------------------------------------------------------------------------

const RULE_NAME = 'no-hook-bypass';
const HOOKED_SUBCOMMANDS = new Set(['commit', 'push', 'merge', 'cherry-pick', 'rebase', 'am']);
const GIT_GLOBAL_FLAGS_WITH_VALUE = new Set(['-C', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const COMMIT_OPTIONS_WITH_VALUE = new Set([
  '-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message',
  '-t', '--template', '--author', '--date', '--fixup', '--squash', '--pathspec-from-file',
]);
// Inside a short-option cluster these swallow the rest of the token as their value
// (`-mn` is a message "n"), and `-u`/`-S` take an optional glued value (`-uno`).
const COMMIT_SHORT_WITH_VALUE = 'mFCctuS';
const HOOKS_PATH_CONFIG_KEY = 'core.hookspath';
const HOOKS_PATH_KEY = HOOKS_PATH_CONFIG_KEY + '=';
const HUSKY_BYPASS = /^(HUSKY=(0|false)|HUSKY_SKIP_HOOKS=(1|true))$/i;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// Words that may precede the real command name in a simple command.
const COMMAND_PREFIXES = new Set([
  'env', 'command', 'exec', 'sudo', 'time', 'nohup', 'builtin', 'export',
  'if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '(',
]);
const CONFIG_WRITE_FLAGS = new Set(['--unset', '--unset-all', '--add', '--replace-all']);
const CONFIG_WRITE_VERBS = new Set(['set', 'unset']);
// <<EOF, <<-EOF, <<'EOF', <<"EOF" (but not the <<< here-string).
const HEREDOC_START = /(?<!<)<<(-?)\s*(['"]?)([A-Za-z0-9_.-]+)\2/g;

// Drop heredoc bodies: they are data fed to a command, not commands.
function stripHeredocs(command) {
  const kept = [];
  const pending = [];
  for (const line of command.split('\n')) {
    if (pending.length) {
      const { delimiter, allowTabs } = pending[0];
      if ((allowTabs ? line.replace(/^\t+/, '') : line) === delimiter) pending.shift();
      continue;
    }
    kept.push(line);
    for (const match of line.matchAll(HEREDOC_START)) pending.push({ allowTabs: match[1] === '-', delimiter: match[3] });
  }
  return kept.join('\n');
}

// Split a shell command into simple segments on ; & | and newlines (quote aware).
function splitSegments(text) {
  const segments = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (quote === '"' && ch === '\\') { current += ch + (text[i + 1] || ''); i++; continue; }
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '\\') { current += ch + (text[i + 1] || ''); i++; continue; }
    if (';|&\n'.includes(ch)) { segments.push(current); current = ''; continue; }
    current += ch;
  }
  segments.push(current);
  return segments;
}

// Quote-aware word splitting; stops at an unquoted comment.
function tokenize(segment) {
  const tokens = [];
  let current = '';
  let inToken = false;
  let quote = null;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      if (quote === '"' && ch === '\\' && i + 1 < segment.length) { current += segment[++i]; continue; }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; inToken = true; continue; }
    if (ch === '\\' && i + 1 < segment.length) { current += segment[++i]; inToken = true; continue; }
    if (/\s/.test(ch)) { if (inToken) tokens.push(current); current = ''; inToken = false; continue; }
    if (ch === '#' && !inToken) break;
    current += ch;
    inToken = true;
  }
  if (inToken) tokens.push(current);
  return tokens;
}

function isGitToken(token) {
  const base = token.replace(/^[$(`{!]+/, '').split(/[\\/]/).pop().toLowerCase();
  return base === 'git' || base === 'git.exe';
}

function isSubstitutionStart(token) {
  return /^(\$\(|`|\()/.test(token);
}

// Index of git when it is the command being run (not an argument), plus the
// VAR=value assignments that prefix it.
function findGitCommand(tokens) {
  const assignments = [];
  let commandPosition = true;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if ((commandPosition || isSubstitutionStart(token)) && isGitToken(token)) return { index: i, assignments };
    if (!commandPosition) continue;
    if (ENV_ASSIGNMENT.test(token)) { assignments.push(token); continue; }
    if (COMMAND_PREFIXES.has(token) || token.startsWith('-')) continue;
    commandPosition = false;
  }
  return { index: -1, assignments };
}

// git config writes to core.hooksPath: `git config [--scope] core.hooksPath <value>`,
// --unset/--add/--replace-all, or the newer `git config set|unset core.hooksPath`.
function isHooksPathConfigWrite(args) {
  const keyIndex = args.findIndex((arg) => arg.toLowerCase() === HOOKS_PATH_CONFIG_KEY);
  if (keyIndex < 0) return false;
  if (args.some((arg) => CONFIG_WRITE_FLAGS.has(arg))) return true;
  const firstPositional = args.find((arg) => !arg.startsWith('-'));
  if (CONFIG_WRITE_VERBS.has(firstPositional)) return true;
  return args.slice(keyIndex + 1).some((arg) => !arg.startsWith('-'));
}

// Returns { subcommand, hooksPathOverride, args, assignments }, { configWrite }
// for a core.hooksPath write, or null when not a hooked git call.
function analyzeSegment(tokens) {
  const found = findGitCommand(tokens);
  let i = found.index;
  if (i < 0) return null;
  let hooksPathOverride = false;
  let subcommand = null;
  for (i += 1; i < tokens.length; i++) {
    const token = tokens[i];
    const lowered = token.toLowerCase();
    if (token === '-c') {
      if ((tokens[i + 1] || '').toLowerCase().startsWith(HOOKS_PATH_KEY)) hooksPathOverride = true;
      i++;
      continue;
    }
    if (lowered.startsWith('-c' + HOOKS_PATH_KEY)) { hooksPathOverride = true; continue; }
    if (GIT_GLOBAL_FLAGS_WITH_VALUE.has(token)) { i++; continue; }
    if (token.startsWith('-')) continue;
    subcommand = token;
    break;
  }
  const args = tokens.slice(i + 1);
  if (subcommand === 'config') return isHooksPathConfigWrite(args) ? { configWrite: true } : null;
  if (!subcommand || !HOOKED_SUBCOMMANDS.has(subcommand)) return null;
  return { subcommand, hooksPathOverride, args, assignments: found.assignments };
}

// git accepts any unambiguous prefix of a long option; --no-v.. is unambiguous.
function isNoVerifyLong(token) {
  return token.length >= '--no-v'.length && '--no-verify'.startsWith(token);
}

function commitClusterHasN(cluster) {
  for (const option of cluster) {
    if (option === 'n') return true;
    if (COMMIT_SHORT_WITH_VALUE.includes(option)) return false;
  }
  return false;
}

function hasNoVerify(subcommand, args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') return false;
    if (isNoVerifyLong(arg)) return true;
    if (subcommand !== 'commit') continue;
    if (COMMIT_OPTIONS_WITH_VALUE.has(arg)) { i++; continue; }
    if (arg.startsWith('--') || !arg.startsWith('-') || arg.length < 2) continue;
    if (commitClusterHasN(arg.slice(1))) return true;
  }
  return false;
}

// `export HUSKY=0` or a bare `HUSKY=0` segment disables husky for later commands.
function exportsHuskyBypass(tokens) {
  const words = tokens[0] === 'export' ? tokens.slice(1) : tokens;
  return words.length > 0 && words.every((word) => ENV_ASSIGNMENT.test(word)) && words.some((word) => HUSKY_BYPASS.test(word));
}

/**
 * Why a Bash command bypasses git hooks, or null when it does not. Only real
 * invocations count: git in command position, heredoc bodies dropped.
 *
 * @param {string} command the shell command
 * @returns {string | null} a one-sentence reason
 */
export function findBypass(command) {
  if (typeof command !== 'string' || !command.includes('git')) return null;
  let huskyExported = false;
  for (const segment of splitSegments(stripHeredocs(command))) {
    const tokens = tokenize(segment);
    if (exportsHuskyBypass(tokens)) { huskyExported = true; continue; }
    const info = analyzeSegment(tokens);
    if (!info) continue;
    if (info.configWrite) return 'Changing core.hooksPath with git config is not allowed.';
    const name = `git ${info.subcommand}`;
    if (info.hooksPathOverride) return `Overriding core.hooksPath is not allowed with ${name}.`;
    if (hasNoVerify(info.subcommand, info.args)) return `--no-verify (or -n) is not allowed with ${name}.`;
    if (huskyExported || info.assignments.some((word) => HUSKY_BYPASS.test(word))) {
      return `Disabling husky (HUSKY=0) is not allowed around ${name}.`;
    }
  }
  return null;
}

/** The denial text shown for a reason from findBypass. */
export function bypassDenial(reason) {
  return `OPM rule ${RULE_NAME} blocked this command: ${reason} Git hooks must not be ` +
    'bypassed. Fix the failing hook instead: run it, read what it reports, fix the code.';
}

// ---------------------------------------------------------------------------
// Config protection: edits that loosen linter, formatter, typecheck or hook
// settings.
// ---------------------------------------------------------------------------

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
const GIT_CONFIG_FILE = /(^|[\\/])\.git[\\/]config$/;
const HOOKS_PATH_LINE = /^\s*hookspath\s*=.*$/gim;

const basename = (filePath) => filePath.split(/[\\/]/).pop();

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

// Apply the proposed Write/Edit/MultiEdit to the current file content.
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

function hooksPathLines(gitConfig) {
  return (gitConfig.match(HOOKS_PATH_LINE) || []).map((line) => line.trim()).join('\n');
}

/**
 * Whether the file needs looking at before configEditKind can judge it, and
 * how: 'content' (read it), 'exists' (check it is there) or null (not a
 * protected file; configEditKind answers null without file facts).
 *
 * @param {unknown} filePath
 * @returns {'content' | 'exists' | null}
 */
export function configLookup(filePath) {
  if (typeof filePath !== 'string' || !filePath) return null;
  if (GIT_CONFIG_FILE.test(filePath) || PYPROJECT.test(basename(filePath))) return 'content';
  if (HUSKY_DIR.test(filePath) || PROTECTED_BASENAMES.some((pattern) => pattern.test(basename(filePath)))) return 'exists';
  return null;
}

/**
 * What kind of protected config an edit touches, or null when it may go
 * ahead. A config that does not exist yet is always allowed.
 *
 * @param {string} toolName 'Edit', 'Write' or 'MultiEdit'
 * @param {object} toolInput the tool's input (file_path and the edit)
 * @param {{ exists: boolean, content: string | null }} file the file as it is now
 * @returns {string | null}
 */
export function configEditKind(toolName, toolInput, file) {
  const filePath = toolInput && toolInput.file_path;
  if (configLookup(filePath) === null) return null;
  if (GIT_CONFIG_FILE.test(filePath)) {
    const existing = file.content || '';
    const isHooksPathChanged = hooksPathLines(existing) !== hooksPathLines(simulateEdit(toolName, toolInput, existing));
    return isHooksPathChanged ? 'git config core.hooksPath setting' : null;
  }
  if (HUSKY_DIR.test(filePath)) return file.exists ? 'git hook script' : null;
  if (PYPROJECT.test(basename(filePath))) {
    if (file.content === null) return null;
    const isLintChanged = lintSections(file.content) !== lintSections(simulateEdit(toolName, toolInput, file.content));
    return isLintChanged ? '[tool.ruff]/[tool.mypy] config' : null;
  }
  return file.exists ? 'linter/formatter/typecheck config' : null;
}

/** The question shown before a protected config edit goes ahead. */
export function configAskReason(filePath, kind) {
  return `OPM: ${basename(filePath)} is a ${kind}. Agents often loosen these to make ` +
    'checks pass instead of fixing the code. Approve only if this config change is ' +
    'genuinely intended (or set OPM_ALLOW_CONFIG_EDITS=1 to skip this prompt).';
}

// Adapted from affaan-m/ecc (MIT)
