'use strict';
// Tests for the compound-learnings skill. Run with: node --test tests/compound-learnings.test.js
// The validator runs as a child process on temp files, the way the skill runs it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SKILL_DIR = path.join(ROOT, 'skills', 'compound-learnings');
const VALIDATOR = path.join(SKILL_DIR, 'scripts', 'validate-frontmatter.js');

const BASE_FRONTMATTER = [
  'title: "Stale closure in websocket reconnect"',
  'date: 2026-11-03',
  'category: runtime-errors',
  'problem_type: runtime_error',
  'symptoms:',
  '  - "socket closed before handshake"',
  'root_cause: "The reconnect handler captured the first socket"',
  'severity: medium',
  'tags: [websocket, closure]',
  'related: []',
];

function writeDoc(extraLines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-learning-'));
  const file = path.join(dir, 'doc.md');
  const frontmatter = ['---', ...BASE_FRONTMATTER, ...extraLines, '---', '', '# Body', ''];
  fs.writeFileSync(file, frontmatter.join('\n'));
  return file;
}

function validate(file) {
  return spawnSync(process.execPath, [VALIDATOR, file], { encoding: 'utf8' });
}

test('a doc without component still validates', () => {
  const result = validate(writeDoc([]));
  assert.equal(result.status, 0, result.stderr);
});

test('a doc with component: opm validates', () => {
  const result = validate(writeDoc(['component: opm']));
  assert.equal(result.status, 0, result.stderr);
});

test('an empty component fails with a clear message', () => {
  const result = validate(writeDoc(['component: ""']));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /'component' is empty/);
});

test('a list component fails with a clear message', () => {
  const result = validate(writeDoc(['component: [opm]']));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /'component' must be a scalar/);
});

test('a bare component key fails with a clear message', () => {
  const result = validate(writeDoc(['component:']));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /'component'/);
});

test('every committed solutions doc still validates', () => {
  const solutionsDir = path.join(ROOT, 'docs', 'solutions');
  const docs = fs
    .readdirSync(solutionsDir, { recursive: true })
    .filter((name) => name.endsWith('.md') && path.basename(name) !== 'INDEX.md')
    .map((name) => path.join(solutionsDir, name));
  assert.ok(docs.length > 0, 'expected at least one solutions doc');
  const result = spawnSync(process.execPath, [VALIDATOR, ...docs], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('the resolution template documents the optional component field', () => {
  const template = fs.readFileSync(path.join(SKILL_DIR, 'assets', 'resolution-template.md'), 'utf8');
  assert.match(template, /component: opm/);
  assert.match(template, /otherwise omit/);
});

test('SKILL.md tags OPM lessons and offers them back only after a yes', () => {
  const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(skill, /component: opm/);
  assert.match(skill, /gh issue create --repo harshadmadaye\/OPM/);
  assert.match(skill, /\.opm\/opm-feedback\.md/);
  assert.match(skill, /only after (a|the user's) yes/i);
});
