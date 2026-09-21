'use strict';
// Generic tests that every registered layout must pass. Run with: node --test tests/story-video-layouts.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '..', 'skills', 'story-video', 'scripts');
const { LAYOUTS, getLayout } = require(path.join(SCRIPTS, 'layouts', 'index.js'));
const { checkSlots } = require(path.join(SCRIPTS, 'layouts', 'schema.js'));
const { TONES } = require(path.join(SCRIPTS, 'layouts', 'svg.js'));
const pictograms = require(path.join(SCRIPTS, 'pictograms.js'));

const EXPECTED = ['chat', 'checklist', 'flow', 'title'];
const CTX = { tone: TONES.amber, protagonist: { name: 'Asha', color: 'teal' } };
const LONG = 'x'.repeat(200);
const TEXT_KEYS = new Set(['label', 'text', 'title', 'footer', 'app', 'value']);

function withLongText(value, key) {
  if (Array.isArray(value)) return value.map((v) => withLongText(v, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withLongText(v, k)]));
  return typeof value === 'string' && TEXT_KEYS.has(key) ? LONG : value;
}

test('registry holds exactly the expected layouts', () => {
  assert.deepEqual(Object.keys(LAYOUTS).sort(), EXPECTED);
  assert.equal(getLayout('flow'), LAYOUTS.flow);
  assert.equal(getLayout('nope'), null);
});

for (const name of EXPECTED) {
  test(`${name}: example slots are valid and render inside the type rules`, () => {
    const layout = LAYOUTS[name];
    assert.equal(layout.name, name);
    assert.deepEqual(checkSlots(layout.slotSchema, layout.example, { hasIcon: pictograms.has }), []);
    if (layout.check) assert.deepEqual(layout.check(layout.example), []);
    const out = layout.render(layout.example, CTX);
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 200, 'renders real markup');
    assert.ok(!/<svg[\s>]/.test(out), 'returns inner markup only');
    const sizes = [...out.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
    assert.ok(sizes.length > 0, 'has text');
    assert.ok(Math.min(...sizes) >= 30, `smallest font is ${Math.min(...sizes)}`);
    assert.ok(out.includes(CTX.tone.accent), 'uses the tone accent');
  });

  test(`${name}: over-long text is truncated, never emitted whole`, () => {
    const layout = LAYOUTS[name];
    const out = layout.render(withLongText(layout.example), CTX);
    assert.ok(!out.includes(LONG), 'the 200 character string must not appear whole');
    assert.ok(out.includes('…'), 'truncation is marked with an ellipsis');
  });
}

test('flow draws one card per step and one arrow between neighbours', () => {
  const steps = [{ icon: 'email', label: 'A' }, { icon: 'chat', label: 'B' }, { icon: 'sheet', label: 'C' }, { icon: 'check', label: 'D' }];
  const out = LAYOUTS.flow.render({ steps }, CTX);
  assert.equal((out.match(/data-role="card"/g) || []).length, 4);
  assert.equal((out.match(/data-role="arrow"/g) || []).length, 3);
});

test('checklist marks each state differently; chat puts the protagonist on the right', () => {
  const list = LAYOUTS.checklist.render({ items: [{ label: 'a', state: 'done' }, { label: 'b', state: 'todo' }, { label: 'c', state: 'problem' }] }, CTX);
  for (const state of ['done', 'todo', 'problem']) assert.ok(list.includes(`data-state="${state}"`), state);
  const chat = LAYOUTS.chat.render({ windows: [{ app: 'Mail', messages: [{ from: 'Asha', text: 'Hi' }, { from: 'Client', text: 'Hello' }] }] }, CTX);
  assert.equal((chat.match(/data-side="right"/g) || []).length, 1);
  assert.equal((chat.match(/data-side="left"/g) || []).length, 1);
});

test('title renders with both halves, one half, or only a footer', () => {
  const both = LAYOUTS.title.render(LAYOUTS.title.example, CTX);
  assert.equal((both.match(/data-role="half"/g) || []).length, 2);
  const footerOnly = LAYOUTS.title.render({ footer: 'The story is illustrative.' }, CTX);
  assert.equal((footerOnly.match(/data-role="half"/g) || []).length, 0);
  assert.ok(footerOnly.includes('The story is illustrative.'));
});
