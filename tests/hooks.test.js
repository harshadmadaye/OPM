'use strict';
// Tests for the OPM hook scripts. Run with: node --test tests/hooks.test.js
// Each script is spawned as a real process with crafted stdin JSON, exactly as
// Claude Code would invoke it. TMPDIR, TEMP and TMP all point at a per-run temp
// dir so the accumulator files never leak into the real temp directory.

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
  // os.tmpdir() reads TMPDIR on POSIX and TEMP/TMP on Windows; set all three.
  const env = { ...process.env, TMPDIR: tmpRoot, TEMP: tmpRoot, TMP: tmpRoot };
  delete env.OPM_HOOKS_DISABLED;
  delete env.OPM_ALLOW_CONFIG_EDITS;
  delete env.OPM_MOD_ACTIVE;
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

function denyReason(command) {
  const { status, stdout } = runHook('block-no-verify.js', bashInput(command));
  assert.equal(status, 0, command);
  assert.notEqual(stdout, '', `expected a deny for: ${command}`);
  const out = parseOutput(stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'deny', command);
  return out.permissionDecisionReason;
}

test('block-no-verify: blocks each known evasion with the rule and the safe alternative', () => {
  const evasions = [
    'git commit -n -m "msg"',
    'git commit -m "msg" --no-verify',
    'git commit --amend --no-edit --no-verify',
    'HUSKY=0 git commit -m "msg"',
    'export HUSKY=0 && git commit -m "msg"',
    'HUSKY_SKIP_HOOKS=1 git commit -m "msg"',
    'git -c core.hooksPath=/dev/null commit -m "msg"',
    'git -c core.hooksPath=.nohooks push',
    'git config core.hooksPath /dev/null',
    'git config --local core.hooksPath .nohooks',
    'git config --unset core.hooksPath',
    'git config set core.hooksPath /tmp/none',
    'if git commit -n -m "x"; then echo ok; fi',
    'git add . && git commit --no-verify -F - <<\'EOF\'\nmessage body\nEOF',
  ];
  for (const command of evasions) {
    const reason = denyReason(command);
    assert.match(reason, /no-hook-bypass/, command);
    assert.match(reason, /fix the failing hook instead/i, command);
  }
  assert.match(denyReason('HUSKY=0 git commit -m "msg"'), /HUSKY=0/);
});

test('block-no-verify: look-alikes that only mention the words pass', () => {
  const heredocPlan = [
    "mkdir -p docs/plans && cat > docs/plans/PLAN-02-05.md <<'EOF'",
    '# Plan',
    'Known evasions: the short -n flag on git commit, git commit --no-verify anywhere,',
    'HUSKY=0 git commit -m x, git -c core.hooksPath=/dev/null commit, git config core.hooksPath x.',
    'EOF',
    'git status',
  ].join('\n');
  const lookAlikes = [
    heredocPlan,
    'cat <<-EOF > notes.md\n\tgit commit --no-verify\n\tEOF',
    'git commit -F - <<\'EOF\'\nfix: explain why --no-verify and HUSKY=0 are blocked\nEOF',
    'echo git commit --no-verify',
    "printf '%s\\n' 'git commit -n -m x'",
    'git commit -m "HUSKY=0 is now blocked; so is --no-verify"',
    'echo HUSKY=0 && git commit -m "msg"',
    'git config --get core.hooksPath',
    'git config core.hooksPath',
    'grep -rn "git commit --no-verify" docs/',
  ];
  for (const command of lookAlikes) {
    const { status, stdout } = runHook('block-no-verify.js', bashInput(command));
    assert.equal(status, 0, command);
    assert.equal(stdout, '', command);
  }
});

test('config-protection: core.hooksPath change in .git/config -> ask, other git config edits silent', () => {
  const gitConfig = writeFixture('repo/.git/config', '[core]\n\tbare = false\n');
  const hooksEdit = editInput(gitConfig, { old_string: '\tbare = false\n', new_string: '\tbare = false\n\thooksPath = /dev/null\n' });
  const out = parseOutput(runHook('config-protection.js', hooksEdit).stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'ask');
  assert.match(out.permissionDecisionReason, /hooksPath/);
  const otherEdit = editInput(gitConfig, { old_string: 'bare = false', new_string: 'bare = true' });
  assert.equal(runHook('config-protection.js', otherEdit).stdout, '');
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
  // The hook stores path.resolve()d paths, which gain a drive letter on Windows.
  assert.deepEqual(lines, ['/tmp/a.ts', '/tmp/b.py', '/tmp/c.dart'].map((file) => path.resolve(file)));
  const { stdout } = runHook('post-edit-accumulator.js', editInput('/tmp/d.js'), { OPM_HOOKS_DISABLED: '1' });
  assert.equal(stdout, '');
  assert.equal(fs.readFileSync(accumulatorFile(), 'utf8').includes(path.resolve('/tmp/d.js')), false);
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
  const message = parseOutput(stdout).systemMessage;
  assert.match(message, /prettier: skipped \(OPM_SKIP_FORMAT=1\)/);
  assert.match(message, /tsc: skipped \(no tsconfig\.json\)/);
  assert.equal(fs.existsSync(accumulatorFile('fmt')), false);
});

