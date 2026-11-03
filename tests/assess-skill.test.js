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
