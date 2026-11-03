'use strict';
// Review-queue checks: in an unattended run a human-verify checkpoint is queued in
// REVIEW-QUEUE.md with its evidence, never ticked by an agent; STATE and the final
// reports surface pending checks first; a queued check does not block later plans
// unless they depend on it.
// Run with: node --test tests/review-queue.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_TEMPLATE = 'skills/milestone-planning/templates/review-queue.md';
const STATE_TEMPLATE = 'skills/milestone-planning/templates/state.md';
const MILESTONE = 'skills/milestone-planning/SKILL.md';
const MILESTONE_EXECUTING = 'skills/milestone-planning/references/executing-a-phase.md';
const BUILD_AND_RUN = 'skills/jump-start/references/build-and-run.md';
const FINAL_REPORT = 'skills/jump-start/templates/final-report.md';
const FINISHING = 'skills/executing-plans/references/finishing.md';

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const flatten = (text) => text.replace(/\s+/g, ' ');

test('A: review-queue template has the table and says only a person sets passed or failed', () => {
  assert.ok(fs.existsSync(path.join(ROOT, QUEUE_TEMPLATE)), `${QUEUE_TEMPLATE} must exist`);
  const text = flatten(read(QUEUE_TEMPLATE));
  assert.match(
    text,
    /\| ID \| Plan \| What to check \| How to check \| Evidence \| Status \| Checked by \|/,
    `${QUEUE_TEMPLATE} needs the table header`,
  );
  assert.match(
    text,
    /only a person sets Status to passed or failed/i,
    `${QUEUE_TEMPLATE} must say only a person sets Status to passed or failed`,
  );
});

test('B: milestone-planning Checkpoint types queues human-verify in unattended runs', () => {
  const text = flatten(read(MILESTONE));
  const start = text.indexOf('## Checkpoint types');
  assert.notEqual(start, -1, `${MILESTONE} needs a Checkpoint types section`);
  const rest = text.slice(start + 1);
  const next = rest.search(/ ## /);
  const body = next === -1 ? rest : rest.slice(0, next);
  assert.match(body, /unattended/i, `${MILESTONE} Checkpoint types must mention unattended runs`);
  assert.match(body, /REVIEW-QUEUE\.md/, `${MILESTONE} Checkpoint types must name REVIEW-QUEUE.md`);
  assert.match(body, /never marks? (them|it) passed/i, `${MILESTONE} must say the agent never marks them passed`);
});

test('C: state template shows "complete, N human checks pending"', () => {
  assert.ok(
    read(STATE_TEMPLATE).includes('complete, N human checks pending'),
    `${STATE_TEMPLATE} must contain "complete, N human checks pending"`,
  );
});

test('D: final reports put "Human checks pending" before everything else', () => {
  const report = read(FINAL_REPORT);
  const reportAt = report.indexOf('Human checks pending');
  assert.notEqual(reportAt, -1, `${FINAL_REPORT} needs a "Human checks pending" heading`);
  assert.ok(reportAt < report.indexOf('## Where'), `${FINAL_REPORT}: Human checks pending must come before Where`);

  const finishing = read(FINISHING);
  const finishingAt = finishing.indexOf('Human checks pending');
  assert.notEqual(finishingAt, -1, `${FINISHING} needs a "Human checks pending" step`);
  assert.ok(
    finishingAt < finishing.indexOf('Final whole-branch review'),
    `${FINISHING}: Human checks pending must come before the final review step`,
  );
});

test('E: a queued check does not block the next plan unless a later plan depends on it', () => {
  for (const file of [MILESTONE_EXECUTING, BUILD_AND_RUN]) {
    const text = flatten(read(file));
    assert.match(
      text,
      /queued check does not block the next plan unless a later plan depends on what it verifies/i,
      `${file} must say a queued check does not block the next plan unless a later plan depends on what it verifies`,
    );
  }
});