// A fake CLI on a stubbed PATH: a node script plus a POSIX sh or Windows .cmd shim.
function writeFakeTool(dir, name, body) {
  fs.mkdirSync(dir, { recursive: true });
  const script = path.join(dir, `${name}-impl.js`);
  fs.writeFileSync(script, body, 'utf8');
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(dir, `${name}.cmd`), `@"${process.execPath}" "${script}" %*\r\n`);
    return;
  }
  const shim = path.join(dir, name);
  fs.writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
  fs.chmodSync(shim, 0o755);
}

function envWithPath(dir, extra = {}) {
  const env = {};
  for (const key of Object.keys(process.env)) if (key.toLowerCase() === 'path') env[key] = undefined;
  return { ...env, PATH: dir, ...extra };
}

function runStop(sessionId, files, extraEnv) {
  fs.writeFileSync(accumulatorFile(sessionId), files.join('\n') + '\n');
  return runHook('stop-format-typecheck.js', { session_id: sessionId, cwd: tmpRoot }, extraEnv);
}

const SLEEP_ON_FORMAT = (ms) =>
  `if (process.argv[2] === 'format') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${ms});\n`;

test('stop-format-typecheck: missing tool warns, unchanged language says skipped', () => {
  writeFixture('nopath/pyproject.toml', '[project]\nname = "x"\n');
  const py = writeFixture('nopath/app.py', 'x = 1\n');
  const dart = writeFixture('nopath/lib/a.dart', 'void main() {}\n');
  const emptyBin = path.join(tmpRoot, 'empty-bin');
  fs.mkdirSync(emptyBin, { recursive: true });
  const { status, stdout } = runStop('nopath', [py, dart], envWithPath(emptyBin));
  assert.equal(status, 0);
  const message = parseOutput(stdout).systemMessage;
  assert.match(message, /ruff: not found on PATH, install it or set OPM_SKIP_FORMAT=1/);
  assert.match(message, /dart: not found on PATH, install it or set OPM_SKIP_FORMAT=1/);
  assert.match(message, /tsc: skipped \(no \.js\/\.ts changed\)/);
});

test('stop-format-typecheck: a working tool reports what it did', () => {
  const bin = path.join(tmpRoot, 'ok-bin');
  writeFakeTool(bin, 'ruff', 'process.exit(0);\n');
  writeFixture('okpy/pyproject.toml', '[project]\nname = "x"\n');
  const py = writeFixture('okpy/app.py', 'x = 1\n');
  const message = parseOutput(runStop('okpy', [py], envWithPath(bin)).stdout).systemMessage;
  assert.match(message, /ruff: formatted 1 file, check passed in /);
  assert.match(message, /dart: skipped \(no \.dart changed\)/);
});

test('stop-format-typecheck: a slow tool triggers the stopped-early line', () => {
  const bin = path.join(tmpRoot, 'slow-bin');
  writeFakeTool(bin, 'ruff', SLEEP_ON_FORMAT(3000));
  writeFakeTool(bin, 'dart', 'process.exit(0);\n');
  writeFixture('slow/pyproject.toml', '[project]\nname = "x"\n');
  const py = writeFixture('slow/app.py', 'x = 1\n');
  const dart = writeFixture('slow/lib/a.dart', 'void main() {}\n');
  const { status, stdout } = runStop('slow', [py, dart], envWithPath(bin, { OPM_STOP_BUDGET_MS: '2000' }));
  assert.equal(status, 0);
  const message = parseOutput(stdout).systemMessage;
  assert.match(message, /stopped early: \d+ checks? skipped to stay inside the hook timeout/);
  assert.doesNotMatch(message, /dart: formatted/);
});

