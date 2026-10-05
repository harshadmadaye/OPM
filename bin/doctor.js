'use strict';
// `npx opm-core doctor` — checks the health of an OPM install from outside a
// Claude Code session. Read-only and offline: it never calls the network and
// only writes what the replayed hooks themselves write for a throwaway session.

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { STAMP_FILE, PACKAGE_VERSION } = require('./install');

const MIN_NODE_MAJOR = 18;
const PLUGIN_ID = 'opm@opm';
const PROBE_TIMEOUT_MS = 10000;
const DEFAULT_HOOK_TIMEOUT_S = 60;
const MS_PER_SECOND = 1000;
const IS_WINDOWS = process.platform === 'win32';
const RULES_FIX = 'npx opm-core --rules-only';
const CLAUDE_VERSION_SUFFIX = /\s*\(Claude Code\)$/;
const HOOK_SCRIPT = /node\s+"([^"]+)"/;
const STACKS = [
  { id: 'typescript', markers: ['tsconfig.json'], tool: 'tsc', localBin: true },
  { id: 'python', markers: ['pyproject.toml', 'requirements.txt'], tool: 'ruff' },
  { id: 'dart', markers: ['pubspec.yaml'], tool: 'dart' },
];

const DOCTOR_USAGE = `opm-core doctor — check the health of your OPM install

  npx opm-core doctor [target repo] [--verbose]

Checks Node, the claude CLI and plugin registration, rule freshness, the tools
the Stop hook needs, and replays each hook on a synthetic payload. Exits 1 when
any check fails; warnings exit 0. Makes no network calls.`;

const row = (id, status, message, fix = '') => ({ id, status, message, fix });

function defaultRun(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: PROBE_TIMEOUT_MS, shell: IS_WINDOWS, ...options });
  return {
    status: result.status,
    out: `${result.stdout || ''}${result.stderr || ''}`.trim(),
    timedOut: Boolean(result.error && result.error.code === 'ETIMEDOUT'),
  };
}

function defaultEnv(target) {
  return {
    target,
    nodeVersion: process.versions.node,
    packageVersion: PACKAGE_VERSION,
    packageRoot: path.resolve(__dirname, '..'),
    execPath: process.execPath,
    processEnv: process.env,
    run: defaultRun,
    fs,
  };
}

// Runs fn once per env and remembers the answer, so the header and the checks share one probe.
function cached(env, key, fn) {
  env.cache = env.cache || {};
  if (!(key in env.cache)) env.cache[key] = fn();
  return env.cache[key];
}

function claudeVersion(env) {
  return cached(env, 'claudeVersion', () => {
    const result = env.run('claude', ['--version']);
    if (result.status !== 0 || !result.out) return null;
    return result.out.split('\n')[0].replace(CLAUDE_VERSION_SUFFIX, '');
  });
}

// The opm entry from `claude plugin list`, or null. Prefers --json for the install path.
function installedPlugin(env) {
  return cached(env, 'plugin', () => {
    const json = env.run('claude', ['plugin', 'list', '--json']);
    if (json.status === 0) {
      try {
        const entry = JSON.parse(json.out).find((plugin) => plugin.id === PLUGIN_ID);
        return entry ? { version: entry.version, installPath: entry.installPath } : null;
      } catch { /* older CLI without --json: fall through to the text listing */ }
    }
    const text = env.run('claude', ['plugin', 'list']);
    return text.status === 0 && text.out.includes(PLUGIN_ID) ? { version: null, installPath: null } : null;
  });
}

function checkNode(env) {
  const major = Number(String(env.nodeVersion).split('.')[0]);
  if (major >= MIN_NODE_MAJOR) return row('node', 'pass', `Node ${env.nodeVersion}`);
  return row('node', 'fail', `Node ${env.nodeVersion} is too old; OPM needs Node ${MIN_NODE_MAJOR} or newer`,
    `install Node ${MIN_NODE_MAJOR}+ from https://nodejs.org`);
}

function checkClaude(env) {
  const version = claudeVersion(env);
  if (version) return row('claude-cli', 'pass', `claude CLI found: ${version}`);
  return row('claude-cli', 'warn', 'claude CLI not found on PATH', 'install Claude Code from https://claude.com/claude-code');
}

