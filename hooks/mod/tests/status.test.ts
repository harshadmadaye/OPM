import { describe, expect, mock, test } from 'claude-code/testing';
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
import { formatAllStatus, pruneStatusEntries, statusKey } from '../status.mjs';

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
    expect(registered).toContainEqual(expect.objectContaining({ name: COMMAND, immediate: true, argumentHint: '[--all]' }));
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

// Snapshot recording: a per-repo entry in $.store, refreshed after each turn.

const STATUS_PREFIX = 'opm.status.';
const REPO_ROOT = '/Users/dev/widget';
const SESSION_ID = 'session-1';
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = UPDATED_AT_MS + 60_000;
const MAX_STATUS_BYTES = 64 * 1024;

type StatusEntry = {
  sessionId: string;
  repoPath: string;
  branch: string | null;
  ledgerPath: string;
  planPath: string;
  tasksDone: number;
  tasksTotal: number | null;
  currentTaskTitle: string | null;
  lastSeenAt: number;
  sourceMtimeMs: number;
};

type Store = { store: Map<string, unknown>; sets: string[]; logs: string[] };

function entryFor(repoPath: string, lastSeenAt: number, overrides: Partial<StatusEntry> = {}): StatusEntry {
  return {
    sessionId: 'old-session',
    repoPath,
    branch: 'main',
    ledgerPath: 'docs/plans/2026-09-20-other.progress.md',
    planPath: 'docs/plans/2026-09-20-other.md',
    tasksDone: 1,
    tasksTotal: 4,
    currentTaskTitle: 'Task 2 Other work',
    lastSeenAt,
    sourceMtimeMs: lastSeenAt,
    ...overrides,
  };
}

// The store beneath the mod: a Map the test reads, the session and clock it
// sees, the core answer for turn.complete, and captured log lines.
function serveStore(on: On, initial: Record<string, unknown> = {}, options: { failSet?: boolean; root?: string } = {}): Store {
  const store = new Map<string, unknown>(Object.entries(initial));
  const sets: string[] = [];
  const logs: string[] = [];
  on('store.get', (_$, e) => ({ value: store.get(e.key) }));
  on('store.keys', () => ({ value: [...store.keys()] }));
  on('store.delete', (_$, e) => {
    store.delete(e.key);
    return { value: undefined };
  });
  on('store.set', (_$, e) => {
    if (options.failSet) return { deny: 'store full' };
    sets.push(e.key);
    store.set(e.key, JSON.parse(JSON.stringify(e.value)));
    return { value: undefined };
  });
  on('session.root', () => ({ value: options.root ?? REPO_ROOT }));
  on('session.cwd', () => ({ value: options.root ?? REPO_ROOT }));
  on('session.id', () => ({ value: SESSION_ID }));
  mock.clock(on, { now: NOW_MS });
  on('turn.complete', (_$, e) => ({ text: e.answer, usage: e.usage }));
  on('ui.log', (_$, e) => {
    logs.push(e.text);
    return { value: undefined };
  });
  return { store, sets, logs };
}

async function completeTurn($: Engine) {
  return $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' });
}

const statusKeys = (store: Map<string, unknown>) => [...store.keys()].filter((key) => key.startsWith(STATUS_PREFIX));

function freshRepo(): FakeRepo {
  return Object.fromEntries(Object.entries(OPEN_REPO).map(([path, file]) => [path, { ...file }]));
}

