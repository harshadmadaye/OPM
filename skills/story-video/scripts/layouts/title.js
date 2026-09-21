'use strict';
// title: an optional left/right half panel pair, each with a label and icons,
// plus an optional footer line. With neither half nor a footer, draws a
// centred accent bar so the stage is never empty.
const { pictogram } = require('../pictograms');
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const PANEL_WIDTH = 840;
const PANEL_HEIGHT = 400;
const PANEL_Y = Math.round((STAGE_HEIGHT - PANEL_HEIGHT) / 2);
const LEFT_X = 0;
const RIGHT_X = STAGE_WIDTH - PANEL_WIDTH;
const CENTER_X = Math.round((STAGE_WIDTH - PANEL_WIDTH) / 2);
const LABEL_SIZE = 44;
const ICON_SIZE = 120;
const ICON_GAP = 30;
const FOOTER_SIZE = 32;
const FOOTER_Y = 505;
const BAR_WIDTH = 600;
const BAR_HEIGHT = 12;

const slotSchema = {
  left: { shape: { label: 'string', icons: { array: { min: 1, max: 4, of: 'icon' } } }, optional: true },
  right: { shape: { label: 'string', icons: { array: { min: 1, max: 4, of: 'icon' } } }, optional: true },
  footer: 'string?',
};

const example = {
  left: { label: 'Before: scattered spreadsheets', icons: ['sheet', 'search'] },
  right: { label: 'After: one shared dashboard', icons: ['chart'] },
  footer: 'A composite story, not a specific client.',
};

function renderHalf(half, x, fill, ctx) {
  const labelY = PANEL_Y + 90;
  const maxChars = maxCharsFor(PANEL_WIDTH - 80, LABEL_SIZE);
  const label = textLines({
    x: x + PANEL_WIDTH / 2,
    y: labelY,
    lines: wrapText(half.label, maxChars, 2),
    size: LABEL_SIZE,
    weight: 700,
    fill: COLORS.ink,
    anchor: 'middle',
  });
  const count = half.icons.length;
  const totalWidth = count * ICON_SIZE + (count - 1) * ICON_GAP;
  const startX = x + (PANEL_WIDTH - totalWidth) / 2;
  const iconY = PANEL_Y + PANEL_HEIGHT - ICON_SIZE - 50;
  const icons = half.icons
    .map((icon, i) => pictogram(icon, { x: startX + i * (ICON_SIZE + ICON_GAP), y: iconY, size: ICON_SIZE, color: ctx.tone.accent }))
    .join('');
  const panel = `<rect x="${x}" y="${PANEL_Y}" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}" rx="28" fill="${fill}"/>`;
  return `<g data-role="half">${panel}${label}${icons}</g>`;
}

function renderFooter(footer) {
  const maxChars = maxCharsFor(STAGE_WIDTH - 200, FOOTER_SIZE);
  return textLines({
    x: STAGE_WIDTH / 2,
    y: FOOTER_Y,
    lines: wrapText(footer, maxChars, 1),
    size: FOOTER_SIZE,
    weight: 500,
    fill: COLORS.ink2,
    anchor: 'middle',
  });
}

function render(slots, ctx) {
  const hasLeft = !!slots.left;
  const hasRight = !!slots.right;
  const halves = [];
  if (hasLeft) {
    const x = hasRight ? LEFT_X : CENTER_X;
    halves.push(renderHalf(slots.left, x, COLORS.surface, ctx));
  }
  if (hasRight) {
    const x = hasLeft ? RIGHT_X : CENTER_X;
    halves.push(renderHalf(slots.right, x, ctx.tone.soft, ctx));
  }
  const footer = slots.footer ? renderFooter(slots.footer) : '';

  if (halves.length === 0 && !slots.footer) {
    const barX = (STAGE_WIDTH - BAR_WIDTH) / 2;
    const barY = (STAGE_HEIGHT - BAR_HEIGHT) / 2;
    return `<rect x="${barX}" y="${barY}" width="${BAR_WIDTH}" height="${BAR_HEIGHT}" rx="6" fill="${ctx.tone.accent}"/>`;
  }

  return halves.join('\n') + footer;
}

module.exports = { name: 'title', slotSchema, example, render };
