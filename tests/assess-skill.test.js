'use strict';
// Structure checks for opm:assess and the reviewer Sweep mode it relies on.
// Run with: node --test tests/assess-skill.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SWEEP_AGENTS = ['agents/code-reviewer.md', 'agents/typescript-reviewer.md'];

test('diff-only reviewers carry a Sweep mode for whole-file reviews', () => {
  for (const agent of SWEEP_AGENTS) {
    const text = read(agent);
    assert.ok(text.includes('## Sweep mode'), `${agent} has no "## Sweep mode" section`);
    const section = text.split('## Sweep mode')[1].split('\n## ')[0];
    assert.match(section, /paths/, `${agent} Sweep mode does not mention paths`);
    assert.match(section, /finding format/i, `${agent} Sweep mode does not mention the assess finding format`);
  }
});

const SKILL = 'skills/assess/SKILL.md';
const CORE_MAX_BYTES = 4800;
const LEVELS = ['Architecture', 'Code', 'Feature', 'Project'];
const HAND_OFF = ['opm:tdd-workflow', 'opm:writing-plans', 'opm:executing-plans', 'opm:milestone-planning', 'opm:verification-before-completion'];
const FINDING_FIELDS = ['severity', 'file', 'evidence', 'fix', 'effort'];

test('assess frontmatter names the skill and says when to use it', () => {
  const text = read(SKILL);
  const front = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(front, 'missing frontmatter');
  assert.match(front[1], /^name: assess$/m);
  assert.match(front[1], /^description: .*Use when /m);
  assert.doesNotMatch(front[1], /disable-model-invocation/, 'assess must be reachable from plain requests');
});

test('every reference and template the core names exists', () => {
  const named = [...read(SKILL).matchAll(/(?<![\w/-])((?:references|templates)\/[a-z-]+\.md)\b/g)].map((m) => m[1]);
  assert.ok(named.length >= 7, `core names only ${named.length} support files`);
  for (const rel of new Set(named)) {
    assert.ok(fs.existsSync(path.join(ROOT, 'skills', 'assess', rel)), `missing skills/assess/${rel}`);
  }
});

test('core covers the four levels and hands off to the right skills', () => {
  const text = read(SKILL);
  for (const level of LEVELS) assert.ok(text.includes(`**${level}**`), `level ${level} not named in bold`);
  for (const skill of HAND_OFF) assert.ok(text.includes(skill), `hand-off ${skill} not named`);
  assert.ok(text.includes('docs/assessments/'), 'report path missing');
  assert.ok(text.includes('fix/assess-'), 'fix branch name missing');
});

test('core stays under the soft cap', () => {
  const bytes = Buffer.byteLength(read(SKILL), 'utf8');
  assert.ok(bytes <= CORE_MAX_BYTES, `SKILL.md is ${bytes} bytes, cap ${CORE_MAX_BYTES}`);
});

test('report template and verifier carry the shared finding fields', () => {
  for (const rel of ['skills/assess/templates/report.md', 'skills/assess/references/verify.md']) {
    const text = read(rel);
    for (const field of FINDING_FIELDS) assert.ok(text.includes(field), `${rel} lacks ${field}`);
  }
});
