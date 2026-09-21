'use strict';
// Storyboard validation tests. Run with: node --test tests/story-video-storyboard.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SKILL = path.resolve(__dirname, '..', 'skills', 'story-video');
const { validateStoryboard, loadStoryboard, countWords } = require(path.join(SKILL, 'scripts', 'lib', 'storyboard.js'));
const { LAYOUTS } = require(path.join(SKILL, 'scripts', 'layouts', 'index.js'));
const CLI = path.join(SKILL, 'scripts', 'validate-storyboard.js');
const EXAMPLE = path.join(SKILL, 'templates', 'storyboard.example.json');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-story-board-'));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const example = () => JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));
const errorsOf = (mutate) => { const board = example(); mutate(board); return validateStoryboard(board).errors; };
const expectError = (mutate, needle) => {
  const errors = errorsOf(mutate);
  assert.ok(errors.some((e) => e.includes(needle)), `expected "${needle}" in:\n${errors.join('\n')}`);
};

test('the shipped example is valid, uses every layout and one custom scene', () => {
  const result = validateStoryboard(example());
  assert.deepEqual(result.errors, []);
  const used = new Set(example().scenes.map((s) => s.layout));
  for (const name of Object.keys(LAYOUTS)) assert.ok(used.has(name), `example does not use ${name}`);
  assert.ok(used.has('custom'));
  assert.equal(result.summary.scenes, example().scenes.length);
  assert.ok(result.summary.words > 250);
  assert.ok(result.summary.customIds.length === 1 && result.summary.plannedIds.length >= 1);
  assert.equal(countWords('One two,  three.\nFour'), 4);
});

test('structure errors', () => {
  assert.ok(validateStoryboard({}).errors.some((e) => e.includes('title: required')));
  assert.ok(validateStoryboard({ title: 'T', scenes: [] }).errors.some((e) => e.includes('scenes: expected at least one scene')));
  expectError((b) => { b.scenes[1].id = b.scenes[0].id; }, 'duplicate id');
  expectError((b) => { b.scenes[0].id = '1'; }, 'id must be two digits');
  expectError((b) => { [b.scenes[0].id, b.scenes[1].id] = [b.scenes[1].id, b.scenes[0].id]; }, 'ids must ascend');
  expectError((b) => { b.scenes[1].layout = 'hologram'; }, 'unknown layout "hologram"');
  expectError((b) => { b.scenes[1].part = 'nowhere'; }, 'unknown part "nowhere"');
  expectError((b) => { b.parts[Object.keys(b.parts)[0]].tone = 'pink'; }, 'tone must be amber or teal');
});

test('slot errors come through with the scene id', () => {
  const flowIndex = example().scenes.findIndex((s) => s.layout === 'flow');
  const id = example().scenes[flowIndex].id;
  expectError((b) => { b.scenes[flowIndex].slots.steps[0].icon = 'rocket'; }, `scene ${id}: slots.steps[0].icon: unknown icon "rocket"`);
  expectError((b) => { b.scenes[flowIndex].slots = { steps: [] }; }, `scene ${id}: slots.steps: expected 2 to 5 items, got 0`);
});

test('text rules', () => {
  expectError((b) => { b.scenes[1].heading = 'h'.repeat(49); }, 'heading is 49 characters, limit 48');
  expectError((b) => { b.scenes[1].sub = 's'.repeat(91); }, 'sub is 91 characters, limit 90');
  expectError((b) => { b.scenes[1].narration = ''; }, 'narration: required');
  expectError((b) => { b.scenes[1].narration = 'Too short.'; }, 'narration is 2 words, expected 25 to 110');
  expectError((b) => { b.scenes[1].narration += ' This uses A.I. tools.'; }, 'write "AI", not "A.I."');
  expectError((b) => { delete b.scenes[1].source; }, 'source: required');
  const customIndex = example().scenes.findIndex((s) => s.layout === 'custom');
  expectError((b) => { b.scenes[customIndex].visual = ''; }, 'custom scenes need a visual description');
});

test('a narration sentence copied onto the slide is an error', () => {
  const flowIndex = example().scenes.findIndex((s) => s.layout === 'flow');
  expectError((b) => {
    const scene = b.scenes[flowIndex];
    const sentence = scene.narration.split(/(?<=[.!?])\s+/).find((s) => s.split(/\s+/).length >= 4);
    scene.slots.steps[0].label = sentence;
  }, 'repeats a narration sentence');
});

test('length target produces a warning, not an error', () => {
  const board = example();
  board.targetMinutes = 30;
  const result = validateStoryboard(board);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => w.includes('target')));
});

test('CLI: ok line and exit 0 for a directory or a file, error lines and exit 1 otherwise', () => {
  const dir = path.join(tmpRoot, 'story dir ');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(EXAMPLE, path.join(dir, 'storyboard.json'));
  const okDir = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(okDir.status, 0, okDir.stderr);
  assert.match(okDir.stdout, /^ok: \d+ scenes, \d+ words, ~\d+\.\d min, custom: \d\d, planned: /m);
  assert.equal(spawnSync(process.execPath, [CLI, EXAMPLE], { encoding: 'utf8' }).status, 0);

  const broken = example();
  broken.scenes[1].layout = 'hologram';
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(broken));
  const bad = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /^error: scene \d\d: unknown layout "hologram"/m);

  const missing = spawnSync(process.execPath, [CLI, path.join(tmpRoot, 'nope')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /cannot read/);
  assert.throws(() => loadStoryboard(path.join(tmpRoot, 'nope', 'storyboard.json')), /cannot read/);
});
