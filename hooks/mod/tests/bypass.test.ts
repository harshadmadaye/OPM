import { describe, expect, mock, test } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On } from 'claude-code';

import { configEditKind, findBypass } from '../../lib/bypass-rules.mjs';

const REPO = '/work/repo';
const ALLOW_EDIT = 'Allow edit';
const CANCEL = 'Cancel';
const RAN = 'the tool ran';

type Answer = string | 'dismissed';
type World = { asked: string[]; ran: string[]; logged: string[] };
type EngineOptions = { env?: Record<string, string>; files?: Record<string, string>; isFsBroken?: boolean };

// The engine beneath the plugin: a fixed session root, Bash and Edit tools
// that record what ran, files served from `files`, and an AskUserQuestion
// dialog answered with `answer`.
function serveEngine(on: On, answer: Answer, { env = {}, files = {}, isFsBroken = false }: EngineOptions = {}): World {
  const world: World = { asked: [], ran: [], logged: [] };
  mock.env(on, env);
  on('command.register', (_$, e) => ({ value: { command: e.name } }));
  on('session.start', (_$, e) => e);
  on('ui.log', (_$, e) => {
    world.logged.push(e.text);
    return { value: undefined };
  });
  on('session.root', () => ({ value: REPO }));
  on('session.cwd', () => ({ value: REPO }));
  on('fs.exists', (_$, e) => (isFsBroken ? { deny: 'EIO: broken disk' } : { value: e.path in files }));
  on('fs.read', (_$, e) => {
    const text = files[e.path];
    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text };
  });
  on('tool.call', { tool: 'Bash' }, (_$, e) => {
    world.ran.push(e.command);
    return { result: { stdout: RAN, stderr: '', interrupted: false } };
  });
  on('tool.call', { tool: 'Edit' }, (_$, e) => {
    world.ran.push(e.file_path);
    const result = {
      filePath: e.file_path,
      oldString: e.old_string,
      newString: e.new_string,
      originalFile: null,
      structuredPatch: [],
      userModified: false,
      replaceAll: false,
    };
    return { result };
  });
  on('tool.call', { tool: 'AskUserQuestion' }, (_$, e) => {
    const question = e.questions[0]?.question ?? '';
    world.asked.push(question);
    if (answer === 'dismissed') return { deny: 'The user dismissed the question' };
    return { result: { questions: e.questions, answers: { [question]: answer } } };
  });
  return world;
}

async function runBash($: Engine, command: string) {
  await $.session.start({ cwd: REPO, surface: null, isInteractive: false });
  return $.tool.call({ tool: 'Bash', command });
}

async function runEdit($: Engine, filePath: string, oldString: string, newString: string) {
  await $.session.start({ cwd: REPO, surface: null, isInteractive: false });
  return $.tool.call({ tool: 'Edit', file_path: filePath, old_string: oldString, new_string: newString });
}

const deniedText = (result: { deny?: string; text?: string }) => result.deny ?? result.text ?? '';

const BLOCKED = [
  'git commit --no-verify -m "wip"',
  'git commit -am "msg"  && git push --no-verify',
  'git commit -an -m "msg"',
  'git commit -n -m "msg"',
  'git commit --amend --no-edit --no-verify',
  'cd repo && git commit --no-verif -m "prefix"',
  'HUSKY=0 git push origin main',
  'export HUSKY=0 && git commit -m "msg"',
  'HUSKY_SKIP_HOOKS=1 git commit -m "msg"',
  'git -c core.hooksPath=/dev/null commit -m "msg"',
  'git -c core.hooksPath=.nohooks push',
  'git config core.hooksPath /dev/null',
  'git config --local core.hooksPath .nohooks',
  'git config --unset core.hooksPath',
  'git config set core.hooksPath /tmp/none',
  'if git commit -n -m "x"; then echo ok; fi',
  "git add . && git commit --no-verify -F - <<'EOF'\nmessage body\nEOF",
];

const ALLOWED = [
  'git commit -m "mention --no-verify in the message only"',
  'git commit -am "fix"',
  'git push origin main',
  'git status && git log --oneline -n 5',
  'echo "git commit --no-verify" # just a comment',
  'npm test',
  "cat > notes.md <<'EOF'\nHUSKY=0 git commit -m x, git commit --no-verify\nEOF\ngit status",
  'cat <<-EOF > notes.md\n\tgit commit --no-verify\n\tEOF',
  'echo git commit --no-verify',
  "printf '%s\\n' 'git commit -n -m x'",
  'git commit -m "HUSKY=0 is now blocked; so is --no-verify"',
  'echo HUSKY=0 && git commit -m "msg"',
  'git config --get core.hooksPath',
  'git config core.hooksPath',
  'grep -rn "git commit --no-verify" docs/',
];

describe('findBypass', () => {
  for (const command of BLOCKED) {
    test(`blocks ${command}`, () => {
      expect(findBypass(command)).not.toBe(null);
    });
  }
  for (const command of ALLOWED) {
    test(`passes ${command}`, () => {
      expect(findBypass(command)).toBe(null);
    });
  }
  test('names the husky bypass', () => {
    expect(findBypass('HUSKY=0 git commit -m "msg"')).toBe('Disabling husky (HUSKY=0) is not allowed around git commit.');
  });
});

