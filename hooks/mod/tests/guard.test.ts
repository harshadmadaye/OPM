import { describe, expect, mock, test } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On } from 'claude-code';

import { classify } from '../guard.mjs';

const REPO = '/work/repo';
const RUN_IT = 'Run it';
const CANCEL = 'Cancel';
const RAN = 'the command ran';

type Answer = string | 'dismissed';
type World = { asked: string[]; ran: string[]; logged: string[] };
type EngineOptions = { env?: Record<string, string>; isRootMissing?: boolean };

// The engine beneath the plugin: the session's root and cwd, a Bash tool that
// records what it ran, and an AskUserQuestion dialog answered with `answer`.
function serveEngine(on: On, answer: Answer, { env = {}, isRootMissing = false }: EngineOptions = {}): World {
  const world: World = { asked: [], ran: [], logged: [] };
  mock.env(on, env);
  on('command.register', (_$, e) => ({ value: { command: e.name } }));
  on('session.start', (_$, e) => e);
  on('ui.log', (_$, e) => {
    world.logged.push(e.text);
    return { value: undefined };
  });
  on('session.root', () => (isRootMissing ? { deny: 'root unavailable' } : { value: REPO }));
  on('session.cwd', () => ({ value: REPO }));
  on('tool.call', { tool: 'Bash' }, (_$, e) => {
    world.ran.push(e.command);
    return { result: { stdout: RAN, stderr: '', interrupted: false } };
  });
  on('tool.call', { tool: 'AskUserQuestion' }, (_$, e) => {
    const { question } = e.questions[0];
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

const deniedText = (result: { deny?: string; text?: string }) => result.deny ?? result.text ?? '';

describe('classify', () => {
  const held = [
    ['rm -rf /', 'rm -rf on /'],
    ['rm -rf ~', 'rm -rf on ~'],
    ['rm -fr ~/projects', 'rm -rf on ~/projects'],
    ['rm -r -f "$HOME"', 'rm -rf on $HOME'],
    ['rm --recursive --force ..', 'rm -rf on ..'],
    ['rm -rf *', 'rm -rf on *'],
    ['rm -Rf /etc/nginx', 'rm -rf on /etc/nginx'],
    ['sudo rm -rf /var/lib', 'rm -rf on /var/lib'],
    ['cd build && rm -rf /tmp/x', 'rm -rf on /tmp/x'],
    ['git push --force origin main', 'force-push to main'],
    ['git push -f origin master', 'force-push to master'],
    ['git push origin +main', 'force-push to main'],
    ['git push --force-with-lease origin HEAD:refs/heads/main', 'force-push to main'],
    ['git -C . push -uf origin feature:master', 'force-push to master'],
    ['git push --force', 'force-push with no branch named'],
    ['git reset --hard', 'git reset --hard'],
    ['git reset --hard HEAD~3', 'git reset --hard'],
  ] as const;
  for (const [command, reason] of held) {
    test(`holds ${command}`, () => {
      expect(classify(command, REPO)).toEqual({ isRisky: true, reason });
    });
  }

  const passed = [
    'rm -rf ./build',
    'rm -rf dist node_modules',
    'rm -rf build/*',
    `rm -rf ${REPO}/coverage`,
    'rm -f /tmp/one-file.txt',
    'rm -r ./tmp',
    'git push origin feat/widget',
    'git push --force origin feat/widget',
    'git push origin main',
    'git reset --soft HEAD~1',
    'git reset HEAD file.txt',
    'echo rm -rf /',
    'echo "git push --force origin main"',
    'grep -n "git reset --hard" docs/threat-model.md',
    "cat > notes.md <<'EOF'\nrm -rf /\ngit reset --hard\nEOF",
    'ls -la',
  ];
  for (const command of passed) {
    test(`passes ${command.split('\n')[0]}`, () => {
      expect(classify(command, REPO)).toEqual({ isRisky: false, reason: null });
    });
  }
});

describe('guard hook', () => {
  test('a safe command runs without a question', async ($, on) => {
    const world = serveEngine(on, RUN_IT);
    const result = await runBash($, 'rm -rf ./dist');
    expect(world.asked).toEqual([]);
    expect(world.ran).toEqual(['rm -rf ./dist']);
    expect(result.isError === true).toBe(false);
  });

  test('a risky command asks, and Run it runs it', async ($, on) => {
    const world = serveEngine(on, RUN_IT);
    await runBash($, 'git push --force origin main');
    expect(world.asked).toEqual(['OPM held: force-push to main. Run `git push --force origin main`?']);
    expect(world.ran).toEqual(['git push --force origin main']);
  });

  test('Cancel denies with the reason', async ($, on) => {
    const world = serveEngine(on, CANCEL);
    const result = await runBash($, 'git reset --hard');
    expect(world.ran).toEqual([]);
    expect(deniedText(result)).toBe(
      'OPM held this command (git reset --hard) and nobody approved it. Ask the user before trying another way. See docs/threat-model.md.',
    );
  });

  test('a dismissed question (nobody to answer) denies', async ($, on) => {
    const world = serveEngine(on, 'dismissed');
    const result = await runBash($, 'git push --force origin main');
    expect(world.ran).toEqual([]);
    expect(deniedText(result).startsWith('OPM held this command (force-push to main) and nobody approved it.')).toBe(true);
    expect(world.logged.some((line) => line.startsWith('opm: guard question not answered'))).toBe(true);
  });

  test('a guard failure fails closed through .catch', async ($, on) => {
    const world = serveEngine(on, RUN_IT, { isRootMissing: true });
    const result = await runBash($, 'ls');
    expect(world.ran).toEqual([]);
    // The failure kind depends on where in the chain the error surfaces; the
    // contract is that the call is denied and nothing runs.
    expect(deniedText(result).startsWith('OPM guard failed (')).toBe(true);
  });

  test('OPM_GUARD=off passes everything', async ($, on) => {
    const world = serveEngine(on, CANCEL, { env: { OPM_GUARD: 'off' } });
    await runBash($, 'rm -rf /');
    expect(world.asked).toEqual([]);
    expect(world.ran).toEqual(['rm -rf /']);
  });
});
