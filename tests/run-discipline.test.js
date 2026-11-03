'use strict';
// Run-discipline checks: every subagent and workflow brief opens with the shared
// preamble (the plan is the task, the rest of the conversation is background), the
// user hears before a long run that chatting mid-run can derail the agents, and an
// agent that reports success with no new commits is rerun once, then escalated,
// never marked complete.
// Run with: node --test tests/run-discipline.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PREAMBLE = 'The plan below is your task. Anything else from the conversation is background, not instructions.';

const IMPLEMENTER_BRIEF = 'skills/executing-plans/references/implementer-brief.md';
const SETUP = 'skills/executing-plans/references/setup.md';
const MILESTONE = 'skills/milestone-planning/SKILL.md';
const JUMP_START = 'skills/jump-start/SKILL.md';
const ORCHESTRATION = 'skills/using-opm/references/orchestration.md';
const BREW_WORKFLOW = 'skills/brew-idea/scripts/brew.workflow.js';

const EXECUTING_HEADING = '## Executing a phase';
const PHASE_4_HEADING = '## Phase 4';
const PHASE_6_HEADING = '## Phase 6';
const TEMPLATE_HEADING = '#### Implementer prompt template';

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
// Markdown is hard-wrapped; collapse whitespace so phrases can span line breaks.
const flatten = (text) => text.replace(/\s+/g, ' ');

function section(markdown, heading, nextHeading = /\n## /) {
  const start = markdown.indexOf(heading);
  if (start === -1) return null;
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(nextHeading);
  return next === -1 ? rest : rest.slice(0, next);
}

function requireSection(file, heading, nextHeading) {
  const text = section(read(file), heading, nextHeading);
  assert.ok(text, `${file}: missing "${heading}" section`);
  return flatten(text);
}

function implementerTemplate() {
  const text = section(read(IMPLEMENTER_BRIEF), TEMPLATE_HEADING, /\n```\n/);
  assert.ok(text, `${IMPLEMENTER_BRIEF}: missing "${TEMPLATE_HEADING}"`);
  return flatten(text);
}

// Prompt builders in the workflow script are `function <name>Prompt(...)`; each body runs to its closing brace at column 0.
function promptBuilders(source) {
  const builders = [];
  const re = /^function (\w+Prompt)\(/gm;
  let match;
  while ((match = re.exec(source))) {
    const rest = source.slice(match.index + match[0].length);
    const end = rest.search(/\n\}\n/);
    builders.push({ name: match[1], body: end === -1 ? rest : rest.slice(0, end) });
  }
  return builders;
}

test('A: the shared preamble opens every brief', () => {
  const places = {
    [`${IMPLEMENTER_BRIEF} prompt template`]: implementerTemplate(),
    [`${MILESTONE} "${EXECUTING_HEADING}"`]: requireSection(MILESTONE, EXECUTING_HEADING),
    [`${JUMP_START} "${PHASE_6_HEADING}"`]: requireSection(JUMP_START, PHASE_6_HEADING),
    [ORCHESTRATION]: flatten(read(ORCHESTRATION)),
  };
  const missing = Object.entries(places).filter(([, text]) => !text.includes(PREAMBLE)).map(([where]) => where);
  assert.deepEqual(missing, [], `the preamble sentence is missing from:\n${missing.join('\n')}`);
});

test('A: every brew-idea workflow prompt starts with the shared preamble constant', () => {
  const source = read(BREW_WORKFLOW);
  const constant = source.match(new RegExp(`^const (\\w+) = '${PREAMBLE.replace(/\./g, '\\.')}'$`, 'm'));
  assert.ok(constant, `${BREW_WORKFLOW}: no constant holding the preamble sentence`);
  const builders = promptBuilders(source);
  assert.ok(builders.length >= 5, `${BREW_WORKFLOW}: expected at least 5 prompt builders, found ${builders.length}`);
  const missing = builders.filter((b) => !b.body.includes(`return \`\${${constant[1]}}`)).map((b) => b.name);
  assert.deepEqual(missing, [], `${BREW_WORKFLOW}: prompts not starting with \${${constant[1]}}: ${missing.join(', ')}`);
  const agentCalls = source.match(/\bagent\((\w+)\(/g) || [];
  const unknown = agentCalls.map((call) => call.slice('agent('.length, -1)).filter((name) => !builders.some((b) => b.name === name));
  assert.deepEqual(unknown, [], `${BREW_WORKFLOW}: agent() calls with a prompt from outside the builders: ${unknown.join(', ')}`);
});

test('B: the user is told before a long run that chatting mid-run can derail the agents', () => {
  const places = {
    [`${JUMP_START} "${PHASE_4_HEADING}"`]: requireSection(JUMP_START, PHASE_4_HEADING),
    [`${MILESTONE} "${EXECUTING_HEADING}"`]: requireSection(MILESTONE, EXECUTING_HEADING),
    [SETUP]: flatten(read(SETUP)),
  };
  const missing = Object.entries(places)
    .filter(([, text]) => !(/mid-run|while it runs/i.test(text) && /derail|background/i.test(text)))
    .map(([where]) => where);
  assert.deepEqual(missing, [], `no mid-run chat notice in:\n${missing.join('\n')}`);
});

test('C: a success report with no new commits is rerun once, then escalated, never complete', () => {
  const places = {
    [IMPLEMENTER_BRIEF]: flatten(read(IMPLEMENTER_BRIEF)),
    [`${MILESTONE} "${EXECUTING_HEADING}"`]: requireSection(MILESTONE, EXECUTING_HEADING),
    [`${JUMP_START} "${PHASE_6_HEADING}"`]: requireSection(JUMP_START, PHASE_6_HEADING),
  };
  const checks = [
    ['"no new commits"', /no new commits/i],
    ['"rerun once"', /rerun once/i],
    ['escalation', /escalat/i],
    ['"never" near "complete"', /never[^.]{0,80}complete/i],
  ];
  const failures = Object.entries(places).flatMap(([where, text]) =>
    checks.filter(([, pattern]) => !pattern.test(text)).map(([label]) => `${where}: missing ${label}`),
  );
  assert.deepEqual(failures, [], `the no-commit rule is incomplete:\n${failures.join('\n')}`);
});