describe('status snapshots', () => {
  test('a turn writes the repo snapshot under a hashed key and returns the turn unchanged', async ($, on) => {
    serveRepo(on, freshRepo(), { exitCode: 0, stdout: 'feat/widget\n' });
    const { store } = serveStore(on);
    const result = await completeTurn($);
    expect(result.text).toBe('done');
    const keys = statusKeys(store);
    expect(keys).toEqual([statusKey(REPO_ROOT)]);
    expect(/^opm\.status\.[0-9a-f]{16}$/.test(keys[0])).toBe(true);
    expect(store.get(keys[0])).toEqual({
      sessionId: SESSION_ID,
      repoPath: REPO_ROOT,
      branch: 'feat/widget',
      ledgerPath: 'docs/plans/2026-10-01-widget.progress.md',
      planPath: 'docs/plans/2026-10-01-widget.md',
      tasksDone: 1,
      tasksTotal: 3,
      currentTaskTitle: 'Task 2 Widget view',
      lastSeenAt: NOW_MS,
      sourceMtimeMs: UPDATED_AT_MS + 1000,
    });
  });

  test('no store key holds the repo path', async ($, on) => {
    serveRepo(on, freshRepo(), { exitCode: 0, stdout: 'main\n' });
    const { store } = serveStore(on);
    await completeTurn($);
    for (const key of store.keys()) expect(key.includes('/') || key.includes('widget')).toBe(false);
  });

  test('an unchanged ledger is not written again; a changed one is', async ($, on) => {
    const repo = freshRepo();
    serveRepo(on, repo, { exitCode: 0, stdout: 'main\n' });
    const { sets } = serveStore(on);
    await completeTurn($);
    await completeTurn($);
    expect(sets.length).toBe(1);
    repo['docs/plans/2026-10-01-widget.progress.md'].mtimeMs = UPDATED_AT_MS + 5000;
    await completeTurn($);
    expect(sets.length).toBe(2);
  });

  test('a ledger that became complete drops its entry', async ($, on) => {
    const key = statusKey(REPO_ROOT);
    serveRepo(on, { 'docs/plans/2026-09-01-done.progress.md': { text: COMPLETE_LEDGER, mtimeMs: UPDATED_AT_MS } }, { exitCode: 0, stdout: 'main\n' });
    const { store } = serveStore(on, { [key]: entryFor(REPO_ROOT, NOW_MS - DAY_MS) });
    await completeTurn($);
    expect(store.has(key)).toBe(false);
  });

  test('a write prunes entries older than 14 days and complete ones', async ($, on) => {
    const oldKey = statusKey('/Users/dev/old');
    const doneKey = statusKey('/Users/dev/done');
    const liveKey = statusKey('/Users/dev/live');
    serveRepo(on, freshRepo(), { exitCode: 0, stdout: 'main\n' });
    const { store } = serveStore(on, {
      [oldKey]: entryFor('/Users/dev/old', NOW_MS - 15 * DAY_MS),
      [doneKey]: entryFor('/Users/dev/done', NOW_MS - DAY_MS, { tasksDone: 4, tasksTotal: 4 }),
      [liveKey]: entryFor('/Users/dev/live', NOW_MS - 2 * DAY_MS),
      'opm.meter': [],
    });
    await completeTurn($);
    expect(statusKeys(store).sort()).toEqual([liveKey, statusKey(REPO_ROOT)].sort());
    expect(store.has('opm.meter')).toBe(true);
  });

  test('a store failure goes to the debug log and never breaks the turn', async ($, on) => {
    serveRepo(on, freshRepo(), { exitCode: 0, stdout: 'main\n' });
    const { logs } = serveStore(on, {}, { failSet: true });
    const result = await completeTurn($);
    expect(result.text).toBe('done');
    expect(logs.length).toBe(1);
    expect(logs[0].startsWith('opm: status could not record the snapshot')).toBe(true);
  });

  test('/opm-status refreshes the snapshot too', async ($, on) => {
    serveRepo(on, freshRepo(), { exitCode: 0, stdout: 'main\n' });
    const { store } = serveStore(on);
    await runStatus($);
    expect(statusKeys(store)).toEqual([statusKey(REPO_ROOT)]);
  });
});

describe('pruneStatusEntries', () => {
  test('keeps the newest entries under the byte cap', () => {
    const entries = Array.from({ length: 400 }, (_, i) => {
      const repoPath = `/Users/dev/project-${i}-${'x'.repeat(60)}`;
      return { key: statusKey(repoPath), value: entryFor(repoPath, NOW_MS - (i + 1) * 60_000) };
    });
    const dropped = new Set(pruneStatusEntries(entries, NOW_MS));
    const kept = entries.filter((entry) => !dropped.has(entry.key));
    const size = kept.reduce((total, entry) => total + entry.key.length + JSON.stringify(entry.value).length, 0);
    expect(size <= MAX_STATUS_BYTES).toBe(true);
    expect(kept.length > 100).toBe(true);
    expect(dropped.has(entries[0].key)).toBe(false);
    expect(dropped.has(entries[entries.length - 1].key)).toBe(true);
  });

  test('drops values that are not status entries', () => {
    expect(pruneStatusEntries([{ key: 'opm.status.0000000000000000', value: 'junk' }], NOW_MS)).toEqual(['opm.status.0000000000000000']);
  });
});

// /opm-status --all: every open plan on this machine, from the store alone.

