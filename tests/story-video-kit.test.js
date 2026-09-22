'use strict';
// Tests for the slide kit primitives. Run with: node --test tests/story-video-kit.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '..', 'skills', 'story-video', 'scripts');
const pictograms = require(path.join(SCRIPTS, 'pictograms.js'));
const svg = require(path.join(SCRIPTS, 'layouts', 'svg.js'));
const { checkSlots } = require(path.join(SCRIPTS, 'layouts', 'schema.js'));

const EXPECTED_ICONS = ['calendar', 'camera', 'chart', 'chat', 'check', 'clock', 'cross', 'deck', 'document', 'email', 'handshake', 'laptop', 'link', 'lock', 'megaphone', 'money', 'people', 'person', 'phone', 'search', 'sheet', 'star', 'video', 'warning'];

test('pictograms: the 24 names, tone colour, placement, unknown name', () => {
  assert.deepEqual(pictograms.names(), EXPECTED_ICONS);
  for (const name of EXPECTED_ICONS) {
    const out = pictograms.pictogram(name, { x: 10, y: 20, size: 200, color: '#123456' });
    assert.match(out, /^<g /, name);
    assert.ok(out.includes('translate(10 20) scale(2)'), `${name} placement`);
    assert.ok(out.includes('stroke="#123456"'), `${name} colour`);
    assert.ok(!/<text/.test(out), `${name} must not contain text`);
  }
  assert.equal(pictograms.has('phone'), true);
  assert.equal(pictograms.has('rocket'), false);
  assert.throws(() => pictograms.pictogram('rocket', { x: 0, y: 0, color: '#000' }), /unknown pictogram: rocket/);
});

test('svg helpers: escaping, wrapping with ellipsis, the 30px floor', () => {
  assert.equal(svg.esc('A & B <c> "d"'), 'A &amp; B &lt;c&gt; &quot;d&quot;');
  assert.deepEqual(svg.wrapText('short label', 20, 2), ['short label']);
  assert.deepEqual(svg.wrapText('one two three four five six', 10, 2), ['one two', 'three fou…']);
  assert.deepEqual(svg.wrapText('x'.repeat(50), 10, 1), ['xxxxxxxxx…']);
  assert.equal(svg.maxCharsFor(560, 40), 25);

  const out = svg.textLines({ x: 5, y: 50, lines: ['a & b', 'c'], size: 34, weight: 600, fill: '#101a19', anchor: 'middle' });
  assert.match(out, /^<text /);
  assert.ok(out.includes('font-size="34"') && out.includes('text-anchor="middle"') && out.includes('font-weight="600"'));
  assert.equal((out.match(/<tspan /g) || []).length, 2);
  assert.ok(out.includes('a &amp; b'));
  assert.throws(() => svg.textLines({ x: 0, y: 0, lines: ['x'], size: 29, fill: '#000' }), RangeError);
  assert.deepEqual(Object.keys(svg.TONES).sort(), ['amber', 'teal']);
});

test('checkSlots: valid slots pass; each kind of violation is reported with its path', () => {
  const shape = {
    steps: { array: { min: 2, max: 3, of: { icon: 'icon', label: 'string', note: 'string?' } } },
    state: { enum: ['done', 'todo'] },
    footer: 'string?',
    flag: 'bool?',
    window: { shape: { title: 'string', count: 'number' }, optional: true },
  };
  const hasIcon = (n) => n === 'chat' || n === 'phone';
  const good = { steps: [{ icon: 'chat', label: 'A' }, { icon: 'phone', label: 'B', note: 'n' }], state: 'done' };
  assert.deepEqual(checkSlots(shape, good, { hasIcon }), []);

  const bad = {
    steps: [{ icon: 'rocket', label: '' }],
    state: 'later',
    footer: 7,
    flag: 'yes',
    window: { title: 'T', count: 'three' },
    extra: 1,
  };
  const errors = checkSlots(shape, bad, { hasIcon });
  const expectIncludes = (needle) => assert.ok(errors.some((e) => e.includes(needle)), `${needle}\n${errors.join('\n')}`);
  expectIncludes('slots.steps: expected 2 to 3 items, got 1');
  expectIncludes('slots.steps[0].icon: unknown icon "rocket"');
  expectIncludes('slots.steps[0].label: expected a non-empty string');
  expectIncludes('slots.state: expected one of done, todo');
  expectIncludes('slots.footer: expected a non-empty string');
  expectIncludes('slots.flag: expected a boolean');
  expectIncludes('slots.window.count: expected a number');
  expectIncludes('slots.extra: unknown slot');
  assert.deepEqual(checkSlots(shape, undefined, { hasIcon }), ['slots: expected an object']);
  assert.ok(checkSlots(shape, { state: 'done' }, { hasIcon }).some((e) => e.includes('slots.steps: required')));
});
