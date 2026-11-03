'use strict';
// Human-gate checks: the developer chooses the review cadence (after each phase by
// default, or only at the end with an expected commit count, logged as a decision),
// and an exposed secret that must be rotated blocks the run at once.
// Run with: node --test tests/human-gates.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const JUMP_START = 'skills/jump-start/SKILL.md';
const BUILD_AND_RUN = 'skills/jump-start/references/build-and-run.md';
const MILESTONE = 'skills/milestone-planning/SKILL.md';
const RULINGS = 'skills/executing-plans/references/rulings-and-models.md';
const FULL_LOOP = 'skills/verification-before-completion/references/full-loop.md';
const SECURITY_REVIEWER = 'agents/security-reviewer.md';

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const flatten = (text) => text.replace(/\s+/g, ' ');

function section(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  assert.notEqual(start, -1, `section start ${startPattern} not found`);
  const rest = text.slice(start + 1);
  const end = rest.search(endPattern);
  return end === -1 ? text.slice(start) : text.slice(start, start + 1 + end);
}

function assertCadence(file, text) {
  assert.match(text, /after each phase/i, `${file} must offer "after each phase"`);
  assert.match(text, /after each phase[^.]*default|default[^.]*after each phase/i, `${file} must mark "after each phase" as the default`);
  assert.match(text, /only at the end/i, `${file} must offer "only at the end"`);
  assert.match(text, /commit count|commits/i, `${file} must show the expected commit count`);
  assert.match(text, /decision/i, `${file} must log the choice as a decision`);
}

test('A1: jump-start Phase 4 offers the review cadence choice', () => {
  const phase4 = flatten(section(read(JUMP_START), /^## Phase 4/m, /^## Phase 5/m));
  assertCadence(JUMP_START, phase4);
});

test('A2: milestone-planning lifecycle step 1 offers the review cadence choice', () => {
  const lifecycle = read(MILESTONE);
  const step1 = flatten(section(lifecycle, /^1\. \*\*Start\*\*/m, /^2\. \*\*Plan a phase/m));
  assertCadence(MILESTONE, step1);
});

for (const file of [RULINGS, FULL_LOOP, SECURITY_REVIEWER]) {
  test(`B: ${file} blocks at once on a secret that must be rotated`, () => {
    const text = flatten(read(file));
    assert.match(text, /`checkpoint:human-action`/, `${file} must name checkpoint:human-action`);
    assert.match(text, /blocking/i, `${file} must say the checkpoint is blocking`);
    assert.match(text, /rotat/i, `${file} must name rotation`);
    assert.match(text, /where it is used/i, `${file} must name where the secret is used`);
    assert.match(text, /release checklist/i, `${file} must say it does not wait for a release checklist`);
  });
}

test('B: security-reviewer marks the finding "BLOCKING: rotate <what>"', () => {
  assert.match(read(SECURITY_REVIEWER), /BLOCKING: rotate <what>/);
});

test('B: jump-start (SKILL.md or build-and-run.md) blocks at once on a secret that must be rotated', () => {
  const text = flatten(read(JUMP_START) + ' ' + read(BUILD_AND_RUN));
  assert.match(text, /`checkpoint:human-action`/, 'jump-start must name checkpoint:human-action');
  assert.match(text, /rotat/i, 'jump-start must name rotation');
  assert.match(text, /where it is used/i, 'jump-start must name where the secret is used');
  assert.match(text, /release checklist/i, 'jump-start must say it does not wait for a release checklist');
});

test('C: jump-start names the exposed secret as the one case where the build stops to ask', () => {
  const text = flatten(read(JUMP_START) + ' ' + read(BUILD_AND_RUN));
  assert.match(
    text,
    /(one|only) (case|exception)[^.]*(stops?|ask)|(stops?|ask)[^.]*(one|only) (case|exception)/i,
    'jump-start must say this is the one case where the run stops to ask during the build',
  );
});
