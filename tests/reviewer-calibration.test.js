'use strict';
// Reviewer calibration checks: every finding states its confidence and the exact line it
// cites, and final reports count findings by severity and outcome (fixed, parked, dismissed).
// Run with: node --test tests/reviewer-calibration.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const AGENTS = [
  'agents/code-reviewer.md',
  'agents/security-reviewer.md',
  'agents/silent-failure-hunter.md',
  'agents/typescript-reviewer.md',
];
const REVIEWER_PROMPT = 'skills/executing-plans/references/reviewer.md';
const FINISHING = 'skills/executing-plans/references/finishing.md';
const FINAL_REPORT = 'skills/jump-start/templates/final-report.md';
const REVIEW_PACK = 'skills/milestone-planning/templates/review-pack.md';

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const flatten = (text) => text.replace(/\s+/g, ' ');
const frontmatter = (text) => text.split('---')[1];

function findingsHeader(text) {
  const line = text.split('\n').find((l) => /^\|\s*Severity\s*\|/.test(l));
  return line ? line.split('|').map((c) => c.trim()).filter(Boolean) : [];
}

for (const file of AGENTS) {
  test(`A: ${file} output shows Confidence, a cited line, and drops uncited findings`, () => {
    const text = read(file);
    assert.match(text, /Confidence: \d{2}%/, `${file}: no "Confidence: NN%" line`);
    assert.match(text, /File: [\w./-]+:(\d+|line)|`file:line`/, `${file}: no cited file:line`);
    assert.match(
      flatten(text),
      /cannot cite a line[^.]*(dropped|question)/i,
      `${file}: does not say a finding without a cited line is dropped`,
    );
  });

  test(`D: ${file} frontmatter is unchanged from HEAD`, () => {
    const head = execFileSync('git', ['show', `HEAD:${file}`], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(frontmatter(read(file)), frontmatter(head));
  });
}

test('B: reviewer prompt template asks for confidence and the cited line per finding', () => {
  const text = flatten(read(REVIEWER_PROMPT));
  assert.match(text, /confidence/i, `${REVIEWER_PROMPT}: no confidence`);
  assert.match(text, /file:line/i, `${REVIEWER_PROMPT}: no file:line`);
  assert.match(text, /Confidence: NN%/, `${REVIEWER_PROMPT}: no Confidence: NN% format`);
});

test('C: finishing.md and final-report.md carry the review-pack findings table', () => {
  const expected = findingsHeader(read(REVIEW_PACK));
  assert.deepEqual(expected, ['Severity', 'Found', 'Fixed', 'Parked', 'Dismissed']);
  for (const file of [FINISHING, FINAL_REPORT]) {
    assert.deepEqual(findingsHeader(read(file)), expected, `${file}: findings table columns`);
  }
});

test('C: finishing.md lists each dismissed finding with its reason', () => {
  assert.match(flatten(read(FINISHING)), /dismissed[^.]*(with|and) (its|the) reason/i);
});
