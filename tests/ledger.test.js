'use strict';
// Tests for the shared ledger parser. Run with: node --test tests/ledger.test.js
// bin/lib/ledger.mjs is an ES module of pure functions, so this CommonJS file
// loads it with a dynamic import() and feeds it file text directly.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'bin', 'lib', 'ledger.mjs');
const FIXTURES = path.join(__dirname, 'fixtures', 'ledgers');
const MAX_STATUS_LINES = 5;

const loadLedger = () => import(pathToFileURL(MODULE_PATH).href);
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const OPEN_LEDGER = [
  '# OPM ledger - plan: docs/plans/2026-10-01-auth.md',
  'Branch: feat/auth  Base: 1234567',
  'Ruling: tokens live in memory - simplest - costs a re-login',
  'Task 1: complete (commits a..b, review clean)',
  'Task 2: complete (commits b..c, review clean)',
  'Task 3: fix round 2/3 (1 addressed, 1 open - missing 401 path; commits c..d)',
].join('\n');

const PLAN_TEXT = [
  '# Auth plan',
  '### Task 1: Session model',
  '### Task 2: Login route',
  '### Task 3: Logout route',
  '### Task 4: Docs and version',
].join('\n');

test('parses the real brew-idea ledger as complete', async () => {
  const { parseLedger } = await loadLedger();
  const result = parseLedger(fixture('2026-09-16-brew-idea.progress.md'));
  assert.equal(result.error, null);
  assert.equal(result.planPath, 'docs/plans/2026-09-16-brew-idea.md');
  assert.equal(result.tasksDone, 3);
  assert.equal(result.tasksTotal, 3);
  assert.equal(result.isComplete, true);
  assert.equal(result.currentTask, null);
  assert.deepEqual(result.fixRound, { task: null, round: 1, max: 1 });
  assert.match(result.lastRuling, /^fixed pre-existing README test command/);
});

test('parses the real story-video ledger with repeated task lines', async () => {
  const { parseLedger } = await loadLedger();
  const result = parseLedger(fixture('2026-09-21-story-video.progress.md'));
  assert.equal(result.error, null);
  assert.equal(result.planPath, 'docs/plans/2026-09-21-story-video.md');
  assert.equal(result.tasksDone, 11);
  assert.equal(result.tasksTotal, 11);
  assert.equal(result.isComplete, true);
  assert.deepEqual(result.fixRound, { task: null, round: 2, max: 3 });
  assert.match(result.lastRuling, /^fixed the four flow labels myself/);
});

test('plan text sets the total and the current task title', async () => {
  const { parseLedger } = await loadLedger();
  const result = parseLedger(OPEN_LEDGER, PLAN_TEXT);
  assert.equal(result.error, null);
  assert.equal(result.tasksDone, 2);
  assert.equal(result.tasksTotal, 4);
  assert.equal(result.isComplete, false);
  assert.deepEqual(result.currentTask, { number: 3, title: 'Logout route' });
  assert.deepEqual(result.fixRound, { task: 3, round: 2, max: 3 });
  assert.equal(result.lastRuling, 'tokens live in memory - simplest - costs a re-login');
});

test('without a plan or a Mode line the total is unknown and the ledger stays open', async () => {
  const { parseLedger } = await loadLedger();
  const result = parseLedger(OPEN_LEDGER);
  assert.equal(result.tasksTotal, null);
  assert.equal(result.isComplete, false);
  assert.deepEqual(result.currentTask, { number: 3, title: null });
});

test('a ledger with no task lines starts at Task 1', async () => {
  const { parseLedger } = await loadLedger();
  const result = parseLedger('# OPM ledger - plan: docs/plans/x.md\nBranch: main\n', PLAN_TEXT);
  assert.equal(result.error, null);
  assert.equal(result.tasksDone, 0);
  assert.deepEqual(result.currentTask, { number: 1, title: 'Session model' });
  assert.equal(result.fixRound, null);
  assert.equal(result.lastRuling, null);
});

test('all tasks complete per the plan makes the ledger complete', async () => {
  const { parseLedger } = await loadLedger();
  const text = ['# OPM ledger - plan: docs/plans/x.md', 'Task 1: complete', 'Task 2: complete', 'Task 3: complete', 'Task 4: complete'].join('\n');
  const result = parseLedger(text, PLAN_TEXT);
  assert.equal(result.isComplete, true);
  assert.equal(result.currentTask, null);
});

