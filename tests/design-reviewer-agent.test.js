'use strict';
// design-reviewer agent prompt. Run with: node --test tests/design-reviewer-agent.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AGENT = path.resolve(__dirname, '..', 'plugins', 'opm-design', 'agents', 'design-reviewer.md');

test('frontmatter names the agent and limits its tools', () => {
  const text = fs.readFileSync(AGENT, 'utf8');
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(front, 'frontmatter missing');
  assert.match(front[1], /^name: design-reviewer$/m);
  assert.match(front[1], /^description: .*Use after/m);
  assert.match(front[1], /^tools: Read, Grep, Glob, Bash$/m);
});

test('the prompt keeps the reviewer independent and the output contract fixed', () => {
  const body = fs.readFileSync(AGENT, 'utf8').split(/\n---\n/).slice(1).join('\n---\n');
  assert.ok(body.trimStart().startsWith('You did not build this and will not be told why anything is the way it is.'));
  for (const verdict of ['ship', 'fix', 'rebuild', 'recapture']) assert.ok(body.includes(`\`${verdict}\``), verdict);
  for (const needle of ['at most 8 findings', 'never edit', 'visual-qa.mjs', 'craft-floor.md', 'unwaived floor violation', 'confidence', 'Design waivers', '`mcp`', 'not checked']) {
    assert.ok(body.toLowerCase().includes(needle.toLowerCase()), needle);
  }
});
