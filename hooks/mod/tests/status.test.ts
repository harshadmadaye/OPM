import { describe, expect, test } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { FsEntry, On } from 'claude-code';

import {
  COMPLETE_LEDGER,
  MALFORMED_LEDGER,
  MILESTONE_STATE,
  OLDER_MS,
  OPEN_LEDGER,
  OPEN_PLAN,
  UPDATED_AT_MS,
} from './fixtures/repo';

const COMMAND = 'opm-status';
const MAX_LINES = 5;

type FakeFile = { text: string; mtimeMs: number };
type FakeRepo = Record<string, FakeFile>;
type Git = { exitCode: number; stdout: string } | 'missing';

// Relative paths reach the host resolved against the test's working
// directory, so a path matches the repo file or folder it ends with.
function repoPaths(repo: FakeRepo): string[] {
  const paths = new Set<string>();
  for (const path of Object.keys(repo)) {
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('/'));
  }
  return [...paths];
}

function inRepo(repo: FakeRepo, path: string): string {
  const trimmed = path.replace(/\/$/, '');
  const match = repoPaths(repo).filter((known) => trimmed === known || trimmed.endsWith(`/${known}`));
  return match.sort((a, b) => b.length - a.length)[0] ?? trimmed;
}

function entriesOf(repo: FakeRepo, dir: string): FsEntry[] | null {
  const prefix = `${dir}/`;
  const children = new Map<string, FsEntry>();
  for (const [path, file] of Object.entries(repo)) {
    if (!path.startsWith(prefix)) continue;
    const [name, ...rest] = path.slice(prefix.length).split('/');
    const isDir = rest.length > 0;
    children.set(name, { name, kind: isDir ? 'dir' : 'file', size: isDir ? 0 : file.text.length, mtimeMs: isDir ? 0 : file.mtimeMs, isLink: false });
  }
  return children.size ? [...children.values()] : null;
}

function serveRepo(on: On, repo: FakeRepo, git: Git, failList?: string) {
  on('command.register', (_$, e) => ({ value: { command: e.name } }));
  on('session.start', (_$, e) => e);
  on('fs.exists', (_$, e) => {
    const path = inRepo(repo, e.path);
    return { value: path in repo || entriesOf(repo, path) !== null };
  });
  on('fs.list', (_$, e) => {
    const path = inRepo(repo, e.path);
    if (path === failList) return { deny: 'EACCES: permission denied' };
    const entries = entriesOf(repo, path);
    return entries ? { value: entries } : { deny: `ENOENT: ${path}` };
  });
  on('fs.read', (_$, e) => {
    const file = repo[inRepo(repo, e.path)];
    return file ? { value: file.text } : { deny: `ENOENT: ${e.path}` };
  });
  on('fs.stat', (_$, e) => {
    const file = repo[inRepo(repo, e.path)];
    return file ? { value: { kind: 'file', size: file.text.length, mtimeMs: file.mtimeMs, isLink: false } } : { deny: `ENOENT: ${e.path}` };
  });
  on('process.run', (_$, e) => {
    if (git === 'missing') return { deny: `cannot start ${e.argv[0]}: ENOENT` };
    return { value: { ...git, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } };
  });
}

async function runStatus($: Engine): Promise<string[]> {
  await $.session.start({ cwd: '/repo', surface: null, isInteractive: false });
  const result = await $.command.run({
    command: COMMAND,
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  });
  const lines = (result.text ?? '').split('\n');
  expect(lines.length <= MAX_LINES).toBe(true);
  return lines;
}

const OPEN_REPO: FakeRepo = {
  'docs/plans/2026-10-01-widget.md': { text: OPEN_PLAN, mtimeMs: OLDER_MS },
  'docs/plans/2026-10-01-widget.progress.md': { text: OPEN_LEDGER, mtimeMs: UPDATED_AT_MS },
  'docs/plans/2026-09-01-done.progress.md': { text: COMPLETE_LEDGER, mtimeMs: UPDATED_AT_MS + 1000 },
  'docs/milestones/m1/STATE.md': { text: MILESTONE_STATE, mtimeMs: OLDER_MS },
};

const UPDATED_LINE = /^updated \d{4}-\d\d-\d\d \d\d:\d\d on feat\/widget; milestone phase 3\/4, plan 2\/6 \(In progress\)$/;

describe('/opm-status', () => {
  test('session start registers the command to run mid-turn', async ($, on) => {
    const registered: unknown[] = [];
    on('command.register', (_$, e) => {
      registered.push(e);
      return { value: { command: e.name } };
    });
    on('session.start', (_$, e) => e);
    await $.session.start({ cwd: '/repo', surface: null, isInteractive: false });
    expect(registered).toContainEqual(expect.objectContaining({ name: COMMAND, immediate: true }));
  });

  test('an open ledger prints the plan in at most five lines', async ($, on) => {
    serveRepo(on, OPEN_REPO, { exitCode: 0, stdout: 'feat/widget\n' });
    const lines = await runStatus($);
    expect(lines[0]).toBe('plan: docs/plans/2026-10-01-widget.md (ledger docs/plans/2026-10-01-widget.progress.md)');
    expect(lines[1]).toBe('progress: 1/3, current: Task 2 Widget view');
    expect(lines[2]).toBe('fix round 1/3 on Task 2');
    expect(UPDATED_LINE.test(lines[3])).toBe(true);
    expect(lines[4]).toBe('next: ask Claude to resume the plan');
  });

  test('no ledger says so', async ($, on) => {
    serveRepo(on, { 'README.md': { text: '# hi', mtimeMs: OLDER_MS } }, { exitCode: 0, stdout: 'main\n' });
    expect(await runStatus($)).toEqual(['no open ledger in this repo']);
  });

  test('only complete ledgers count as no open ledger', async ($, on) => {
    serveRepo(on, { 'docs/plans/2026-09-01-done.progress.md': { text: COMPLETE_LEDGER, mtimeMs: OLDER_MS } }, { exitCode: 0, stdout: 'main\n' });
    expect(await runStatus($)).toEqual(['no open ledger in this repo']);
  });

  test('a malformed ledger names the file and the bad line', async ($, on) => {
    serveRepo(on, { 'docs/plans/bad.progress.md': { text: MALFORMED_LEDGER, mtimeMs: UPDATED_AT_MS } }, { exitCode: 0, stdout: 'main\n' });
    expect(await runStatus($)).toEqual(['malformed ledger docs/plans/bad.progress.md: line 1: unexpected "not a ledger header"']);
  });

  test('git missing still prints the status, without a branch', async ($, on) => {
    serveRepo(on, OPEN_REPO, 'missing');
    const lines = await runStatus($);
    expect(lines[1]).toBe('progress: 1/3, current: Task 2 Widget view');
    expect(/^updated \d{4}-\d\d-\d\d \d\d:\d\d; milestone phase 3\/4/.test(lines[3])).toBe(true);
  });

  test('an fs failure is one line naming what failed', async ($, on) => {
    serveRepo(on, OPEN_REPO, { exitCode: 0, stdout: 'main\n' }, 'docs/plans');
    const lines = await runStatus($);
    expect(lines.length).toBe(1);
    expect(lines[0].startsWith('opm status: could not list docs/plans')).toBe(true);
  });
});
