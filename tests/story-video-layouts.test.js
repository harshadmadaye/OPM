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

const EXPECTED = ['chat', 'checklist', 'crossed', 'flow', 'funnel', 'roadmap', 'spreadsheet', 'title', 'wireframe'];
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

test('spreadsheet draws a header and one row group per row, highlights cells, and checks row width', () => {
  const slots = { columns: ['Creator', 'Rate', 'Status'], rows: [['Asha', '20k', 'Yes'], ['Ravi', '35k', 'No']], highlight: [[1, 2]] };
  const out = LAYOUTS.spreadsheet.render(slots, CTX);
  assert.equal((out.match(/data-role="row"/g) || []).length, 2);
  assert.equal((out.match(/data-role="highlight"/g) || []).length, 1);
  assert.deepEqual(LAYOUTS.spreadsheet.check(slots), []);
  const ragged = LAYOUTS.spreadsheet.check({ columns: ['A', 'B'], rows: [['1', '2'], ['1']] });
  assert.ok(ragged.some((e) => e.includes('slots.rows[1]: expected 2 cells, got 1')));
  const outside = LAYOUTS.spreadsheet.check({ columns: ['A', 'B'], rows: [['1', '2'], ['3', '4']], highlight: [[5, 0]] });
  assert.ok(outside.some((e) => e.includes('slots.highlight[0]: outside the table')));
});

test('funnel bars narrow from top to bottom', () => {
  const out = LAYOUTS.funnel.render({ stages: [{ label: 'Found', value: '120' }, { label: 'Replied', value: '40' }, { label: 'Signed', value: '5' }] }, CTX);
  const widths = [...out.matchAll(/data-role="stage" [^>]*width="(\d+)"/g)].map((m) => Number(m[1]));
  assert.equal(widths.length, 3);
  assert.ok(widths[0] > widths[1] && widths[1] > widths[2], widths.join(','));
});

test('wireframe draws the window, its nav items and one group per panel', () => {
  const out = LAYOUTS.wireframe.render({ window: { title: 'Campaigns', nav: ['Home', 'Creators'], panels: [{ title: 'Shortlist', lines: 3 }, { title: 'Budget', lines: 2 }] } }, CTX);
  assert.equal((out.match(/data-role="panel"/g) || []).length, 2);
  assert.equal((out.match(/data-role="placeholder"/g) || []).length, 5);
  assert.ok(out.includes('Campaigns') && out.includes('Creators'));
});

test('crossed strikes only the crossed cards; roadmap numbers its phases', () => {
  const crossed = LAYOUTS.crossed.render({ cards: [{ icon: 'sheet', label: 'Spreadsheets', crossed: true }, { icon: 'laptop', label: 'One workspace', crossed: false }] }, CTX);
  assert.equal((crossed.match(/data-role="strike"/g) || []).length, 1);
  const roadmap = LAYOUTS.roadmap.render({ phases: [{ label: 'Foundation', items: ['Login'] }, { label: 'Discovery', items: ['Search', 'Lists'] }, { label: 'Reporting', items: ['Exports'] }] }, CTX);
  assert.equal((roadmap.match(/data-role="phase"/g) || []).length, 3);
  assert.ok(roadmap.includes('>1<') && roadmap.includes('>3<'));
});
