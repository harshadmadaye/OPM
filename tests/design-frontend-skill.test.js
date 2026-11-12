'use strict';
// frontend-design skill documents. Run with: node --test tests/design-frontend-skill.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = path.resolve(__dirname, '..', 'plugins', 'opm-design', 'skills', 'frontend-design');
const read = (...p) => fs.readFileSync(path.join(SKILL, ...p), 'utf8');
const MAX_SKILL_BYTES = 4800;
const STATES = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
const AXES = ['Philosophy', 'Hierarchy', 'Execution', 'Specificity', 'Restraint', 'Variety'];

test('SKILL.md has frontmatter, stays under the cap and covers the three steps', () => {
  const text = read('SKILL.md');
  assert.match(text, /^---\nname: frontend-design\ndescription: .*Use when.*Not for backend.*\n---\n/);
  assert.ok(Buffer.byteLength(text) <= MAX_SKILL_BYTES, `SKILL.md is ${Buffer.byteLength(text)} bytes`);
  for (const needle of ['Using opm-design:frontend-design', '## 1. Direction', '## 2. Build', '## 3. Check', '## Size first',
    'visual-qa.mjs', 'opm-design:design-reviewer', 'change.diff', 'Design waivers', '## Red flags', 'F-06', 'F-10']) {
    assert.ok(text.includes(needle), needle);
  }
  for (const verdict of ['ship', 'fix', 'rebuild', 'recapture']) assert.ok(text.includes(`\`${verdict}\``), verdict);
});

test('every reference SKILL.md names exists', () => {
  const refs = [...new Set([...read('SKILL.md').matchAll(/references\/([\w-]+\.md)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(refs, ['direction.md', 'flutter.md', 'interaction-states.md', 'redesign.md', 'visual-qa.md']);
  for (const ref of refs) assert.ok(fs.existsSync(path.join(SKILL, 'references', ref)), ref);
});

test('direction.md defines the four surfaces and anchors all six axes', () => {
  const text = read('references', 'direction.md');
  for (const surface of ['persuade', 'operate', 'read', 'experience']) assert.ok(text.includes(`**${surface}**`), surface);
  for (const axis of AXES) assert.ok(text.includes(`| ${axis} |`), axis);
});

test('interaction-states.md covers all eight states', () => {
  const text = read('references', 'interaction-states.md');
  for (const state of STATES) assert.ok(text.includes(`| ${state} |`), state);
});

test('visual-qa.md documents the ladder, flags, exit codes and consent', () => {
  const text = read('references', 'visual-qa.md');
  for (const needle of ['--install', '--manual', '--mcp', 'exit code 2', '150 MB', 'OPM_DESIGN_TOOLS', 'never the repo', '320']) {
    assert.ok(text.includes(needle), needle);
  }
});

test('redesign.md requires the inventory and one depth', () => {
  const text = read('references', 'redesign.md');
  for (const needle of ['data-testid', '**full**', '**restyle**', '**polish**', 'never blend']) assert.ok(text.includes(needle), needle);
});