describe('configEditKind', () => {
  const missing = { exists: false, content: null };
  const edit = (file_path: string, old_string: string, new_string: string) => ({ file_path, old_string, new_string });
  test('an existing tsconfig is a typecheck config', () => {
    const file = { exists: true, content: '{}' };
    expect(configEditKind('Edit', edit('/p/tsconfig.json', 'a', 'b'), file)).toBe('linter/formatter/typecheck config');
  });
  test('a new config and an ordinary source file pass', () => {
    expect(configEditKind('Edit', edit('/p/.eslintrc.json', 'a', 'b'), missing)).toBe(null);
    expect(configEditKind('Edit', edit('/p/src/index.ts', 'a', 'b'), { exists: true, content: 'a' })).toBe(null);
  });
  test('a pyproject lint change asks, a dependency change passes', () => {
    const file = { exists: true, content: '[project]\nname = "x"\n\n[tool.ruff]\nline-length = 88\n' };
    expect(configEditKind('Edit', edit('/p/pyproject.toml', 'line-length = 88', 'line-length = 200'), file)).toBe('[tool.ruff]/[tool.mypy] config');
    expect(configEditKind('Edit', edit('/p/pyproject.toml', 'name = "x"', 'name = "y"'), file)).toBe(null);
  });
  test('a hooksPath line in .git/config asks, other git config edits pass', () => {
    const file = { exists: true, content: '[core]\n\tbare = false\n' };
    expect(configEditKind('Edit', edit('/r/.git/config', '\tbare = false\n', '\tbare = false\n\thooksPath = /dev/null\n'), file)).toBe('git config core.hooksPath setting');
    expect(configEditKind('Edit', edit('/r/.git/config', 'bare = false', 'bare = true'), file)).toBe(null);
  });
  test('an existing husky hook is a git hook script', () => {
    expect(configEditKind('Write', { file_path: '/r/.husky/pre-commit', content: 'exit 0' }, { exists: true, content: 'npm test' })).toBe('git hook script');
  });
});

describe('bypass hook (Bash)', () => {
  for (const command of BLOCKED) {
    test(`denies ${command}`, async ($, on) => {
      const world = serveEngine(on, CANCEL);
      const result = await runBash($, command);
      expect(world.ran).toEqual([]);
      expect(deniedText(result)).toContain('OPM rule no-hook-bypass blocked this command');
      expect(deniedText(result)).toContain('Fix the failing hook instead');
    });
  }
  for (const command of ALLOWED) {
    test(`runs ${command}`, async ($, on) => {
      const world = serveEngine(on, CANCEL);
      await runBash($, command);
      expect(world.ran).toEqual([command]);
    });
  }
  test('OPM_HOOKS_DISABLED=1 passes everything', async ($, on) => {
    const world = serveEngine(on, CANCEL, { env: { OPM_HOOKS_DISABLED: '1' } });
    const command = 'git commit -n -m "wip"';
    await runBash($, command);
    expect(world.ran).toEqual([command]);
  });
});

describe('config protection hook (Edit)', () => {
  const TSCONFIG = `${REPO}/tsconfig.json`;
  const files = { [TSCONFIG]: '{"compilerOptions":{"strict":true}}' };

  test('an existing tsconfig edit asks, and Allow edit runs it', async ($, on) => {
    const world = serveEngine(on, ALLOW_EDIT, { files });
    await runEdit($, TSCONFIG, 'true', 'false');
    expect(world.asked.length).toBe(1);
    expect(world.asked[0]).toContain('tsconfig.json is a linter/formatter/typecheck config');
    expect(world.ran).toEqual([TSCONFIG]);
  });

  test('Cancel denies', async ($, on) => {
    const world = serveEngine(on, CANCEL, { files });
    const result = await runEdit($, TSCONFIG, 'true', 'false');
    expect(world.ran).toEqual([]);
    expect(deniedText(result)).toContain('OPM: tsconfig.json is a linter/formatter/typecheck config');
  });

  test('a dismissed question (nobody to answer) denies', async ($, on) => {
    const world = serveEngine(on, 'dismissed', { files });
    await runEdit($, TSCONFIG, 'true', 'false');
    expect(world.ran).toEqual([]);
    expect(world.logged.some((line) => line.startsWith('opm: config question not answered'))).toBe(true);
  });

  test('an ordinary file and a new config run without a question', async ($, on) => {
    const world = serveEngine(on, CANCEL, { files: { [`${REPO}/src/a.ts`]: 'a' } });
    await runEdit($, `${REPO}/src/a.ts`, 'a', 'b');
    await $.tool.call({ tool: 'Edit', file_path: `${REPO}/.eslintrc.json`, old_string: 'a', new_string: 'b' });
    expect(world.asked).toEqual([]);
    expect(world.ran).toEqual([`${REPO}/src/a.ts`, `${REPO}/.eslintrc.json`]);
  });

  test('OPM_ALLOW_CONFIG_EDITS=1 skips the question', async ($, on) => {
    const world = serveEngine(on, CANCEL, { files, env: { OPM_ALLOW_CONFIG_EDITS: '1' } });
    await runEdit($, TSCONFIG, 'true', 'false');
    expect(world.asked).toEqual([]);
    expect(world.ran).toEqual([TSCONFIG]);
  });

  test('a failure of the check fails closed through .catch', async ($, on) => {
    const world = serveEngine(on, ALLOW_EDIT, { files, isFsBroken: true });
    const result = await runEdit($, TSCONFIG, 'true', 'false');
    expect(world.ran).toEqual([]);
    expect(deniedText(result).startsWith('OPM config check failed (')).toBe(true);
  });
});
