'use strict';
// Trigger-eval parser and runner checks. Never spawns claude: run is always a stub.
// Run with: node --test tests/trigger-eval.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  parseSkillInvocations,
  observedSkill,
  parseArgs,
  selectPrompts,
  runEval,
  formatReport,
} = require('../scripts/evals/trigger-eval.js');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'evals', 'trigger-eval.js');

// Recorded from the 04-03 spike (claude 2.1.273, haiku), trimmed: session ids, uuids,
// paths, thinking signatures and skill bodies removed.
const SPIKE_TDD = [
  '{"type":"system","subtype":"hook_started","hook_name":"SessionStart:startup","hook_event":"SessionStart"}',
  '{"type":"system","subtype":"init","skills":["opm:brainstorming","opm:tdd-workflow","opm:using-opm"],"plugins":[{"name":"opm","source":"opm@inline","version":"0.8.0"}]}',
  '{"type":"assistant","message":{"role":"assistant","content":[{"type":"thinking","thinking":""}]}}',
  '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_012FKPnmeBfEsLAfYrTBoE3J","name":"Skill","input":{"skill":"opm:tdd-workflow"},"caller":{"type":"direct"}}]}}',
  '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_012FKPnmeBfEsLAfYrTBoE3J","content":"Launching skill: opm:tdd-workflow"}]}}',
  '{"type":"result","subtype":"error_max_turns","num_turns":2,"total_cost_usd":0.0235432}',
].join('\n');

const SPIKE_USING_OPM = [
  '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I\'ll help you add password reset by email to your Next.js app. Let me start by checking the OPM workflow."}]}}',
  '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_015pgGsru3APMw4ZHuA8tbLm","name":"Skill","input":{"skill":"opm:using-opm"},"caller":{"type":"direct"}}]}}',
  '{"type":"result","subtype":"error_max_turns","num_turns":2,"total_cost_usd":0.0238992}',
].join('\n');

const SPIKE_BREW = [
  '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_01CNViXw49579oTdkLfZrnmA","name":"Skill","input":{"skill":"opm:brew-idea","args":"marketplace for tutors"},"caller":{"type":"direct"}}]}}',
  '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"<tool_use_error>Skill opm:brew-idea cannot be used with Skill tool due to disable-model-invocation.</tool_use_error>","is_error":true,"tool_use_id":"toolu_01CNViXw49579oTdkLfZrnmA"}]}}',
].join('\n');

test('parseSkillInvocations returns the skill named by a Skill tool_use', () => {
  assert.deepEqual(parseSkillInvocations(SPIKE_TDD), ['opm:tdd-workflow']);
});

test('parseSkillInvocations keeps refused invocations, since they still show the routing choice', () => {
  assert.deepEqual(parseSkillInvocations(SPIKE_BREW), ['opm:brew-idea']);
});

test('parseSkillInvocations returns skills in order and ignores other tools and blank lines', () => {
  const text = [
    SPIKE_USING_OPM,
    '',
    '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}',
    '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"opm:brainstorming"}}]}}',
  ].join('\n');
  assert.deepEqual(parseSkillInvocations(text), ['opm:using-opm', 'opm:brainstorming']);
});

test('parseSkillInvocations returns an empty list when no skill was invoked', () => {
  assert.deepEqual(parseSkillInvocations('{"type":"result","subtype":"success"}\n'), []);
  assert.deepEqual(parseSkillInvocations(''), []);
});

test('parseSkillInvocations skips non-JSON log lines but fails on a broken JSON line', () => {
  assert.deepEqual(parseSkillInvocations(`warning: something\n${SPIKE_TDD}`), ['opm:tdd-workflow']);
  assert.throws(() => parseSkillInvocations('{"type":"assistant",'), /line 1/);
});

test('observedSkill picks the first opm skill other than using-opm, without the prefix', () => {
  assert.equal(observedSkill(['opm:using-opm', 'opm:brainstorming']), 'brainstorming');
  assert.equal(observedSkill(['other:thing', 'opm:tdd-workflow']), 'tdd-workflow');
  assert.equal(observedSkill(['opm:using-opm']), null);
  assert.equal(observedSkill([]), null);
});

test('parseArgs reads --yes, --limit and --only', () => {
  assert.deepEqual(parseArgs([]), { yes: false, limit: null, only: null });
  assert.deepEqual(parseArgs(['--yes', '--limit', '3', '--only', 'spike']), { yes: true, limit: 3, only: 'spike' });
});

test('parseArgs rejects a bad limit, an unknown size class and unknown flags', () => {
  assert.throws(() => parseArgs(['--limit', '0']), /--limit/);
  assert.throws(() => parseArgs(['--limit']), /--limit/);
  assert.throws(() => parseArgs(['--only', 'huge']), /--only/);
  assert.throws(() => parseArgs(['--fast']), /unknown/i);
});

const PROMPTS = [
  { prompt: 'fix it', sizeClass: 'spike', expectedSkill: 'tdd-workflow' },
  { prompt: 'add a feature', sizeClass: 'bounded', expectedSkill: 'brainstorming' },
  { prompt: 'fix another', sizeClass: 'spike', expectedSkill: 'tdd-workflow' },
];

test('selectPrompts filters by size class, applies the limit and keeps fixture ids', () => {
  const picked = selectPrompts(PROMPTS, { only: 'spike', limit: 1 });
  assert.deepEqual(picked, [{ id: 1, ...PROMPTS[0] }]);
  assert.equal(selectPrompts(PROMPTS, { only: null, limit: null }).length, 3);
  assert.equal(selectPrompts(PROMPTS, { only: 'spike', limit: null })[1].id, 3);
});

test('runEval records hit, miss and run errors per prompt', async () => {
  const outputs = { 'fix it': SPIKE_TDD, 'add a feature': SPIKE_USING_OPM };
  const run = async (prompt) => {
    if (!(prompt in outputs)) throw new Error('claude exited 1');
    return outputs[prompt];
  };
  const rows = await runEval({ prompts: selectPrompts(PROMPTS, {}), run });
  assert.deepEqual(rows.map((r) => [r.id, r.observed, r.hit]), [
    [1, 'tdd-workflow', true],
    [2, null, false],
    [3, null, false],
  ]);
  assert.match(rows[2].error, /claude exited 1/);
});

test('formatReport prints one row per prompt and the hit rate', () => {
  const report = formatReport([
    { id: 1, sizeClass: 'spike', expected: 'tdd-workflow', observed: 'tdd-workflow', hit: true },
    { id: 2, sizeClass: 'bounded', expected: 'brainstorming', observed: null, hit: false, error: 'boom' },
  ]);
  assert.match(report, /1\s+spike\s+tdd-workflow\s+tdd-workflow\s+hit/);
  assert.match(report, /2\s+bounded\s+brainstorming\s+error: boom\s+miss/);
  assert.match(report, /Hit rate: 1\/2 \(50%\)/);
});

test('the CLI refuses to start without --yes and spends nothing', () => {
  const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /spends tokens/);
  assert.match(result.stderr, /--yes/);
});
