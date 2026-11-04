'use strict';
// ux-flows skill documents. Run with: node --test tests/design-ux-flows-skill.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SKILL = path.resolve(__dirname, '..', 'plugins', 'opm-design', 'skills', 'ux-flows');
const read = (...p) => fs.readFileSync(path.join(SKILL, ...p), 'utf8');
const MAX_SKILL_BYTES = 4800;
const MAX_NODES = 20;

test('SKILL.md has frontmatter, stays under the cap and stops for approval', () => {
  const text = read('SKILL.md');
  assert.match(text, /^---\nname: ux-flows\ndescription: .*Use when.*\n---\n/);
  assert.ok(Buffer.byteLength(text) <= MAX_SKILL_BYTES, `SKILL.md is ${Buffer.byteLength(text)} bytes`);
  for (const needle of ['Using opm-design:ux-flows', '**Stop.', 'check-flows.mjs', 'docs/ux-flows/<feature>/', 'opm:writing-plans',
    'Screen | Use cases | Key elements | Outgoing links', '## Size first', '## Red flags']) {
    assert.ok(text.includes(needle), needle);
  }
  for (const state of ['idle', 'loading', 'success', 'empty', 'error', 'offline']) assert.ok(text.includes(state), state);
});

test('every reference SKILL.md names exists', () => {
  const refs = [...new Set([...read('SKILL.md').matchAll(/references\/([\w-]+\.md)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(refs, ['handoff-template.md', 'mermaid-patterns.md', 'use-case-template.md']);
  for (const ref of refs) assert.ok(fs.existsSync(path.join(SKILL, 'references', ref)), ref);
});

test('mermaid-patterns.md fixes the node shapes and the node limit', () => {
  const text = read('references', 'mermaid-patterns.md');
  for (const shape of ['[Screen]', '{Decision?}', '([Action])', '((Start))', '[[Sub-flow]]', 'classDef']) assert.ok(text.includes(shape), shape);
  assert.ok(text.includes(`at most ${MAX_NODES} nodes`));
});

test('the handoff template example inventory passes check-flows', async () => {
  const { parseInventory, checkFlows } = await import(pathToFileURL(path.join(SKILL, 'scripts', 'check-flows.mjs')).href);
  const example = read('references', 'handoff-template.md');
  for (const needle of ['| From screen | Element | To screen |', '## Endpoints', '## Open questions']) assert.ok(example.includes(needle), needle);
  const rows = parseInventory(example);
  assert.ok(rows && rows.length >= 3, 'handoff-template.md needs an example screen inventory');
  assert.deepEqual(checkFlows(rows), []);
});

test('the use-case template has every required part', () => {
  const text = read('references', 'use-case-template.md');
  for (const part of ['UC-01', 'Actors', 'Preconditions', 'Main flow', 'Alternative flows', 'Error flows', 'Postconditions']) assert.ok(text.includes(part), part);
});
