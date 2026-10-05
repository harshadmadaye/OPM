'use strict';
// Tests for `opm-core doctor`. Run with: node --test tests/doctor.test.js
// The process runner and fs are stubbed: nothing here spawns Claude Code, a
// hook, or a tool, and nothing reaches the network or a real repo.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const DOCTOR = path.resolve(__dirname, '..', 'bin', 'doctor.js');
const INSTALL = path.resolve(__dirname, '..', 'bin', 'install.js');
const { runChecks, exitCode, formatReport, main } = require(DOCTOR);

const TARGET = path.resolve('/repo');
const PLUGIN_ROOT = path.resolve('/plugins/opm/0.7.0');
const PACKAGE_ROOT = path.resolve('/pkg');
const RULES_DIR = path.join(TARGET, '.claude', 'rules', 'opm');
const VERSION = '0.7.0';
const CLAUDE_CODE = { tested: '2.1.273 - 2.1.289', modsMin: '2.1.287' };
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

const HOOKS_JSON = JSON.stringify({
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/block.js"', timeout: 5 }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/stop.js"', timeout: 90 }] }],
  },
});

function fakeFs(files) {
  const has = (p) => p in files || Object.keys(files).some((f) => f.startsWith(p + path.sep));
  return {
    existsSync: has,
    readFileSync: (p) => {
      if (!(p in files)) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
      return files[p];
    },
  };
}

function healthyFiles() {
  const rule = '# rule\n';
  return {
    [path.join(RULES_DIR, '.opm-version')]: JSON.stringify({
      version: VERSION, ruleSets: ['common'], installedAt: '2026-10-05T00:00:00.000Z', files: { 'common/a.md': sha(rule) },
    }),
    [path.join(RULES_DIR, 'common', 'a.md')]: rule,
    [path.join(PLUGIN_ROOT, 'hooks', 'hooks.json')]: HOOKS_JSON,
  };
}

// A runner that answers like a healthy machine, with per-call overrides.
function fakeRun(overrides = {}) {
  const calls = [];
  const run = (cmd, args, options) => {
    calls.push({ cmd, args, options });
    const key = [path.basename(cmd), ...args.map((a) => path.basename(a))].join(' ');
    if (key in overrides) return overrides[key];
    if (key === 'claude --version') return { status: 0, out: '2.1.289 (Claude Code)' };
    if (key === 'claude plugin list --json') {
      return { status: 0, out: JSON.stringify([{ id: 'opm@opm', version: VERSION, installPath: PLUGIN_ROOT }]) };
    }
    if (cmd === 'node-bin') return { status: 0, out: '' };
    return { status: 0, out: 'ok' };
  };
  run.calls = calls;
  return run;
}

function makeEnv({ files = healthyFiles(), run = fakeRun(), nodeVersion = '22.1.0' } = {}) {
  return {
    target: TARGET, nodeVersion, packageVersion: VERSION, packageRoot: PACKAGE_ROOT, claudeCode: CLAUDE_CODE,
    execPath: 'node-bin', processEnv: { OPM_HOOKS_DISABLED: '1', PATH: '/bin' }, run, fs: fakeFs(files),
  };
}

const byId = (rows, id) => rows.find((r) => r.id === id);

test('a healthy install passes every check and exits 0', () => {
  const rows = runChecks(makeEnv());
  assert.deepEqual(rows.filter((r) => r.status !== 'pass'), []);
  assert.equal(exitCode(rows), 0);
  for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['fix', 'id', 'message', 'status']);
});

test('node below 18 fails and makes the exit code 1', () => {
  const rows = runChecks(makeEnv({ nodeVersion: '16.20.0' }));
  assert.equal(byId(rows, 'node').status, 'fail');
  assert.ok(byId(rows, 'node').fix);
  assert.equal(exitCode(rows), 1);
});

