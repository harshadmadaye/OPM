'use strict';
// Static checks on the brew-idea workflow script. Run with: node --test tests/brew-workflow.test.js
// The script only runs inside Claude Code's Workflow tool, so these tests check
// its shape: it parses, meta is a literal, every agent names a model, and every
// phase label exists in meta.phases.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = path.resolve(__dirname, '..', 'skills', 'brew-idea', 'scripts', 'brew.workflow.js');
const source = fs.readFileSync(SCRIPT, 'utf8');

function metaLiteral() {
  const match = source.match(/^export const meta = (\{[\s\S]*?\n\})\n/m);
  assert.ok(match, 'export const meta = {...} not found at the top of the script');
  return match[1];
}

function agentCalls() {
  const calls = [];
  const re = /\bagent\(/g;
  let match;
  while ((match = re.exec(source))) {
    let depth = 0;
    let i = match.index + match[0].length - 1;
    for (; i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')' && --depth === 0) break;
    }
    calls.push(source.slice(match.index, i + 1));
  }
  return calls;
}

test('script parses as an async workflow body', () => {
  const body = source.replace(/^export const meta/m, 'const meta');
  const wrapped = `(async function (args, agent, parallel, pipeline, phase, log, budget, workflow) {\n${body}\n})`;
  assert.doesNotThrow(() => new vm.Script(wrapped, { filename: 'brew.workflow.js' }));
});

test('meta is a pure literal with name, description and phases', () => {
  const literal = metaLiteral();
  assert.ok(!literal.includes('${'), 'meta must not use template interpolation');
  const meta = vm.runInNewContext(`(${literal})`);
  assert.equal(typeof meta.name, 'string');
  assert.equal(typeof meta.description, 'string');
  assert.ok(Array.isArray(meta.phases) && meta.phases.length >= 4);
});

test('every agent() call names a model', () => {
  const calls = agentCalls();
  assert.ok(calls.length >= 4, `expected at least 4 agent() calls, found ${calls.length}`);
  for (const call of calls) {
    assert.match(call, /model:\s*'(sonnet|opus|haiku)'/, `agent() without model: ${call.slice(0, 80)}`);
  }
});

test('script never uses Date or Math.random', () => {
  assert.doesNotMatch(source, /\bDate\b|Math\.random/);
});

test('every phase label matches a meta.phases title', () => {
  const meta = vm.runInNewContext(`(${metaLiteral()})`);
  const titles = new Set(meta.phases.map((p) => p.title));
  const used = new Set();
  for (const m of source.matchAll(/phase:\s*'([^']+)'/g)) used.add(m[1]);
  for (const m of source.matchAll(/^\s*phase\('([^']+)'\)/gm)) used.add(m[1]);
  assert.ok(used.size >= 4, 'expected phase labels in the script');
  for (const label of used) assert.ok(titles.has(label), `phase "${label}" is not in meta.phases`);
});
