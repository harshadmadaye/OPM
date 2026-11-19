'use strict';
// checklist: a list of labelled rows each marked done, todo or problem.
// Up to 3 items sit in a single centred column; more items split into two
// 840-wide columns.
const { pictogram } = require('../pictograms');
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const COLUMN_WIDTH = 840;
const ROW_HEIGHT = 130;
const MARKER_SIZE = 70;
const TODO_RADIUS = 30;
const LABEL_SIZE = 38;
const PROBLEM_COLOR = '#b3261e';
const SINGLE_COLUMN_THRESHOLD = 3;

const slotSchema = {
  items: { array: { min: 2, max: 6, of: { label: 'string', state: { enum: ['done', 'todo', 'problem'] } } } },
};

const example = {
  items: [
    { label: 'Reply to every enquiry within an hour', state: 'done' },
    { label: 'Log follow-ups in the shared sheet', state: 'done' },
    { label: 'Chase invoices past thirty days', state: 'todo' },
    { label: 'Duplicate entries live across three tools', state: 'problem' },
  ],
};

function renderMarker(state, cx, cy, ctx) {
  if (state === 'done') {
    return pictogram('check', { x: cx - MARKER_SIZE / 2, y: cy - MARKER_SIZE / 2, size: MARKER_SIZE, color: ctx.tone.accent });
  }
  if (state === 'problem') {
    return pictogram('warning', { x: cx - MARKER_SIZE / 2, y: cy - MARKER_SIZE / 2, size: MARKER_SIZE, color: PROBLEM_COLOR });
  }
  return `<circle cx="${cx}" cy="${cy}" r="${TODO_RADIUS}" fill="none" stroke="${COLORS.line}" stroke-width="4"/>`;
}

function renderRow(item, x, y, width, ctx) {
  const markerCx = x + 60;
  const markerCy = y + ROW_HEIGHT / 2;
  const marker = renderMarker(item.state, markerCx, markerCy, ctx);
  const labelX = x + 140;
  const maxChars = maxCharsFor(width - 160, LABEL_SIZE);
  const label = textLines({
    x: labelX,
    y: y + ROW_HEIGHT / 2 - 4,
    lines: wrapText(item.label, maxChars, 2),
    size: LABEL_SIZE,
    weight: 600,
    fill: COLORS.ink,
    anchor: 'start',
  });
  return `<g data-state="${item.state}">${marker}${label}</g>`;
}

function renderColumn(items, x, ctx) {
  const totalHeight = items.length * ROW_HEIGHT;
  const top = Math.round((STAGE_HEIGHT - totalHeight) / 2);
  return items.map((item, i) => renderRow(item, x, top + i * ROW_HEIGHT, COLUMN_WIDTH, ctx)).join('\n');
}

function render(slots, ctx) {
  const items = slots.items;
  if (items.length <= SINGLE_COLUMN_THRESHOLD) {
    return renderColumn(items, Math.round((STAGE_WIDTH - COLUMN_WIDTH) / 2), ctx);
  }
  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half);
  const right = items.slice(half);
  return renderColumn(left, 0, ctx) + '\n' + renderColumn(right, STAGE_WIDTH - COLUMN_WIDTH, ctx);
}

module.exports = { name: 'checklist', slotSchema, example, render };