test('a missing claude CLI warns for the CLI and the plugin, and hooks fall back to this package', () => {
  const files = { ...healthyFiles(), [path.join(PACKAGE_ROOT, 'hooks', 'hooks.json')]: HOOKS_JSON };
  const run = fakeRun({ 'claude --version': { status: null, out: '' } });
  const rows = runChecks(makeEnv({ files, run }));
  assert.equal(byId(rows, 'claude-cli').status, 'warn');
  assert.equal(byId(rows, 'plugin').status, 'warn');
  assert.match(byId(rows, 'hooks').message, /this package/);
  assert.equal(exitCode(rows), 0, 'warnings alone exit 0');
});

test('an unregistered plugin warns with the install fix', () => {
  const run = fakeRun({ 'claude plugin list --json': { status: 0, out: '[]' } });
  const files = { ...healthyFiles(), [path.join(PACKAGE_ROOT, 'hooks', 'hooks.json')]: HOOKS_JSON };
  const plugin = byId(runChecks(makeEnv({ run, files })), 'plugin');
  assert.equal(plugin.status, 'warn');
  assert.match(plugin.fix, /npx opm-core/);
});

test('the plugin check falls back to the text listing on an older CLI', () => {
  const run = fakeRun({
    'claude plugin list --json': { status: 1, out: 'unknown option --json' },
    'claude plugin list': { status: 0, out: 'Installed plugins:\n  ❯ opm@opm\n    Version: 0.7.0' },
  });
  const files = { ...healthyFiles(), [path.join(PACKAGE_ROOT, 'hooks', 'hooks.json')]: HOOKS_JSON };
  assert.equal(byId(runChecks(makeEnv({ run, files })), 'plugin').status, 'pass');
});

test('a missing rules stamp warns with the rules-only fix', () => {
  const files = healthyFiles();
  delete files[path.join(RULES_DIR, '.opm-version')];
  const rules = byId(runChecks(makeEnv({ files })), 'rules');
  assert.equal(rules.status, 'warn');
  assert.equal(rules.fix, 'npx opm-core --rules-only');
});

test('rules from an older version warn', () => {
  const files = healthyFiles();
  const stampPath = path.join(RULES_DIR, '.opm-version');
  files[stampPath] = JSON.stringify({ ...JSON.parse(files[stampPath]), version: '0.6.1' });
  const row = byId(runChecks(makeEnv({ files })), 'rules-version');
  assert.equal(row.status, 'warn');
  assert.match(row.message, /0\.6\.1/);
});

test('a rule edited after install warns, naming the file and the fix', () => {
  const files = healthyFiles();
  files[path.join(RULES_DIR, 'common', 'a.md')] = '# edited\n';
  const row = byId(runChecks(makeEnv({ files })), 'rules-edited');
  assert.equal(row.status, 'warn');
  assert.match(row.message, /common\/a\.md/);
  assert.equal(row.fix, 'npx opm-core --rules-only');
  assert.match(formatReport(makeEnv({ files }), runChecks(makeEnv({ files }))), /fix: npx opm-core --rules-only/);
});

test('tools are checked only for stacks detected in the repo', () => {
  const none = runChecks(makeEnv());
  assert.equal(byId(none, 'tools').status, 'pass');

  const files = { ...healthyFiles(), [path.join(TARGET, 'pyproject.toml')]: '', [path.join(TARGET, 'tsconfig.json')]: '{}' };
  const run = fakeRun({ 'ruff --version': { status: null, out: '' }, 'tsc --version': { status: 0, out: 'Version 5' } });
  const rows = runChecks(makeEnv({ files, run }));
  assert.equal(byId(rows, 'tool-ruff').status, 'warn');
  assert.equal(byId(rows, 'tool-tsc').status, 'pass');
  assert.equal(byId(rows, 'tool-dart'), undefined, 'dart is not probed without a pubspec.yaml');
  assert.ok(!run.calls.some((c) => c.cmd === 'dart'));
});

