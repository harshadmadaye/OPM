'use strict';
// A dependency-free checkbox picker for the installer. The key handling is a
// pure reducer (tested on its own); `pick` wires it to a real terminal.

const readline = require('node:readline');

const ACTION_ROWS = ['Select all', 'Submit'];
const HINT = '↑/↓ move · enter or space ticks · a selects all · enter on Submit finishes';

const dim = (s) => `\u001b[2m${s}\u001b[0m`;
const cyan = (s) => `\u001b[36m${s}\u001b[0m`;

function createState(items, preselected) {
  return { items, ticked: items.map((item) => preselected.includes(item)), cursor: 0 };
}

function selected(state) {
  return state.items.filter((_, i) => state.ticked[i]);
}

const rowCount = (state) => state.items.length + ACTION_ROWS.length;
const move = (state, step) => ({ ...state, cursor: (state.cursor + step + rowCount(state)) % rowCount(state) });

function toggleAll(state) {
  const allTicked = state.ticked.every(Boolean);
  return { ...state, ticked: state.ticked.map(() => !allTicked) };
}

function activate(state) {
  const { cursor, items } = state;
  if (cursor < items.length) return { state: { ...state, ticked: state.ticked.map((t, i) => (i === cursor ? !t : t)) } };
  if (cursor === items.length) return { state: toggleAll(state) };
  return { state, done: true };
}

// Returns { state, done?, cancelled? } for one key press; never mutates `state`.
function reduce(state, key) {
  if ((key.ctrl && key.name === 'c') || key.name === 'escape') return { state, cancelled: true };
  if (key.name === 'up' || key.name === 'k') return { state: move(state, -1) };
  if (key.name === 'down' || key.name === 'j') return { state: move(state, 1) };
  if (key.name === 'a') return { state: toggleAll(state) };
  if (key.name === 'return' || key.name === 'space') return activate(state);
  return { state };
}

function render(state) {
  const pointer = (row) => (row === state.cursor ? cyan('❯') : ' ');
  const lines = state.items.map((item, i) => `${pointer(i)} ${state.ticked[i] ? '[x]' : '[ ]'} ${item}`);
  ACTION_ROWS.forEach((label, i) => lines.push(`${pointer(state.items.length + i)} ${label}`));
  lines.push(dim(HINT));
  return lines.join('\n');
}

// Shows the picker on a TTY. Resolves with the ticked items, or null when cancelled.
function pick(items, preselected, { input = process.stdin, output = process.stdout, indent = '  ' } = {}) {
  return new Promise((resolve) => {
    let state = createState(items, preselected);
    let drawnLines = 0;
    const draw = () => {
      const lines = render(state).split('\n');
      if (drawnLines) output.write(`\u001b[${drawnLines}A\r\u001b[0J`);
      output.write(`${lines.map((line) => indent + line).join('\n')}\n`);
      drawnLines = lines.length;
    };

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    output.write('\u001b[?25l');
    draw();

    const finish = (value) => {
      input.removeListener('keypress', onKey);
      input.setRawMode(false);
      input.pause();
      output.write('\u001b[?25h');
      resolve(value);
    };

    function onKey(_, key) {
      if (!key) return;
      const result = reduce(state, key);
      state = result.state;
      if (result.cancelled) return finish(null);
      draw();
      if (result.done) finish(selected(state));
    }
    input.on('keypress', onKey);
  });
}

module.exports = { createState, reduce, render, selected, pick };
