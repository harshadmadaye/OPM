'use strict';
// Orchestration ladder checks: using-opm must tell every session when to scale up
// (subagents, parallel work, plans, milestones, an offered Workflow) and keep the
// detail on demand in references/orchestration.md.
// Run with: node --test tests/orchestration.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SKILL_DIR = path.join(ROOT, 'skills', 'using-opm');
const USING_OPM = path.join(SKILL_DIR, 'SKILL.md');
const REFERENCE = path.join(SKILL_DIR, 'references', 'orchestration.md');
const LADDER_HEADING = '## Scale the approach';
const REFERENCE_POINTER = 'references/orchestration.md';

const read = (file) => fs.readFileSync(file, 'utf8');

function section(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return null;
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

test('using-opm has a scale-the-approach ladder', () => {
  const ladder = section(read(USING_OPM), LADDER_HEADING);
  assert.ok(ladder, `missing "${LADDER_HEADING}" section in skills/using-opm/SKILL.md`);
  for (const move of ['subagent', 'parallel', 'worktree', 'opm:writing-plans', 'opm:milestone-planning', 'Workflow']) {
    assert.ok(ladder.includes(move), `the ladder does not mention ${move}`);
  }
});

test('the ladder announces every escalation and only offers a Workflow', () => {
  const ladder = section(read(USING_OPM), LADDER_HEADING);
  assert.ok(ladder, `missing "${LADDER_HEADING}" section`);
  assert.match(ladder, /announce/i, 'escalations must be announced in one line');
  assert.match(ladder, /offer/i, 'a multi-agent Workflow is offered, never started silently');
  assert.match(ladder, /yes/i, 'the offer waits for the user to say yes');
});

test('the ladder points at the on-demand reference, which exists', () => {
  const ladder = section(read(USING_OPM), LADDER_HEADING);
  assert.ok(ladder && ladder.includes(REFERENCE_POINTER), `the ladder must point at ${REFERENCE_POINTER}`);
  assert.ok(fs.existsSync(REFERENCE), `${REFERENCE_POINTER} is missing`);
});

test('the reference covers costs, the opt-in rule, when not to escalate and the completion contract', () => {
  const reference = read(REFERENCE);
  for (const topic of [/cost/i, /opt-in|opt in/i, /do not escalate|don't escalate|stay small/i, /collect/i, /verify/i]) {
    assert.match(reference, topic, `references/orchestration.md does not cover ${topic}`);
  }
});
