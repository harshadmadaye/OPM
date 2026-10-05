'use strict';
// OPM PreToolUse hook (matcher: Bash).
// Denies git commands that bypass commit/push hooks: --no-verify (and -n on
// commit), -c core.hooksPath=<anything>, git config writes to core.hooksPath,
// and HUSKY=0 style env bypasses. Only real invocations count: git must sit in
// command position, and heredoc bodies, echo/printf arguments and quoted
// strings that merely mention these words pass. See docs/threat-model.md.
// Everything else is allowed silently. Never throws; exits 0 on internal error.

if (process.env.OPM_HOOKS_DISABLED === '1') process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const HOOKED_SUBCOMMANDS = new Set(['commit', 'push', 'merge', 'cherry-pick', 'rebase', 'am']);
const GIT_GLOBAL_FLAGS_WITH_VALUE = new Set(['-C', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const COMMIT_OPTIONS_WITH_VALUE = new Set([
  '-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message',
  '-t', '--template', '--author', '--date', '--fixup', '--squash', '--pathspec-from-file',
]);
// Inside a short-option cluster these swallow the rest of the token as their value
// (`-mn` is a message "n"), and `-u`/`-S` take an optional glued value (`-uno`).
const COMMIT_SHORT_WITH_VALUE = 'mFCctuS';
const RULE_NAME = 'no-hook-bypass';
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

function findBypass(command) {
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

function deny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `OPM rule ${RULE_NAME} blocked this command: ${reason} Git hooks must not be ` +
        'bypassed. Fix the failing hook instead: run it, read what it reports, fix the code.',
    },
  };
  process.stdout.write(JSON.stringify(output) + '\n');
}

readStdin((raw) => {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    const command = input && input.tool_input && input.tool_input.command;
    if (typeof command !== 'string' || !command.includes('git')) return;
    const reason = findBypass(command);
    if (reason) deny(reason);
  } catch {
    // Malformed input or internal error: never block the user.
  }
});

// Adapted from affaan-m/ecc (MIT)