const MAX_ALL_LINES = 30;
const MAX_ALL_ROWS = 25;
const ALL_FOOTER = /^\d+ projects, cache only: run \/opm-status in a repo for its live state$/;
const SEEN = '\\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d';

async function runAll($: Engine, args = '--all'): Promise<string[]> {
  await $.session.start({ cwd: REPO_ROOT, surface: null, isInteractive: false });
  const result = await $.command.run({ command: COMMAND, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } });
  const lines = (result.text ?? '').split('\n');
  expect(lines.length <= MAX_ALL_LINES).toBe(true);
  return lines;
}

describe('/opm-status --all', () => {
  test('two repos with open plans are two rows, newest first, then the footer', async ($, on) => {
    serveRepo(on, { 'README.md': { text: '# hi', mtimeMs: OLDER_MS } }, { exitCode: 0, stdout: 'main\n' });
    serveStore(on, {
      [statusKey('/Users/dev/older-app')]: entryFor('/Users/dev/older-app', NOW_MS - 2 * DAY_MS),
      [statusKey('/Users/dev/newer-app')]: entryFor('/Users/dev/newer-app', NOW_MS - 60_000, { planPath: 'docs/plans/2026-10-04-api.md', tasksDone: 2, tasksTotal: 5, currentTaskTitle: 'Task 3 API routes' }),
    });
    const lines = await runAll($);
    expect(lines.length).toBe(3);
    expect(new RegExp(`^newer-app: 2026-10-04-api\\.md 2/5, Task 3 API routes, seen ${SEEN}$`).test(lines[0])).toBe(true);
    expect(new RegExp(`^older-app: 2026-09-20-other\\.md 1/4, Task 2 Other work, seen ${SEEN}$`).test(lines[1])).toBe(true);
    expect(lines[2]).toBe('2 projects, cache only: run /opm-status in a repo for its live state');
  });

  test('an empty store says no plans are recorded', async ($, on) => {
    serveRepo(on, { 'README.md': { text: '# hi', mtimeMs: OLDER_MS } }, { exitCode: 0, stdout: 'main\n' });
    serveStore(on, { 'opm.meter': [] });
    expect(await runAll($)).toEqual(['no open plans recorded on this machine yet']);
  });

  test('the current repo is refreshed before listing', async ($, on) => {
    serveRepo(on, freshRepo(), { exitCode: 0, stdout: 'main\n' });
    serveStore(on);
    const lines = await runAll($);
    expect(lines[0].startsWith('widget: 2026-10-01-widget.md 1/3, Task 2 Widget view, seen ')).toBe(true);
  });

  test('an unknown option names itself', async ($, on) => {
    serveRepo(on, freshRepo(), { exitCode: 0, stdout: 'main\n' });
    serveStore(on);
    expect(await runAll($, '--everything')).toEqual(['opm: unknown option "--everything"; use --all']);
  });
});

describe('formatAllStatus', () => {
  test('marks rows older than 3 days stale and truncates long titles to 40 characters', () => {
    const lines = formatAllStatus([
      entryFor('/Users/dev/quiet', NOW_MS - 4 * DAY_MS, { currentTaskTitle: `Task 9 ${'very long title '.repeat(5)}` }),
    ], NOW_MS);
    expect(lines.length).toBe(2);
    expect(lines[0].endsWith(' (stale)')).toBe(true);
    const title = lines[0].split(', ')[1];
    expect(title.length).toBe(40);
    expect(title.endsWith('...')).toBe(true);
  });

  test('shows at most 25 rows and counts every project in the footer', () => {
    const entries = Array.from({ length: 40 }, (_, i) => entryFor(`/Users/dev/p${i}`, NOW_MS - i * 60_000));
    const lines = formatAllStatus(entries, NOW_MS);
    expect(lines.length).toBe(MAX_ALL_ROWS + 1);
    expect(lines[0].startsWith('p0: ')).toBe(true);
    expect(ALL_FOOTER.test(lines[MAX_ALL_ROWS])).toBe(true);
    expect(lines[MAX_ALL_ROWS].startsWith('40 projects')).toBe(true);
  });

  test('an entry with no task title or total still reads', () => {
    const [row] = formatAllStatus([entryFor('C:\\work\\winapp\\', NOW_MS, { tasksTotal: null, currentTaskTitle: null })], NOW_MS);
    expect(new RegExp(`^winapp: 2026-09-20-other\\.md 1/\\?, no current task, seen ${SEEN}$`).test(row)).toBe(true);
  });
});