function checkPlugin(env) {
  if (!claudeVersion(env)) {
    return row('plugin', 'warn', 'cannot check plugin registration without the claude CLI', 'install Claude Code, then rerun doctor');
  }
  const plugin = installedPlugin(env);
  if (!plugin) return row('plugin', 'warn', `${PLUGIN_ID} is not registered with Claude Code`, 'npx opm-core --plugin-only');
  return row('plugin', 'pass', `${PLUGIN_ID} registered${plugin.version ? ` (${plugin.version})` : ''}`);
}

function readStamp(env, rulesDir) {
  const stampPath = path.join(rulesDir, STAMP_FILE);
  if (!env.fs.existsSync(stampPath)) return null;
  try {
    return JSON.parse(env.fs.readFileSync(stampPath, 'utf8'));
  } catch {
    return { invalid: true };
  }
}

function changedRuleFiles(env, rulesDir, files) {
  return Object.entries(files || {}).filter(([rel, hash]) => {
    const filePath = path.join(rulesDir, rel);
    if (!env.fs.existsSync(filePath)) return true;
    return crypto.createHash('sha256').update(env.fs.readFileSync(filePath)).digest('hex') !== hash;
  }).map(([rel]) => rel);
}

function checkRules(env) {
  const rulesDir = path.join(env.target, '.claude', 'rules', 'opm');
  const stamp = readStamp(env, rulesDir);
  if (!stamp) return [row('rules', 'warn', `no OPM rules stamp in ${rulesDir}`, RULES_FIX)];
  if (stamp.invalid) return [row('rules', 'warn', `the rules stamp ${STAMP_FILE} is not valid JSON`, RULES_FIX)];
  const rows = [row('rules', 'pass', `rules stamp found (${(stamp.ruleSets || []).join(', ')})`)];
  if (stamp.version === env.packageVersion) rows.push(row('rules-version', 'pass', `rules match OPM ${env.packageVersion}`));
  else rows.push(row('rules-version', 'warn', `rules came from OPM ${stamp.version}, this is ${env.packageVersion}`, RULES_FIX));
  const changed = changedRuleFiles(env, rulesDir, stamp.files);
  if (changed.length === 0) rows.push(row('rules-edited', 'pass', 'rule files unchanged since install'));
  else rows.push(row('rules-edited', 'warn', `rule files changed since install: ${changed.join(', ')}`, RULES_FIX));
  return rows;
}

function toolFound(env, stack) {
  if (stack.localBin) {
    const local = path.join(env.target, 'node_modules', '.bin', IS_WINDOWS ? `${stack.tool}.cmd` : stack.tool);
    if (env.fs.existsSync(local)) return true;
  }
  return env.run(stack.tool, ['--version']).status === 0;
}

function checkTools(env) {
  const detected = STACKS.filter((stack) => stack.markers.some((m) => env.fs.existsSync(path.join(env.target, m))));
  if (detected.length === 0) return [row('tools', 'pass', 'no TypeScript, Python or Dart project detected; no tools needed')];
  return detected.map((stack) => (toolFound(env, stack)
    ? row(`tool-${stack.tool}`, 'pass', `${stack.tool} found for ${stack.id}`)
    : row(`tool-${stack.tool}`, 'warn', `${stack.tool} not found; the Stop hook skips ${stack.id} checks`,
      `install ${stack.tool} and put it on your PATH`)));
}

// Where to replay hooks from: the installed plugin when Claude Code knows it, else this package.
function hookRoot(env) {
  const hasHooks = (root) => root && env.fs.existsSync(path.join(root, 'hooks', 'hooks.json'));
  const plugin = claudeVersion(env) ? installedPlugin(env) : null;
  if (plugin && hasHooks(plugin.installPath)) return { root: plugin.installPath, source: 'installed plugin' };
  if (hasHooks(env.packageRoot)) return { root: env.packageRoot, source: 'this package' };
  return null;
}

function listHooks(root, hooksJson) {
  const hooks = [];
  for (const [event, groups] of Object.entries(hooksJson.hooks || {})) {
    for (const group of groups) {
      for (const hook of group.hooks || []) {
        if (hook.type !== 'command') continue;
        const match = String(hook.command).replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, root).match(HOOK_SCRIPT);
        if (match) hooks.push({ event, matcher: group.matcher || '', script: path.normalize(match[1]), timeoutS: hook.timeout || DEFAULT_HOOK_TIMEOUT_S });
      }
    }
  }
  return hooks;
}

