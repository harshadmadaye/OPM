'use strict';
// Tests for the installer's checkbox picker. Run with: node --test tests/multiselect.test.js
// The key handling is a pure function, so nothing here needs a real terminal.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createState, reduce, render, selected } = require(path.resolve(__dirname, '..', 'bin', 'multiselect.js'));

const ITEMS = ['typescript', 'react', 'python', 'dart'];
const press = (state, ...keys) => keys.reduce((s, name) => reduce(s, typeof name === 'string' ? { name } : name).state, state);

test('starts on the first item with the guessed items ticked', () => {
  const state = createState(ITEMS, ['typescript']);
  assert.equal(state.cursor, 0);
  assert.deepEqual(selected(state), ['typescript']);
});

test('enter and space tick and untick the item under the cursor', () => {
  let state = createState(ITEMS, []);
  state = press(state, 'down', 'return');
  assert.deepEqual(selected(state), ['react']);
  state = press(state, 'space');
  assert.deepEqual(selected(state), []);
});

test('arrows and j/k move the cursor and wrap round the list', () => {
  let state = createState(ITEMS, []);
  const rows = ITEMS.length + 2;
  state = press(state, 'up');
  assert.equal(state.cursor, rows - 1, 'up from the top wraps to Submit');
  state = press(state, 'j', 'k', 'down');
  assert.equal(state.cursor, 0, 'down from Submit wraps to the top');
});

test('Select all ticks everything, and clears everything when all are ticked', () => {
  let state = createState(ITEMS, ['python']);
  const selectAllRow = ITEMS.length;
  state = { ...state, cursor: selectAllRow };
  state = press(state, 'return');
  assert.deepEqual(selected(state), ITEMS);
  state = press(state, 'return');
  assert.deepEqual(selected(state), []);
});

test('the a key toggles select all from anywhere', () => {
  const state = press(createState(ITEMS, []), 'a');
  assert.deepEqual(selected(state), ITEMS);
});

test('enter on Submit finishes with the ticked items in list order', () => {
  let state = createState(ITEMS, []);
  state = press(state, 'down', 'down', 'return', 'up', 'up', 'return');
  state = { ...state, cursor: ITEMS.length + 1 };
  const result = reduce(state, { name: 'return' });
  assert.equal(result.done, true);
  assert.deepEqual(selected(result.state), ['typescript', 'python']);
});

test('ctrl+c and escape cancel', () => {
  const state = createState(ITEMS, []);
  assert.equal(reduce(state, { name: 'c', ctrl: true }).cancelled, true);
  assert.equal(reduce(state, { name: 'escape' }).cancelled, true);
});

test('reduce never mutates the state it was given', () => {
  const state = createState(ITEMS, ['react']);
  const before = JSON.stringify(state);
  press(state, 'down', 'return', 'a', 'up');
  assert.equal(JSON.stringify(state), before);
});

test('render shows ticks, the cursor, both actions and a key hint', () => {
  const plain = render(createState(ITEMS, ['react'])).replace(/\u001b\[[0-9;]*m/g, '');
  const lines = plain.split('\n');
  assert.equal(lines.length, ITEMS.length + 3, 'items, Select all, Submit, hint');
  assert.match(lines[0], /❯ \[ \] typescript/);
  assert.match(lines[1], /  \[x\] react/);
  assert.match(lines[ITEMS.length], /Select all/);
  assert.match(lines[ITEMS.length + 1], /Submit/);
  assert.match(lines.at(-1), /enter/i);
});