test('stop-format-typecheck: tsc errors still block the stop', () => {
  writeFixture('tsblock/package.json', '{"name":"tsblock"}');
  writeFixture('tsblock/tsconfig.json', '{}');
  const ts = writeFixture('tsblock/src/a.ts', 'const a: number = "x";\n');
  writeFakeTool(path.join(tmpRoot, 'tsblock', 'node_modules', '.bin'), 'tsc',
    'console.log("src/a.ts(1,7): error TS2322: Type string is not assignable to type number.");\nprocess.exit(2);\n');
  const emptyBin = path.join(tmpRoot, 'empty-bin');
  fs.mkdirSync(emptyBin, { recursive: true });
  const { status, stdout } = runStop('tsblock', [ts], envWithPath(emptyBin, { OPM_SKIP_FORMAT: '1' }));
  assert.equal(status, 0);
  const out = parseOutput(stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /error TS2322/);
  assert.match(out.reason, /prettier: skipped \(OPM_SKIP_FORMAT=1\)/);
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

test('session-start: adds exactly one resume line when the cwd has an open ledger', () => {
  const pluginRoot = path.join(tmpRoot, 'plugin');
  writeFixture('plugin/skills/using-opm/SKILL.md', '---\nname: using-opm\n---\n# Using OPM\n\nAlways start here.\n');
  const repo = path.join(tmpRoot, 'resume-repo');
  writeFixture('resume-repo/docs/plans/2026-10-01-auth.md', '### Task 1: Model\n### Task 2: Route\n');
  writeFixture('resume-repo/docs/plans/2026-10-01-auth.progress.md', '# OPM ledger - plan: docs/plans/2026-10-01-auth.md\nTask 1: complete\n');
  const baseline = parseOutput(runHook('session-start.js', { cwd: path.join(tmpRoot, 'no-ledger') }, { CLAUDE_PLUGIN_ROOT: pluginRoot }).stdout);
  const { status, stdout } = runHook('session-start.js', { session_id: SESSION, source: 'startup', cwd: repo }, { CLAUDE_PLUGIN_ROOT: pluginRoot });
  assert.equal(status, 0);
  const context = parseOutput(stdout).hookSpecificOutput.additionalContext;
  const baseLines = baseline.hookSpecificOutput.additionalContext.split('\n');
  const added = context.split('\n').filter((line) => !baseLines.includes(line));
  assert.equal(added.length, 1, added.join('\n'));
  assert.match(added[0], /docs\/plans\/2026-10-01-auth\.progress\.md/);
  assert.match(added[0], /1 of 2/);
  assert.match(context, /<\/opm-plugin>$/);
});

test('session-start: output is unchanged when the cwd has no open ledger', () => {
  const pluginRoot = path.join(tmpRoot, 'plugin');
  writeFixture('plugin/skills/using-opm/SKILL.md', '---\nname: using-opm\n---\n# Using OPM\n\nAlways start here.\n');
  writeFixture('done-repo/docs/plans/x.progress.md', '# OPM ledger - plan: docs/plans/x.md\nMode: inline (1 tasks)\nTask 1: complete\n');
  writeFixture('bad-repo/docs/plans/y.progress.md', 'not a ledger\n');
  const expected = '<opm-plugin>\n' +
    "The OPM plugin is active. Below is the full content of its 'opm:using-opm' skill; " +
    'use the Skill tool for every other opm skill.\n\n# Using OPM\n\nAlways start here.\n</opm-plugin>';
  for (const cwd of [path.join(tmpRoot, 'done-repo'), path.join(tmpRoot, 'bad-repo'), path.join(tmpRoot, 'nowhere'), 42]) {
    const { status, stdout } = runHook('session-start.js', { cwd }, { CLAUDE_PLUGIN_ROOT: pluginRoot });
    assert.equal(status, 0, String(cwd));
    assert.equal(parseOutput(stdout).hookSpecificOutput.additionalContext, expected, String(cwd));
  }
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

test('OPM_MOD_ACTIVE=<this session id>: block-no-verify and config-protection step aside for the mod', () => {
  const tsconfig = writeFixture('mod/tsconfig.json', '{}');
  const cases = [
    ['block-no-verify.js', bashInput('git commit --no-verify -m "wip"')],
    ['config-protection.js', editInput(tsconfig)],
  ];
  for (const [script, input] of cases) {
    assert.notEqual(runHook(script, input).stdout, '', `${script} checks without the mod`);
    const { status, stdout, stderr } = runHook(script, input, { OPM_MOD_ACTIVE: SESSION });
    assert.equal(status, 0, script);
    assert.equal(stdout, '', script);
    assert.equal(stderr, '', script);
  }
});

test('OPM_MOD_ACTIVE from another session (an inherited variable) does not silence the checks', () => {
  const tsconfig = writeFixture('mod-inherited/tsconfig.json', '{}');
  const cases = [
    ['block-no-verify.js', bashInput('git commit --no-verify -m "wip"')],
    ['config-protection.js', editInput(tsconfig)],
  ];
  for (const [script, input] of cases) {
    for (const value of ['1', 'some-other-session']) {
      assert.notEqual(runHook(script, input, { OPM_MOD_ACTIVE: value }).stdout, '', `${script} still checks with OPM_MOD_ACTIVE=${value}`);
    }
  }
});

test('all scripts: malformed stdin never crashes or blocks', () => {
  for (const script of fs.readdirSync(SCRIPTS).filter((name) => name.endsWith('.js'))) {
    const { status, stdout } = runHook(script, '{not json', { CLAUDE_PLUGIN_ROOT: path.join(tmpRoot, 'missing') });
    assert.equal(status, 0, script);
    assert.equal(stdout, '', script);
  }
});
