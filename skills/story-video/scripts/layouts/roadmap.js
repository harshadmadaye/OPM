'use strict';
// roadmap: phases spaced evenly along a horizontal accent line, each numbered
// and holding a label plus a short bulleted list of items.
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH } = require('../lib/constants');

const LINE_Y = 90;
const LINE_WIDTH = 4;
const CIRCLE_RADIUS = 36;
const NUMBER_SIZE = 34;
const LABEL_SIZE = 38;
const ITEM_SIZE = 30;
const ITEM_HEIGHT = 40;
const LABEL_TOP_GAP = 50;
const LABEL_LINE_HEIGHT = LABEL_SIZE * 1.2;
const ITEMS_TOP_GAP = 40;
const COLUMN_PAD = 40;
const BULLET = '•';

const slotSchema = {
  phases: { array: { min: 2, max: 5, of: { label: 'string', items: { array: { min: 1, max: 3, of: 'string' } } } } },
};

const example = {
  phases: [
    { label: 'Foundation', items: ['Sign-in', 'Creator profiles'] },
    { label: 'Discovery', items: ['Search', 'Shortlists'] },
    { label: 'Reporting', items: ['Exports', 'Dashboards'] },
  ],
};

function renderPhase(phase, index, colWidth, ctx) {
  const cx = index * colWidth + colWidth / 2;

  const circle = `<circle cx="${cx}" cy="${LINE_Y}" r="${CIRCLE_RADIUS}" fill="${ctx.tone.accent}"/>`;
  const number = textLines({
    x: cx,
    y: LINE_Y + NUMBER_SIZE * 0.35,
    lines: [String(index + 1)],
    size: NUMBER_SIZE,
    weight: 700,
    fill: '#ffffff',
    anchor: 'middle',
  });

  const labelMaxChars = maxCharsFor(colWidth - COLUMN_PAD, LABEL_SIZE);
  const labelY = LINE_Y + CIRCLE_RADIUS + LABEL_TOP_GAP;
  const label = textLines({
    x: cx,
    y: labelY,
    lines: wrapText(phase.label, labelMaxChars, 2),
    size: LABEL_SIZE,
    weight: 700,
    fill: COLORS.ink,
    anchor: 'middle',
  });

  const itemsMaxChars = maxCharsFor(colWidth - COLUMN_PAD, ITEM_SIZE);
  const itemsStartY = labelY + LABEL_LINE_HEIGHT + ITEMS_TOP_GAP;
  const items = phase.items
    .map((item, i) => {
      const line = wrapText(`${BULLET} ${item}`, itemsMaxChars, 1)[0];
      return textLines({
        x: cx,
        y: itemsStartY + i * ITEM_HEIGHT,
        lines: [line],
        size: ITEM_SIZE,
        weight: 500,
        fill: COLORS.ink2,
        anchor: 'middle',
      });
    })
    .join('');

  return `<g data-role="phase">${circle}${number}${label}${items}</g>`;
}

function render(slots, ctx) {
  const colWidth = Math.floor(STAGE_WIDTH / slots.phases.length);
  const line = `<line x1="0" y1="${LINE_Y}" x2="${STAGE_WIDTH}" y2="${LINE_Y}" stroke="${ctx.tone.accent}" stroke-width="${LINE_WIDTH}"/>`;
  const phases = slots.phases.map((phase, i) => renderPhase(phase, i, colWidth, ctx)).join('\n');
  return line + phases;
}

module.exports = { name: 'roadmap', slotSchema, example, render };