// A minimal payload of the shape Claude Code sends; the throwaway session id keeps replay isolated.
function syntheticPayload(hook, target, sessionId) {
  const toolName = hook.matcher.split('|')[0];
  const payload = { session_id: sessionId, cwd: target, hook_event_name: hook.event };
  if (hook.event === 'PreToolUse' || hook.event === 'PostToolUse') {
    payload.tool_name = toolName;
    payload.tool_input = toolName === 'Bash' ? { command: 'git status' } : {};
  }
  if (hook.event === 'SessionStart') payload.source = 'startup';
  if (hook.event === 'Stop') payload.stop_hook_active = false;
  return payload;
}

function replayHook(env, hook, root, sessionId) {
  const name = path.basename(hook.script);
  const childEnv = { ...env.processEnv, CLAUDE_PLUGIN_ROOT: root };
  delete childEnv.OPM_HOOKS_DISABLED;
  const result = env.run(env.execPath, [hook.script], {
    input: JSON.stringify(syntheticPayload(hook, env.target, sessionId)),
    env: childEnv,
    cwd: env.target,
    timeout: hook.timeoutS * MS_PER_SECOND,
    shell: false,
  });
  const id = `hook-${name.replace(/\.js$/, '')}`;
  if (result.status === 0) return row(id, 'pass', `${hook.event} hook ${name} replayed`);
  const why = result.timedOut ? `timed out after ${hook.timeoutS}s` : `exited ${result.status}`;
  return row(id, 'fail', `${hook.event} hook ${name} ${why}`, `run OPM_HOOKS_DISABLED=1 to bypass, and report it at https://github.com/harshadmadaye/OPM/issues`);
}

function checkHooks(env) {
  const located = hookRoot(env);
  if (!located) {
    return [row('hooks', 'warn', 'could not find the OPM hooks to replay', 'npx opm-core --plugin-only, then rerun doctor')];
  }
  const hooksJson = JSON.parse(env.fs.readFileSync(path.join(located.root, 'hooks', 'hooks.json'), 'utf8'));
  const sessionId = `opm-doctor-${crypto.randomBytes(6).toString('hex')}`;
  const rows = [row('hooks', 'pass', `replaying hooks from ${located.source}: ${located.root}`)];
  for (const hook of listHooks(located.root, hooksJson)) rows.push(replayHook(env, hook, located.root, sessionId));
  return rows;
}

const CHECKS = [checkNode, checkClaude, checkPlugin, checkRules, checkTools, checkHooks];

function runChecks(env) {
  return CHECKS.flatMap((check) => {
    try {
      return [].concat(check(env));
    } catch (error) {
      const detail = env.verbose ? `\n${error.stack}` : '';
      const id = check.name.replace(/^check/, '').toLowerCase();
      return [row(id, 'fail', `check crashed: ${error.message}${detail}`, 'rerun with --verbose for details')];
    }
  });
}

const LABELS = { pass: '\u001b[32mPASS\u001b[0m', warn: '\u001b[33mWARN\u001b[0m', fail: '\u001b[31mFAIL\u001b[0m' };

function formatReport(env, rows) {
  const lines = [
    `OPM ${env.packageVersion} · Node ${env.nodeVersion} · Claude Code ${claudeVersion(env) || 'not found'}`,
    '',
  ];
  for (const r of rows) {
    lines.push(`  ${LABELS[r.status]}  ${r.message}`);
    if (r.status !== 'pass' && r.fix) lines.push(`        fix: ${r.fix}`);
  }
  const count = (status) => rows.filter((r) => r.status === status).length;
  const warnings = count('warn');
  lines.push('', `${count('pass')} passed, ${warnings} warning${warnings === 1 ? '' : 's'}, ${count('fail')} failed`);
  return lines.join('\n');
}

function exitCode(rows) {
  return rows.some((r) => r.status === 'fail') ? 1 : 0;
}

function parseDoctorArgs(argv) {
  const options = { help: false, verbose: false, target: process.cwd() };
  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg.startsWith('-')) throw new Error(`unknown doctor option: ${arg}`);
    else options.target = path.resolve(arg);
  }
  return options;
}

async function main(argv, env) {
  const options = parseDoctorArgs(argv);
  if (options.help) { console.log(DOCTOR_USAGE); return 0; }
  if (!fs.existsSync(options.target)) throw new Error(`target is not a directory: ${options.target}`);
  const doctorEnv = env || { ...defaultEnv(options.target), verbose: options.verbose };
  const rows = runChecks(doctorEnv);
  console.log(formatReport(doctorEnv, rows));
  return exitCode(rows);
}

module.exports = {
  runChecks, formatReport, exitCode, parseDoctorArgs, listHooks, syntheticPayload, defaultEnv, main, DOCTOR_USAGE,
};
