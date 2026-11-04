'use strict';
// design-system skill documents. Run with: node --test tests/design-system-skill.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PLUGIN = path.resolve(__dirname, '..', 'plugins', 'opm-design');
const SKILL = path.join(PLUGIN, 'skills', 'design-system');
const read = (...p) => fs.readFileSync(path.join(SKILL, ...p), 'utf8');
const MAX_SKILL_BYTES = 4800;

test('SKILL.md has frontmatter, stays under the cap and names its scripts', () => {
  const text = read('SKILL.md');
  assert.match(text, /^---\nname: design-system\ndescription: .*Use when.*\n---\n/);
  assert.ok(Buffer.byteLength(text) <= MAX_SKILL_BYTES, `SKILL.md is ${Buffer.byteLength(text)} bytes`);
  assert.ok(text.includes('Using opm-design:design-system'));
  for (const needle of ['validate-design-md.mjs', 'contrast.mjs --delta', '## Red flags', 'F-01']) assert.ok(text.includes(needle), needle);
});

test('every reference SKILL.md names exists', () => {
  const text = read('SKILL.md');
  const refs = [...text.matchAll(/references\/([\w-]+\.md)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(refs)].sort(), ['design-md-format.md', 'extract-from-code.md', 'starting-palettes.md']);
  for (const ref of refs) assert.ok(fs.existsSync(path.join(SKILL, 'references', ref)), ref);
});

test('the format reference example passes the validator', async () => {
  const { validateDesignMd } = await import(pathToFileURL(path.join(SKILL, 'scripts', 'validate-design-md.mjs')).href);
  const example = read('references', 'design-md-format.md').match(/````markdown\n([\s\S]*?)\n````/);
  assert.ok(example, 'design-md-format.md needs one ````markdown example block');
  assert.deepEqual(validateDesignMd(example[1]).violations, []);
  for (const section of ['## Intent', '## Voice', '## Do', "## Don't", '## Components']) assert.ok(example[1].includes(section), section);
});

test('every starting palette passes F-01 for text and 3:1 for the primary colour', async () => {
  const { contrastRatio } = await import(pathToFileURL(path.join(PLUGIN, 'skills', 'frontend-design', 'scripts', 'contrast.mjs')).href);
  const rows = read('references', 'starting-palettes.md').split('\n').filter((l) => (l.match(/`#[0-9A-Fa-f]{6}`/g) || []).length === 3);
  assert.ok(rows.length >= 6, `expected at least 6 palette rows, found ${rows.length}`);
  for (const row of rows) {
    const [text, surface, primary] = row.match(/#[0-9A-Fa-f]{6}/g);
    assert.ok(contrastRatio(text, surface) >= 4.5, `${row}: text on surface`);
    assert.ok(contrastRatio(primary, surface) >= 3, `${row}: primary on surface`);
  }
});
