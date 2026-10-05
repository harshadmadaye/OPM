// Destructive-command hold: a tool.call hook on Bash that pauses `rm -rf` on
// root-like or out-of-repo paths, a force-push to main or master, and
// `git reset --hard`, and asks the user before it runs. Nobody to answer (a
// dismissed question, `claude -p`) means a deny with a reason Claude can act
// on; a failure of the guard itself also denies. OPM_GUARD=off turns it off.
// A drift guard, not a security boundary: see docs/threat-model.md.
//
// The command parsing follows hooks/scripts/block-no-verify.js (a command
// counts only in command position; heredoc bodies are dropped), ported here
// because a hooks module cannot load CommonJS files or Node APIs.

const RUN_IT = 'Run it';
const CANCEL = 'Cancel';
const MAX_SHOWN_COMMAND = 200;
const PROTECTED_BRANCHES = new Set(['main', 'master']);
const SAFE = Object.freeze({ isRisky: false, reason: null });

// Words that may precede the real command name in a simple command.
const COMMAND_PREFIXES = new Set([
  'env', 'command', 'exec', 'sudo', 'time', 'nohup', 'builtin',
  'if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '(',
]);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const GIT_GLOBAL_FLAGS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const PUSH_OPTIONS_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);
const PUSH_SHORT_FLAGS = /^-[fuqvn46d]+$/;
const FORCE_LONG = /^--force(-with-lease(=.*)?)?$/;
const HOME_TARGET = /^(~|\$HOME|\$\{HOME\})(\/|$)/;
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

const commandBase = (token) => token.split('/').pop().toLowerCase();

// The command being run and its arguments, past assignments and prefixes.
function findCommand(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (ENV_ASSIGNMENT.test(token) || COMMAND_PREFIXES.has(token) || token.startsWith('-')) continue;
    return { name: commandBase(token), args: tokens.slice(i + 1) };
  }
  return null;
}

// An absolute path with . and .. resolved; never climbs above "/".
function normalizePath(path) {
  const parts = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

const isStrictlyInside = (path, root) => root !== '/' && path.startsWith(`${normalizePath(root)}/`);

// A target is root-like when it names home, or when the folder it removes (or
// the folder a trailing * empties) is the repo root or lies outside it.
function isRootLikeTarget(target, repoRoot, cwd) {
  if (HOME_TARGET.test(target)) return true;
  const withoutGlob = target.replace(/(^|\/)\*$/, '$1.');
  const absolute = withoutGlob.startsWith('/') ? withoutGlob : `${cwd}/${withoutGlob}`;
  return !isStrictlyInside(normalizePath(absolute), repoRoot);
}

function rmReason(args, repoRoot, cwd) {
  let isRecursive = false;
  let isForced = false;
  const targets = [];
  let isPastOptions = false;
  for (const arg of args) {
    if (isPastOptions || !arg.startsWith('-') || arg === '-') { targets.push(arg); continue; }
    if (arg === '--') { isPastOptions = true; continue; }
    if (arg === '--recursive') isRecursive = true;
    else if (arg === '--force') isForced = true;
    else if (!arg.startsWith('--')) {
      if (/[rR]/.test(arg)) isRecursive = true;
      if (arg.includes('f')) isForced = true;
    }
  }
  if (!isRecursive || !isForced) return null;
  const target = targets.find((path) => isRootLikeTarget(path, repoRoot, cwd));
  return target === undefined ? null : `rm -rf on ${target}`;
}

// The branch a refspec writes to: the part after ":", without refs/heads/.
function refspecDestination(refspec) {
  const destination = refspec.replace(/^\+/, '').split(':').pop();
  return destination.replace(/^refs\/heads\//, '');
}

function pushReason(args) {
  let isForced = false;
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (PUSH_OPTIONS_WITH_VALUE.has(arg)) { i++; continue; }
    if (FORCE_LONG.test(arg) || (PUSH_SHORT_FLAGS.test(arg) && arg.includes('f'))) { isForced = true; continue; }
    if (!arg.startsWith('-')) positionals.push(arg);
  }
  const refspecs = positionals.slice(1);
  const forcedRefspecs = isForced ? refspecs : refspecs.filter((refspec) => refspec.startsWith('+'));
  const branch = forcedRefspecs.map(refspecDestination).find((name) => PROTECTED_BRANCHES.has(name));
  if (branch) return `force-push to ${branch}`;
  return isForced && refspecs.length === 0 ? 'force-push with no branch named' : null;
}

function gitReason(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) i += GIT_GLOBAL_FLAGS_WITH_VALUE.has(args[i]) ? 2 : 1;
  const subcommand = args[i];
  const rest = args.slice(i + 1);
  if (subcommand === 'push') return pushReason(rest);
  if (subcommand === 'reset' && rest.includes('--hard')) return 'git reset --hard';
  return null;
}

/**
 * Whether a Bash command is destructive enough to hold, and why. Pure: reads
 * nothing but its arguments.
 *
 * @param {string} command the shell command
 * @param {string} repoRoot the session's project root, absolute
 * @param {string} [cwd] the directory relative paths resolve against
 * @returns {{ isRisky: boolean, reason: string | null }}
 */
export function classify(command, repoRoot, cwd = repoRoot) {
  if (typeof command !== 'string') throw new TypeError('classify: command must be a string');
  for (const segment of splitSegments(stripHeredocs(command))) {
    const found = findCommand(tokenize(segment));
    if (!found) continue;
    const reason = found.name === 'rm' ? rmReason(found.args, repoRoot, cwd)
      : found.name === 'git' ? gitReason(found.args)
        : null;
    if (reason) return { isRisky: true, reason };
  }
  return SAFE;
}

const errorText = (error) => (error && error.message ? error.message : String(error));

const shownCommand = (command) =>
  command.length > MAX_SHOWN_COMMAND ? `${command.slice(0, MAX_SHOWN_COMMAND)}...` : command;

const heldDenial = (reason) =>
  `OPM held this command (${reason}) and nobody approved it. Ask the user before trying another way. See docs/threat-model.md.`;

export function installGuard(on) {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if ((await $.env.get('OPM_GUARD')) === 'off') return next(e);
    const { isRisky, reason } = classify(e.command, await $.session.root(), await $.session.cwd());
    if (!isRisky) return next(e);
    let answer = null;
    try {
      answer = await $.ui.ask(`OPM held: ${reason}. Run \`${shownCommand(e.command)}\`?`, [RUN_IT, CANCEL]);
    } catch (error) {
      $.ui.log(`opm: guard question not answered: ${errorText(error)}`, { to: 'debug' });
    }
    return answer === RUN_IT ? next(e) : { deny: heldDenial(reason) };
  }).catch((_$, _e, next) => ({
    deny: `OPM guard failed (${next.error.kind}) and denied this command to be safe. Retry it; if it fails again, ask the user (OPM_GUARD=off disables the guard).`,
  }));
}