test('CRLF line endings parse the same as LF', async () => {
  const { parseLedger } = await loadLedger();
  const lf = parseLedger(OPEN_LEDGER, PLAN_TEXT);
  const crlf = parseLedger(OPEN_LEDGER.replace(/\n/g, '\r\n'), PLAN_TEXT.replace(/\n/g, '\r\n'));
  assert.deepEqual(crlf, lf);
});

test('empty and malformed input returns an error naming the first bad line, never throws', async () => {
  const { parseLedger } = await loadLedger();
  assert.match(parseLedger('').error, /empty/);
  assert.match(parseLedger(undefined).error, /empty/);
  assert.match(parseLedger('# Some other file\nTask 1: complete').error, /line 1/);
  const badTask = parseLedger('# OPM ledger - plan: docs/plans/x.md\nTask one: complete');
  assert.match(badTask.error, /line 2/);
  assert.match(badTask.error, /Task one: complete/);
  assert.equal(badTask.isComplete, false);
});

test('parseMilestoneState reads phase, plan and status', async () => {
  const { parseMilestoneState } = await loadLedger();
  const text = '# State\n\nPhase: 3 of 4 (First mod)\r\nPlan: 0 of 6 in this phase\nStatus: Ready to execute\n';
  assert.deepEqual(parseMilestoneState(text), { phase: 3, phaseTotal: 4, plan: 0, planTotal: 6, status: 'Ready to execute' });
  assert.equal(parseMilestoneState('no state here'), null);
  assert.equal(parseMilestoneState(null), null);
});

test('formatStatus prints at most five lines for an open ledger', async () => {
  const { parseLedger, formatStatus } = await loadLedger();
  const ledger = parseLedger(OPEN_LEDGER, PLAN_TEXT);
  const lines = formatStatus({
    ledger,
    ledgerPath: 'docs/plans/2026-10-01-auth.progress.md',
    milestone: { phase: 3, phaseTotal: 4, plan: 1, planTotal: 6, status: 'In progress' },
    branch: 'feat/auth',
    updatedAt: new Date(2026, 9, 5, 14, 3),
  });
  assert.ok(lines.length <= MAX_STATUS_LINES);
  assert.equal(lines[0], 'plan: docs/plans/2026-10-01-auth.md (ledger docs/plans/2026-10-01-auth.progress.md)');
  assert.equal(lines[1], 'progress: 2/4, current: Task 3 Logout route');
  assert.equal(lines[2], 'fix round 2/3 on Task 3');
  assert.equal(lines[3], 'updated 2026-10-05 14:03 on feat/auth; milestone phase 3/4, plan 1/6 (In progress)');
  assert.equal(lines[4], 'next: ask Claude to resume the plan');
});

test('formatStatus falls back to the last ruling and handles empty and malformed states', async () => {
  const { parseLedger, formatStatus } = await loadLedger();
  const ledger = parseLedger('# OPM ledger - plan: docs/plans/x.md\nRuling: keep it\nTask 1: complete');
  const lines = formatStatus({ ledger });
  assert.deepEqual(lines, ['plan: docs/plans/x.md', 'progress: 1/?, current: Task 2', 'last ruling: keep it', 'next: ask Claude to resume the plan']);
  assert.deepEqual(formatStatus({ ledger: null }), ['no open ledger in this repo']);
  const bad = formatStatus({ ledger: parseLedger('junk'), ledgerPath: 'docs/plans/x.progress.md' });
  assert.equal(bad.length, 1);
  assert.match(bad[0], /docs\/plans\/x\.progress\.md/);
});

test('formatResumeLine gives one line for an open ledger and null otherwise', async () => {
  const { parseLedger, formatResumeLine } = await loadLedger();
  const line = formatResumeLine({ ledger: parseLedger(OPEN_LEDGER, PLAN_TEXT), ledgerPath: 'docs/plans/2026-10-01-auth.progress.md' });
  assert.equal(typeof line, 'string');
  assert.doesNotMatch(line, /\n/);
  assert.match(line, /docs\/plans\/2026-10-01-auth\.progress\.md/);
  assert.match(line, /2 of 4/);
  assert.match(line, /Task 3/);
  assert.equal(formatResumeLine({ ledger: parseLedger(fixture('2026-09-16-brew-idea.progress.md')) }), null);
  assert.equal(formatResumeLine({ ledger: parseLedger('junk') }), null);
  assert.equal(formatResumeLine({ ledger: null }), null);
});

test('the parser module uses no Node APIs', () => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.doesNotMatch(source, /\bimport\b[^;]*from|\brequire\(|\bprocess\.|\bfs\.|\bpath\./);
});