test('a local node_modules tsc counts for TypeScript', () => {
  const files = {
    ...healthyFiles(),
    [path.join(TARGET, 'tsconfig.json')]: '{}',
    [path.join(TARGET, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')]: '',
  };
  const run = fakeRun({ 'tsc --version': { status: null, out: '' } });
  assert.equal(byId(runChecks(makeEnv({ files, run })), 'tool-tsc').status, 'pass');
});

test('each hook is replayed from the installed plugin with a synthetic payload and hooks enabled', () => {
  const run = fakeRun();
  const rows = runChecks(makeEnv({ run }));
  assert.match(byId(rows, 'hooks').message, /installed plugin/);
  const replays = run.calls.filter((c) => c.cmd === 'node-bin');
  assert.equal(replays.length, 2);
  const [block, stop] = replays;
  assert.equal(block.args[0], path.join(PLUGIN_ROOT, 'hooks', 'scripts', 'block.js'));
  assert.equal(block.options.timeout, 5000);
  assert.equal(stop.options.timeout, 90000);
  assert.equal(block.options.env.OPM_HOOKS_DISABLED, undefined, 'replay runs with hooks enabled');
  assert.equal(block.options.env.CLAUDE_PLUGIN_ROOT, PLUGIN_ROOT);
  const payload = JSON.parse(block.options.input);
  assert.equal(payload.hook_event_name, 'PreToolUse');
  assert.equal(payload.tool_name, 'Bash');
  assert.match(payload.session_id, /^opm-doctor-/);
  assert.equal(byId(rows, 'hook-block').status, 'pass');
  assert.equal(byId(rows, 'hook-stop').status, 'pass');
});

test('a hook that exits non-zero or times out fails', () => {
  const run = fakeRun({
    'node-bin block.js': { status: 2, out: 'boom' },
    'node-bin stop.js': { status: null, out: '', timedOut: true },
  });
  const rows = runChecks(makeEnv({ run }));
  assert.equal(byId(rows, 'hook-block').status, 'fail');
  assert.match(byId(rows, 'hook-block').message, /exited 2/);
  assert.equal(byId(rows, 'hook-stop').status, 'fail');
  assert.match(byId(rows, 'hook-stop').message, /timed out after 90s/);
  assert.equal(exitCode(rows), 1);
});

test('no locatable hooks is a warn row, not a failure', () => {
  const files = healthyFiles();
  delete files[path.join(PLUGIN_ROOT, 'hooks', 'hooks.json')];
  const rows = runChecks(makeEnv({ files }));
  assert.equal(byId(rows, 'hooks').status, 'warn');
  assert.equal(exitCode(rows), 0);
});

test('a crashing check becomes a fail row with its message', () => {
  const files = healthyFiles();
  files[path.join(PLUGIN_ROOT, 'hooks', 'hooks.json')] = '{not json';
  const rows = runChecks(makeEnv({ files }));
  const hooks = byId(rows, 'hooks');
  assert.equal(hooks.status, 'fail');
  assert.match(hooks.message, /^check crashed: /);
  assert.ok(!hooks.message.includes('    at '), 'no stack trace without --verbose');
  assert.equal(exitCode(rows), 1);
});

test('the report has a header, one row per check, fixes under non-pass rows and a summary', () => {
  const env = makeEnv({ nodeVersion: '16.0.0', run: fakeRun({ 'claude --version': { status: null, out: '' } }) });
  const rows = runChecks(env);
  const report = formatReport(env, rows);
  assert.match(report.split('\n')[0], /^OPM 0\.7\.0 · Node 16\.0\.0 · Claude Code not found$/);
  assert.match(report, /FAIL.*Node 16\.0\.0/);
  assert.match(report, /fix: install Node 18\+/);
  assert.match(report, /\d+ passed, \d+ warnings?, 1 failed$/);
});

test('main prints the report and returns the exit code', async () => {
  const printed = [];
  const original = console.log;
  console.log = (line) => printed.push(line);
  try {
    assert.equal(await main([], makeEnv({ nodeVersion: '16.0.0' })), 1);
    assert.equal(await main([], makeEnv()), 0);
  } finally {
    console.log = original;
  }
  assert.match(printed.join('\n'), /Claude Code 2\.1\.289$/m, 'the CLI name suffix is dropped');
});

test('the CLI rejects an unknown doctor option in one line', () => {
  const out = spawnSync(process.execPath, [INSTALL, 'doctor', '--nope'], { encoding: 'utf8' });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /^error: unknown doctor option: --nope$/m);
  assert.ok(!out.stderr.includes('    at '), 'no stack trace');
});

const withCli = (version) => fakeRun({ 'claude --version': { status: 0, out: `${version} (Claude Code)` } });

test('a Claude Code version inside the tested range passes, outside it warns naming the range', () => {
  assert.equal(byId(runChecks(makeEnv({ run: withCli('2.1.273') })), 'claude-range').status, 'pass');
  assert.equal(byId(runChecks(makeEnv({ run: withCli('2.1.289') })), 'claude-range').status, 'pass');
  for (const version of ['2.1.272', '2.1.300', '2.10.0']) {
    const range = byId(runChecks(makeEnv({ run: withCli(version) })), 'claude-range');
    assert.equal(range.status, 'warn', version);
    assert.match(range.message, /tested with 2\.1\.273 - 2\.1\.289/);
  }
});

test('mod features are on from modsMin, and older versions warn about the settings-hook fallback', () => {
  const on = byId(runChecks(makeEnv({ run: withCli('2.1.287') })), 'mods');
  assert.equal(on.status, 'pass');
  assert.equal(on.message, 'mod features on');
  const off = byId(runChecks(makeEnv({ run: withCli('2.1.273') })), 'mods');
  assert.equal(off.status, 'warn');
  assert.match(off.message, /^settings-hook fallback only; update Claude Code for \/opm:status, the destructive-command hold and the meter$/);
  assert.ok(off.fix);
});

test('an unparseable Claude Code version warns instead of guessing', () => {
  const rows = runChecks(makeEnv({ run: withCli('nightly') }));
  assert.equal(byId(rows, 'claude-range').status, 'warn');
  assert.equal(byId(rows, 'mods').status, 'warn');
  assert.equal(exitCode(rows), 0);
});

test('without the claude CLI there are no range or mods rows', () => {
  const files = { ...healthyFiles(), [path.join(PACKAGE_ROOT, 'hooks', 'hooks.json')]: HOOKS_JSON };
  const rows = runChecks(makeEnv({ files, run: fakeRun({ 'claude --version': { status: null, out: '' } }) }));
  assert.equal(byId(rows, 'claude-range'), undefined);
  assert.equal(byId(rows, 'mods'), undefined);
});

test('an installed plugin older than the package warns with the update fix (ISS-006)', () => {
  const plugin = (version) => fakeRun({
    'claude plugin list --json': { status: 0, out: JSON.stringify([{ id: 'opm@opm', version, installPath: PLUGIN_ROOT }]) },
  });
  const behind = byId(runChecks(makeEnv({ run: plugin('0.6.1') })), 'plugin-version');
  assert.equal(behind.status, 'warn');
  assert.match(behind.message, /0\.6\.1.*0\.7\.0/);
  assert.equal(behind.fix, 'claude plugin update opm@opm');
  assert.equal(byId(runChecks(makeEnv({ run: plugin('0.7.0') })), 'plugin-version').status, 'pass');
  assert.equal(byId(runChecks(makeEnv({ run: plugin('0.10.0') })), 'plugin-version').status, 'pass', 'numeric, not string, compare');
});

test('an unknown installed plugin version adds no plugin-version row', () => {
  const run = fakeRun({
    'claude plugin list --json': { status: 1, out: 'unknown option --json' },
    'claude plugin list': { status: 0, out: 'opm@opm' },
  });
  const files = { ...healthyFiles(), [path.join(PACKAGE_ROOT, 'hooks', 'hooks.json')]: HOOKS_JSON };
  assert.equal(byId(runChecks(makeEnv({ run, files })), 'plugin-version'), undefined);
});

test('defaultEnv reads the declared Claude Code range from package.json', () => {
  const { defaultEnv } = require(DOCTOR);
  const pkg = require('../package.json');
  assert.deepEqual(defaultEnv(TARGET).claudeCode, pkg.opm.claudeCode);
});
