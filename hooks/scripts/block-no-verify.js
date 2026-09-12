'use strict';
// OPM PreToolUse hook (matcher: Bash).
// Denies git commands that bypass commit/push hooks: --no-verify (and -n on
// commit), -c core.hooksPath=<anything>, and HUSKY=0 style env bypasses.
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
const HOOKS_PATH_KEY = 'core.hookspath=';
const HUSKY_BYPASS = /(^|[\s;&|(])(HUSKY=(0|false)|HUSKY_SKIP_HOOKS=(1|true))(?=$|[\s;&|)])/;

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

// Returns { subcommand, hooksPathOverride, args } or null when not a hooked git call.
function analyzeSegment(tokens) {
  let i = tokens.findIndex(isGitToken);
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
  if (!subcommand || !HOOKED_SUBCOMMANDS.has(subcommand)) return null;
  return { subcommand, hooksPathOverride, args: tokens.slice(i + 1) };
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

function findBypass(command) {
  const huskyBypass = HUSKY_BYPASS.test(command);
  for (const segment of splitSegments(command)) {
    const info = analyzeSegment(tokenize(segment));
    if (!info) continue;
    const name = `git ${info.subcommand}`;
    if (info.hooksPathOverride) return `Overriding core.hooksPath is not allowed with ${name}.`;
    if (hasNoVerify(info.subcommand, info.args)) return `--no-verify is not allowed with ${name}.`;
    if (huskyBypass) return `Disabling husky (HUSKY=0) is not allowed around ${name}.`;
  }
  return null;
}

function deny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `OPM blocked this command: ${reason} Git hooks must not be bypassed; ` +
        'fix whatever the hook reports instead.',
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
