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
  assert.match(text, /physical-device or prod-like/, `${EXECUTING_A_PHASE} must require physical-device or prod-like`);
  assert.match(text, /not complete/i, `${EXECUTING_A_PHASE} must say the phase is not complete without it`);
});
