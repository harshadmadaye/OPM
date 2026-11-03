'use strict';
// Evidence-environment checks: every gate says where it ran (unit, simulator,
// physical-device, prod-like), simulator or unit performance claims are "not judgeable",
// and a real-environment definition of done needs a physical-device or prod-like check.
// Run with: node --test tests/evidence-env.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FULL_LOOP = 'skills/verification-before-completion/references/full-loop.md';
const VERIFICATION = 'skills/verification-before-completion/SKILL.md';
const SUMMARY = 'skills/milestone-planning/templates/summary.md';
const EXECUTING_A_PHASE = 'skills/milestone-planning/references/executing-a-phase.md';
const BUILD_AND_RUN = 'skills/jump-start/references/build-and-run.md';
const FINAL_REPORT = 'skills/jump-start/templates/final-report.md';

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const flatten = (text) => text.replace(/\s+/g, ' ');
const ENV_VALUES = ['unit', 'simulator', 'physical-device', 'prod-like'];

test('A: full-loop report format labels each gate with env and the four values', () => {
  const text = read(FULL_LOOP);
  const report = text.slice(text.indexOf('VERIFICATION REPORT'));
  assert.match(report, /Tests:[^\n]*env:/, `${FULL_LOOP} Tests line must carry env:`);
  assert.match(report, /Build:[^\n]*env:/, `${FULL_LOOP} Build line must carry env:`);
  for (const value of ENV_VALUES) {
    assert.ok(text.includes(value), `${FULL_LOOP} must list env value ${value}`);
  }
  assert.match(flatten(text), /env: not stated/, `${FULL_LOOP} must define "env: not stated"`);
  assert.match(text, /NOT JUDGEABLE \(env: simulator\)/, `${FULL_LOOP} must show NOT JUDGEABLE (env: simulator)`);
});

test('B: verification SKILL.md calls simulator/unit performance claims not judgeable', () => {
  const text = flatten(read(VERIFICATION));
  assert.match(text, /battery/i, `${VERIFICATION} must mention battery`);
  assert.match(text, /NOT JUDGEABLE/, `${VERIFICATION} must say NOT JUDGEABLE`);
  assert.match(text, /simulator/i, `${VERIFICATION} must name the simulator`);
});

test('C: summary template Verification lines carry env:', () => {
  const text = read(SUMMARY);
  const verification = text.slice(text.indexOf('## Verification'), text.indexOf('## Next-phase readiness'));
  assert.match(verification, /Tests:[^\n]*env:/, `${SUMMARY} Tests line must carry env:`);
  assert.match(verification, /Build[^\n]*env:/, `${SUMMARY} Build line must carry env:`);
});

test('D: jump-start evidence table has an Env column and Phase 8 labels the run', () => {
  assert.match(read(FINAL_REPORT), /\|\s*Check\s*\|[^\n]*Env/, `${FINAL_REPORT} Evidence table must have an Env column`);
  const phase8 = flatten(read(BUILD_AND_RUN).split(/^## Phase 8/m)[1] || '');
  assert.match(phase8, /label[^.]*physical-device[^.]*simulator|label[^.]*simulator[^.]*physical-device/i,
    `${BUILD_AND_RUN} Phase 8 must say to label the run physical-device or simulator`);
});

test('E: executing-a-phase requires a physical-device or prod-like check when the definition of done says so', () => {
  const text = flatten(read(EXECUTING_A_PHASE));
  assert.match(text, /definition of done[^.]*real-environment/i, `${EXECUTING_A_PHASE} must name the real-environment pass`);
  assert.match(text, /Real-environment pass: required/, `${EXECUTING_A_PHASE} must say how ROADMAP.md declares it`);
  assert.match(text, /staging run does not satisfy `physical-device`/, `${EXECUTING_A_PHASE} must say a prod-like check does not satisfy physical-device`);
  assert.match(text, /not complete/i, `${EXECUTING_A_PHASE} must say the phase is not complete without it`);
});

test('F: NOT JUDGEABLE or NOT RUN forces Overall NOT READY; Secrets and Diff carry no env', () => {
  const text = read(FULL_LOOP);
  const block = text.slice(text.indexOf('VERIFICATION REPORT'), text.indexOf('Findings:'));
  assert.doesNotMatch(block, /Secrets:[^\n]*env:/, `${FULL_LOOP} Secrets does not depend on where it ran`);
  assert.doesNotMatch(block, /Diff:[^\n]*env:/, `${FULL_LOOP} Diff does not depend on where it ran`);
  assert.match(block, /E2E:[^\n]*env:/, `${FULL_LOOP} needs an E2E or smoke line with env (ISS-021)`);
  assert.match(flatten(text), /NOT JUDGEABLE or NOT RUN[^.]*Overall: NOT READY/, `${FULL_LOOP} must tie NOT JUDGEABLE to Overall`);
});

test('G: the env legend places web, API and CLI checks', () => {
  const text = flatten(read(FULL_LOOP));
  assert.match(text, /Playwright[^.]*localhost[^.]*simulator/i, `${FULL_LOOP} must place Playwright against localhost`);
  const unitLine = text.match(/`unit`:[^.]*\./);
  assert.ok(unitLine && /\bCI\b/.test(unitLine[0]) && /local database|container/.test(unitLine[0]), `${FULL_LOOP} must place CI and local-DB integration tests under unit`);
});

test('H: a real-environment pass names the env that satisfies it, applies at milestone close, and the roadmap guidance mentions it', () => {
  const text = flatten(read(EXECUTING_A_PHASE));
  assert.match(text, /only a check labelled with that env satisfies it/i, `${EXECUTING_A_PHASE} must say which env satisfies the rule`);
  assert.match(text, /at milestone close/i, `${EXECUTING_A_PHASE} must say when it applies`);
  assert.match(flatten(read('skills/milestone-planning/SKILL.md')), /Real-environment pass: required/, 'milestone-planning ROADMAP.md guidance must mention the declaration');
});
