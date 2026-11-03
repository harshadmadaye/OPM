'use strict';
// Human-gate checks: the developer chooses the review cadence (after each phase by
// default, or only at the end with an expected commit count, logged as a decision),
// an exposed secret that must be rotated blocks the run at once, and every skill gives
// the same list of what stops a run.
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

const MILESTONE_EXECUTING = 'skills/milestone-planning/references/executing-a-phase.md';
const STOP_LIST_HEADING = /^#{2,3} What stops a run$/m;

function stopListSection(file) {
  const text = read(file);
  const start = text.search(STOP_LIST_HEADING);
  assert.notEqual(start, -1, `${file} has no "What stops a run" heading`);
  const body = text.slice(text.indexOf('\n', start) + 1);
  const end = body.search(/^#{2,3} /m);
  return end === -1 ? body : body.slice(0, end);
}

function numberedItems(text) {
  return text.split('\n').filter((line) => /^\d+\. /.test(line)).map((line) => line.trim());
}

for (const file of [BUILD_AND_RUN, MILESTONE_EXECUTING]) {
  test(`A: ${file} states the three-part stop list`, () => {
    const text = flatten(stopListSection(file));
    assert.match(text, /stops only for/i, `${file} must say a run stops only for the listed cases`);
    assert.match(text, /four stop conditions[^.]*rulings-and-models\.md/i, `${file} must point to the four stop conditions`);
    assert.match(text, /stop condition 2[^.]*exposed secret[^.]*rotated/i, `${file} must place the exposed secret under stop condition 2`);
    assert.match(text, /`checkpoint:human-action`[^.]*no CLI or API/i, `${file} must list checkpoint:human-action`);
    assert.match(text, /review-cadence pause[^.]*phase close[^.]*after each phase/i, `${file} must list the review-cadence pause`);
    assert.match(text, /pause is a stop for reading, not a question/i, `${file} must say a pause is not a question`);
    assert.match(text, /`checkpoint:human-verify`[^.]*REVIEW-QUEUE\.md/, `${file} must route human-verify to the review queue`);
    assert.match(text, /`checkpoint:decision`[^.]*ruled by the orchestrator[^.]*logged/i, `${file} must say decisions are ruled and logged`);
    assert.match(text, /Nothing else stops the run/, `${file} must close the list`);
  });
}

test('A: the stop list is the same in jump-start and milestone-planning', () => {
  const jumpStart = numberedItems(stopListSection(BUILD_AND_RUN));
  const milestone = numberedItems(stopListSection(MILESTONE_EXECUTING));
  assert.equal(jumpStart.length, 3, 'build-and-run.md stop list must have three items');
  assert.deepEqual(jumpStart, milestone);
});

test('B: jump-start Phase 4 names the stops in its explanation', () => {
  const phase4 = flatten(section(read(JUMP_START), /^## Phase 4/m, /^## Phase 5/m));
  assert.match(phase4, /stop conditions/i, 'Phase 4 must name the stop conditions');
  assert.match(phase4, /`checkpoint:human-action`/, 'Phase 4 must name checkpoint:human-action');
  assert.match(phase4, /phase close/i, 'Phase 4 must name the phase-close review pause');
  assert.match(phase4, /no questions outside/i, 'Phase 4 must say no questions outside the list');
});

test('C: milestone-planning Start asks the cadence only when none is logged and states the default', () => {
  const step1 = flatten(section(read(MILESTONE), /^1\. \*\*Start\*\*/m, /^2\. \*\*Plan a phase/m));
  assert.match(step1, /only when no cadence is logged/i, 'Start must ask only when no cadence is logged');
  assert.match(step1, /DECISIONS\.md/, 'Start must check jump-start\'s DECISIONS.md');
  assert.match(step1, /no logged cadence[^.]*after each phase/i, 'Start must state the default for a milestone with no logged cadence');
});

test('D: a subagent returns an exposed secret as a BLOCKING checkpoint; running plans finish, nothing new starts', () => {
  const reviewer = flatten(read(SECURITY_REVIEWER));
  assert.match(reviewer, /return[^.]*BLOCKING checkpoint to the orchestrator/i, 'security-reviewer must return a BLOCKING checkpoint to the orchestrator');
  const orchestration = flatten(read(MILESTONE_EXECUTING) + ' ' + read(BUILD_AND_RUN));
  assert.match(orchestration, /plans already running[^.]*finish/i, 'running plans must be allowed to finish');
  assert.match(orchestration, /starts nothing new/i, 'nothing new may start');
});

function listMarkdownFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(rel);
    return entry.name.endsWith('.md') ? [rel] : [];
  });
}

test('E: no skill or agent calls the secret gate "the one case"', () => {
  const offenders = [...listMarkdownFiles('skills'), ...listMarkdownFiles('agents')]
    .filter((file) => /the one case/i.test(read(file)));
  assert.deepEqual(offenders, []);
});
