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
    const section = text.slice(text.indexOf('\n## Sweep mode')).split('\n## ')[1];
    assert.match(section, /paths/, `${agent} Sweep mode does not mention paths`);
    assert.match(section, /finding format/i, `${agent} Sweep mode does not mention the assess finding format`);
  }
});

const SKILL = 'skills/assess/SKILL.md';
const CORE_MAX_BYTES = 4800;
const LEVELS = ['Architecture', 'Code', 'Feature', 'Project'];
const HAND_OFF = ['opm:tdd-workflow', 'opm:writing-plans', 'opm:executing-plans', 'opm:milestone-planning', 'opm:verification-before-completion'];
const FINDING_FIELDS = ['severity', 'title', 'file', 'evidence', 'fix', 'effort', 'lens'];

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
    // The report puts each title in its heading (#### F1 <title>), not a field line.
    const fields = rel.endsWith('report.md') ? FINDING_FIELDS.filter((f) => f !== 'title') : FINDING_FIELDS;
    for (const field of fields) assert.match(text, new RegExp(`^\\s*-? ?${field}:`, 'm'), `${rel} lacks a ${field}: line`);
  }
});

// Review of PR #7: every side effect of an assessment needs a yes, and the
// fix step must not trip over the report it just wrote.
const FIX_ROUTING = 'skills/assess/references/fix-routing.md';
const section = (text, heading) => text.slice(text.indexOf(heading)).split('\n## ')[0];

test('Sweep mode starts only on the words "Sweep mode", not on named paths', () => {
  for (const agent of SWEEP_AGENTS) {
    const trigger = read(agent).split('\n').find((line) => line.includes('**Trigger:**'));
    assert.ok(trigger, `${agent} has no Trigger line`);
    assert.match(trigger, /"Sweep mode"/, `${agent} trigger must require the words "Sweep mode"`);
    assert.match(trigger, /paths alone/i, `${agent} trigger must say naming paths alone is not a sweep`);
  }
});

test('publishing the report as a page needs a yes and never quotes secrets', () => {
  const report = section(read(SKILL), '## Phase 5');
  assert.match(report, /ask\s+before\s+publishing/i, 'Phase 5 publishes the artifact page without asking');
  assert.match(read('skills/assess/references/verify.md'), /never\s+quote\s+a\s+secret/i, 'finding rules must forbid quoting secret values');
});

test('the branch and the report commit need a yes, and the report never blocks the fix step', () => {
  const handOff = section(read(SKILL), '## Phase 6');
  assert.match(handOff, /ask\s+before\s+creating\s+the\s+branch/i, 'Phase 6 creates a branch and commits without asking');
  const branch = section(read(FIX_ROUTING), '## Branch');
  assert.match(branch, /other\s+than\s+the\s+new\s+report/i, 'the uncommitted-changes stop would fire on the report itself');
});

test('fix routing uses tdd-workflow commit messages and non-overlapping, ordered rules', () => {
  const routing = read(FIX_ROUTING);
  assert.doesNotMatch(routing, /fix\(<area>\)/, 'tdd-workflow does not use fix(<area>) commits');
  assert.match(routing, /test: add failing test for <behaviour> \(F<n>\)/);
  assert.match(routing, /first\s+rule\s+that\s+matches/i, 'sizing rules must be ordered so they cannot overlap');
});

test('no open plan ledger for assess is committed', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'docs', 'plans', '2026-11-03-opm-assess.progress.md')), 'remove the assess plan ledger');
});
