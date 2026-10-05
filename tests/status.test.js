'use strict';
// Tests for `npx opm-core status`. Run with: node --test tests/status.test.js
// Each test builds a throwaway repo with docs/plans ledgers and runs the real
// CLI through bin/install.js, exactly as npx would.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INSTALL = path.resolve(__dirname, '..', 'bin', 'install.js');
const MAX_STATUS_LINES = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-status-test-'));

test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const OPEN_LEDGER = [
  '# OPM ledger - plan: docs/plans/2026-10-01-auth.md',
  'Ruling: tokens live in memory - simplest - costs a re-login',
  'Task 1: complete (commits a..b, review clean)',
].join('\n');
const PLAN = '# Auth\n### Task 1: Session model\n### Task 2: Login route\n### Task 3: Docs\n';
const DONE_LEDGER = '# OPM ledger - plan: docs/plans/2026-09-01-old.md\nMode: inline (1 tasks)\nTask 1: complete\n';

function makeRepo(name, files) {
  const repo = path.join(tmpRoot, name);
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(repo, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
  }
  fs.mkdirSync(repo, { recursive: true });
  return repo;
}

function setMtime(file, msAgo) {
  const time = new Date(Date.now() - msAgo);
  fs.utimesSync(file, time, time);
}

function runStatus(repo, args = []) {
  const result = spawnSync(process.execPath, [INSTALL, 'status', ...args, repo], { encoding: 'utf8', timeout: 20000 });
  return { status: result.status, lines: (result.stdout || '').trim().split('\n').filter(Boolean), stderr: result.stderr || '' };
}

test('status prints the open ledger in at most five lines', () => {
  const repo = makeRepo('open', {
    'docs/plans/2026-10-01-auth.md': PLAN,
    'docs/plans/2026-10-01-auth.progress.md': OPEN_LEDGER,
    'docs/plans/2026-09-01-old.progress.md': DONE_LEDGER,
    'docs/milestones/m1/STATE.md': 'Phase: 2 of 3 (Core)\nPlan: 1 of 4\nStatus: In progress\n',
  });
  setMtime(path.join(repo, 'docs/plans/2026-09-01-old.progress.md'), 0);
  setMtime(path.join(repo, 'docs/plans/2026-10-01-auth.progress.md'), ONE_HOUR_MS);
  const { status, lines } = runStatus(repo);
  assert.equal(status, 0);
  assert.ok(lines.length <= MAX_STATUS_LINES, lines.join('\n'));
  assert.equal(lines[0], 'plan: docs/plans/2026-10-01-auth.md (ledger docs/plans/2026-10-01-auth.progress.md)');
  assert.equal(lines[1], 'progress: 1/3, current: Task 2 Login route');
  assert.equal(lines[2], 'last ruling: tokens live in memory - simplest - costs a re-login');
  assert.match(lines[3], /^updated \d{4}-\d\d-\d\d \d\d:\d\d.*milestone phase 2\/3, plan 1\/4 \(In progress\)$/);
  assert.equal(lines[4], 'next: ask Claude to resume the plan');
});

test('status with no ledgers or only complete ones prints the empty state', () => {
  const empty = makeRepo('empty', { 'README.md': '# x\n' });
  assert.deepEqual(runStatus(empty).lines, ['no open ledger in this repo']);
  const done = makeRepo('done', { 'docs/plans/2026-09-01-old.progress.md': DONE_LEDGER });
  const result = runStatus(done);
  assert.equal(result.status, 0);
  assert.deepEqual(result.lines, ['no open ledger in this repo']);
});

test('a malformed ledger prints one line naming the file and exits 0', () => {
  const repo = makeRepo('bad', { 'docs/plans/2026-10-02-bad.progress.md': 'not a ledger\n' });
  const { status, lines } = runStatus(repo);
  assert.equal(status, 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /docs\/plans\/2026-10-02-bad\.progress\.md/);
});

test('status --help prints usage and an unknown option fails clearly', () => {
  const help = runStatus(tmpRoot, ['--help']);
  assert.equal(help.status, 0);
  assert.match(help.lines[0], /opm-core status/);
  const bad = runStatus(tmpRoot, ['--bogus']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown status option: --bogus/);
});

test('findOpenLedger returns null outside a repo and never reads a plan outside the repo', async () => {
  const { findOpenLedger } = require('../bin/status');
  assert.equal(await findOpenLedger(path.join(tmpRoot, 'does-not-exist')), null);
  fs.writeFileSync(path.join(tmpRoot, 'outside.md'), '### Task 1: a\n### Task 2: b\n');
  const repo = makeRepo('escape', { 'docs/plans/x.progress.md': '# OPM ledger - plan: ../outside.md\nTask 1: complete\n' });
  const found = await findOpenLedger(repo);
  assert.equal(found.ledger.tasksTotal, null);
  assert.equal(found.ledgerPath, 'docs/plans/x.progress.md');
});
