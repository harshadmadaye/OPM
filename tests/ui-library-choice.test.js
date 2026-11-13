'use strict';
// UI library choice: catalogue shape and entry-point wiring. Run with: node --test tests/ui-library-choice.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const CATALOGUE_REF = 'references/ui-libraries.md';
const catalogue = read('skills', 'brainstorming', 'references', 'ui-libraries.md');
const COLUMNS = ['Round', 'Library', 'Description', 'Licence', 'Install', 'Theme hook', 'Detect'];

function stackRows(heading) {
  const start = catalogue.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `missing section ${heading}`);
  const next = catalogue.indexOf('\n## ', start + 1);
  const section = catalogue.slice(start, next < 0 ? undefined : next);
  const lines = section.split('\n').filter((l) => l.startsWith('|'));
  const header = lines[0].split('|').slice(1, -1).map((c) => c.trim());
  assert.deepEqual(header, COLUMNS, `${heading} columns`);
  return lines.slice(2).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

for (const stack of ['Web: React and Next.js', 'Mobile: Flutter']) {
  test(`${stack}: two round-1 libraries and one held back, every cell filled`, () => {
    const rows = stackRows(stack);
    assert.deepEqual(rows.map((r) => r[0]), ['1', '1', 'held']);
    for (const row of rows) {
      assert.equal(row.length, COLUMNS.length, row[1]);
      for (const [i, cell] of row.entries()) assert.ok(cell.length > 0, `${row[1]} ${COLUMNS[i]} empty`);
    }
  });
}

test('round 1 fits AskUserQuestion: two libraries, search, custom', () => {
  for (const needle of ['**Search for more libraries**', '**Custom components**', '(Recommended)', '"Other"']) {
    assert.ok(catalogue.includes(needle), needle);
  }
});

test('search runs at most once and round 2 cannot loop', () => {
  assert.match(catalogue, /search at most once/i);
  assert.match(catalogue, /`ui-library-searched: yes`/);
  assert.match(catalogue, /no search option, so the flow cannot loop/);
  assert.match(catalogue, /Never invent/);
  assert.match(catalogue, /source: curated \| searched \| other/);
});

test('the question is skipped when it does not apply', () => {
  for (const needle of ['already names a library', 'already installed', 'no UI']) assert.ok(catalogue.includes(needle), needle);
});

test('brainstorming and jump-start point at the catalogue', () => {
  assert.ok(read('skills', 'brainstorming', 'SKILL.md').includes(CATALOGUE_REF));
  const jump = read('skills', 'jump-start', 'SKILL.md');
  assert.ok(jump.includes(`skills/brainstorming/${CATALOGUE_REF}`));
  assert.match(jump, /UI library/);
  assert.ok(read('skills', 'jump-start', 'templates', 'design-outline.md').includes('UI library'));
});

test('frontend-design detects an installed library before building', () => {
  const skill = read('plugins', 'opm-design', 'skills', 'frontend-design', 'SKILL.md');
  assert.ok(skill.includes('references/ui-library.md'));
  const ref = read('plugins', 'opm-design', 'skills', 'frontend-design', 'references', 'ui-library.md');
  for (const signal of ['components.json', '@mantine/core', '@mui/material', 'shadcn_ui', 'forui']) {
    assert.ok(ref.includes(signal), signal);
  }
});

test('patterns skills say to theme and wrap, not fork', () => {
  for (const s of ['react-patterns', 'flutter-patterns']) assert.match(read('skills', s, 'SKILL.md'), /never fork/i, s);
});
