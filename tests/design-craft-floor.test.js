'use strict';
// Craft floor lint: unique rule IDs, and every cited ID exists. Run with: node --test tests/design-craft-floor.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN = path.resolve(__dirname, '..', 'plugins', 'opm-design');
const FLOOR = path.join(PLUGIN, 'shared', 'craft-floor.md');
const DEFINITION = /^\| ([FRNP]-\d{2}) \|/gm;
const CITATION = /\b([FRNP]-\d{2})\b/g;

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

const definedIds = () => [...fs.readFileSync(FLOOR, 'utf8').matchAll(DEFINITION)].map((m) => m[1]);
const range = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);

test('every craft floor rule has a unique ID', () => {
  const ids = definedIds();
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(duplicates, [], `duplicate rule IDs: ${duplicates.join(', ')}`);
});

test('the floor, reflex, finish and preset sets are complete', () => {
  const ids = new Set(definedIds());
  for (const id of [...range('F', 10), ...range('R', 10), ...range('N', 5), ...range('P', 3)]) {
    assert.ok(ids.has(id), `${id} is not defined in craft-floor.md`);
  }
});

test('every rule ID cited anywhere in opm-design exists', () => {
  const ids = new Set(definedIds());
  for (const file of markdownFiles(PLUGIN)) {
    const cited = [...fs.readFileSync(file, 'utf8').matchAll(CITATION)].map((m) => m[1]);
    const unknown = [...new Set(cited.filter((id) => !ids.has(id)))];
    assert.deepEqual(unknown, [], `${path.relative(PLUGIN, file)} cites unknown rules: ${unknown.join(', ')}`);
  }
});

test('the craft floor states the waiver format and its limits', () => {
  const text = fs.readFileSync(FLOOR, 'utf8');
  assert.ok(text.includes('- <ID> | <evidence> | <reason>'), 'waiver line format missing');
  assert.match(text, /at least 24 characters/);
  assert.match(text, /Design waivers/);
  assert.match(text, /never waived/i);
});
