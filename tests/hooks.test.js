'use strict';
// Tests for the OPM hook scripts. Run with: node --test tests/hooks.test.js
// Each script is spawned as a real process with crafted stdin JSON, exactly as
// Claude Code would invoke it. TMPDIR is pointed at a per-run temp dir so the
// accumulator files never leak into the real temp directory.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '..', 'hooks', 'scripts');
const SESSION = 'test-session';
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-hooks-test-'));

test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

function runHook(name, input, extraEnv = {}) {
  const env = { ...process.env, TMPDIR: tmpRoot };
  delete env.OPM_HOOKS_DISABLED;
  delete env.OPM_ALLOW_CONFIG_EDITS;
  Object.assign(env, extraEnv);
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, name)], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env,
    timeout: 20000,
  });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function parseOutput(stdout) {
  return JSON.parse(stdout.trim());
}

function bashInput(command) {
  return { session_id: SESSION, tool_name: 'Bash', tool_input: { command } };
}

function editInput(filePath, extra = {}) {
  return { session_id: SESSION, tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'a', new_string: 'b', ...extra } };
}

function accumulatorFile(sessionId = SESSION) {
  return path.join(tmpRoot, `opm-edited-${sessionId}.txt`);
}

function writeFixture(relativePath, content) {
  const absolute = path.join(tmpRoot, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
  return absolute;
}

test('block-no-verify: denies git commit --no-verify', () => {
  const { status, stdout } = runHook('block-no-verify.js', bashInput('git commit --no-verify -m "wip"'));
  assert.equal(status, 0);
  const out = parseOutput(stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /--no-verify/);
});

test('block-no-verify: denies -n cluster, hooksPath override, HUSKY=0 and chained commands', () => {
  const denied = [
    'git commit -am "msg"  && git push --no-verify',
    'git commit -an -m "msg"',
    'git -c core.hooksPath=/dev/null commit -m "msg"',
    'HUSKY=0 git push origin main',
    'cd repo && git commit --no-verif -m "prefix"',
  ];
  for (const command of denied) {
    const { stdout } = runHook('block-no-verify.js', bashInput(command));
    assert.equal(parseOutput(stdout).hookSpecificOutput.permissionDecision, 'deny', command);
  }
});

test('block-no-verify: allows normal git commands silently', () => {
  const allowed = [
    'git commit -m "mention --no-verify in the message only"',
    'git commit -am "fix"',
    'git push origin main',
    'git status && git log --oneline -n 5',
    'echo "git commit --no-verify" # just a comment',
    'npm test',
  ];
  for (const command of allowed) {
    const { status, stdout } = runHook('block-no-verify.js', bashInput(command));
    assert.equal(status, 0, command);
    assert.equal(stdout, '', command);
  }
});

test('config-protection: existing tsconfig edit -> ask', () => {
  const tsconfig = writeFixture('proj/tsconfig.json', '{"compilerOptions":{"strict":true}}');
  const { status, stdout } = runHook('config-protection.js', editInput(tsconfig));
  assert.equal(status, 0);
  const out = parseOutput(stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'ask');
  assert.match(out.permissionDecisionReason, /tsconfig\.json/);
});

test('config-protection: pyproject lint section change -> ask, dependency change -> silent', () => {
  const pyproject = writeFixture('py/pyproject.toml', '[project]\nname = "x"\n\n[tool.ruff]\nline-length = 88\n');
  const lintEdit = editInput(pyproject, { old_string: 'line-length = 88', new_string: 'line-length = 200' });
  assert.equal(parseOutput(runHook('config-protection.js', lintEdit).stdout).hookSpecificOutput.permissionDecision, 'ask');
  const depEdit = editInput(pyproject, { old_string: 'name = "x"', new_string: 'name = "y"' });
  assert.equal(runHook('config-protection.js', depEdit).stdout, '');
});

test('config-protection: normal edit, new config, and OPM_ALLOW_CONFIG_EDITS=1 are silent', () => {
  const source = writeFixture('proj/src/index.ts', 'export const a = 1;\n');
  assert.equal(runHook('config-protection.js', editInput(source)).stdout, '');
  assert.equal(runHook('config-protection.js', editInput(path.join(tmpRoot, 'proj', '.eslintrc.json'))).stdout, '');
  const tsconfig = path.join(tmpRoot, 'proj', 'tsconfig.json');
  assert.equal(runHook('config-protection.js', editInput(tsconfig), { OPM_ALLOW_CONFIG_EDITS: '1' }).stdout, '');
});

test('post-edit-accumulator: writes deduped per-session list, no output', () => {
  fs.rmSync(accumulatorFile(), { force: true });
  const first = runHook('post-edit-accumulator.js', editInput('/tmp/a.ts'));
  assert.equal(first.status, 0);
  assert.equal(first.stdout, '');
  runHook('post-edit-accumulator.js', editInput('/tmp/a.ts'));
  runHook('post-edit-accumulator.js', {
    session_id: SESSION, tool_name: 'MultiEdit', tool_input: { file_path: '/tmp/b.py', edits: [{ file_path: '/tmp/c.dart' }] },
  });
  const lines = fs.readFileSync(accumulatorFile(), 'utf8').trim().split('\n');
  assert.deepEqual(lines, ['/tmp/a.ts', '/tmp/b.py', '/tmp/c.dart']);
  const { stdout } = runHook('post-edit-accumulator.js', editInput('/tmp/d.js'), { OPM_HOOKS_DISABLED: '1' });
  assert.equal(stdout, '');
  assert.equal(fs.readFileSync(accumulatorFile(), 'utf8').includes('/tmp/d.js'), false);
});

test('check-console-log: warns on console.log in an edited fixture, skips tests and allow-marker', () => {
  const flagged = writeFixture('app/src/main.ts', 'const x = 1;\nconsole.log(x);\n// console.log in a comment is fine\n');
  const testFile = writeFixture('app/src/main.test.ts', 'console.log("ok in tests");\n');
  const allowed = writeFixture('app/src/cli.ts', '// opm-allow-console\nconsole.log("cli output");\n');
  const dart = writeFixture('app/lib/x.dart', 'void f() { debugPrint("hi"); }\n');
  fs.writeFileSync(accumulatorFile('console'), [flagged, testFile, allowed, dart].join('\n') + '\n');
  const { status, stdout } = runHook('check-console-log.js', { session_id: 'console' });
  assert.equal(status, 0);
  const message = parseOutput(stdout).systemMessage;
  assert.match(message, /main\.ts:2/);
  assert.match(message, /x\.dart:1/);
  assert.doesNotMatch(message, /main\.test\.ts/);
  assert.doesNotMatch(message, /cli\.ts/);
  assert.equal(message.match(/main\.ts:/g).length, 1);
});

test('check-console-log: silent when nothing was edited', () => {
  const { status, stdout } = runHook('check-console-log.js', { session_id: 'nothing-edited' });
  assert.equal(status, 0);
  assert.equal(stdout, '');
});

test('stop-format-typecheck: stop_hook_active short-circuits without touching the list', () => {
  fs.writeFileSync(accumulatorFile('loop'), '/tmp/whatever.ts\n');
  const { status, stdout } = runHook('stop-format-typecheck.js', { session_id: 'loop', stop_hook_active: true });
  assert.equal(status, 0);
  assert.equal(stdout, '');
  assert.equal(fs.existsSync(accumulatorFile('loop')), true);
});

test('stop-format-typecheck: empty list exits silently; processed list is cleared', () => {
  assert.equal(runHook('stop-format-typecheck.js', { session_id: 'no-list' }).stdout, '');
  const file = writeFixture('fmt/src/a.js', 'const a = 1\n');
  writeFixture('fmt/package.json', '{"name":"fmt"}');
  fs.writeFileSync(accumulatorFile('fmt'), file + '\n');
  const { status, stdout } = runHook('stop-format-typecheck.js', { session_id: 'fmt', cwd: tmpRoot }, { OPM_SKIP_FORMAT: '1' });
  assert.equal(status, 0);
  assert.equal(stdout, '');
  assert.equal(fs.existsSync(accumulatorFile('fmt')), false);
});

test('session-start: injects fixture skill content with frontmatter stripped', () => {
  const pluginRoot = path.join(tmpRoot, 'plugin');
  writeFixture('plugin/skills/using-opm/SKILL.md', '---\nname: using-opm\ndescription: fixture\n---\n# Using OPM\n\nAlways start here.\n');
  const { status, stdout } = runHook('session-start.js', { session_id: SESSION, source: 'startup' }, { CLAUDE_PLUGIN_ROOT: pluginRoot });
  assert.equal(status, 0);
  const out = parseOutput(stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'SessionStart');
  assert.match(out.additionalContext, /# Using OPM/);
  assert.match(out.additionalContext, /Always start here\./);
  assert.doesNotMatch(out.additionalContext, /description: fixture/);
});

test('session-start: silent when the skill file is missing', () => {
  const { status, stdout } = runHook('session-start.js', {}, { CLAUDE_PLUGIN_ROOT: path.join(tmpRoot, 'missing') });
  assert.equal(status, 0);
  assert.equal(stdout, '');
});

test('all scripts: OPM_HOOKS_DISABLED=1 silences every hook', () => {
  const tsconfig = path.join(tmpRoot, 'proj', 'tsconfig.json');
  const cases = [
    ['block-no-verify.js', bashInput('git commit --no-verify')],
    ['config-protection.js', editInput(tsconfig)],
    ['post-edit-accumulator.js', editInput('/tmp/z.ts')],
    ['check-console-log.js', { session_id: 'console' }],
    ['stop-format-typecheck.js', { session_id: 'fmt' }],
    ['session-start.js', {}],
  ];
  for (const [script, input] of cases) {
    const { status, stdout } = runHook(script, input, { OPM_HOOKS_DISABLED: '1', CLAUDE_PLUGIN_ROOT: path.join(tmpRoot, 'plugin') });
    assert.equal(status, 0, script);
    assert.equal(stdout, '', script);
  }
});

test('all scripts: malformed stdin never crashes or blocks', () => {
  for (const script of fs.readdirSync(SCRIPTS).filter((name) => name.endsWith('.js'))) {
    const { status, stdout } = runHook(script, '{not json', { CLAUDE_PLUGIN_ROOT: path.join(tmpRoot, 'missing') });
    assert.equal(status, 0, script);
    assert.equal(stdout, '', script);
  }
});
