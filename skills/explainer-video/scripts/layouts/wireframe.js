'use strict';
// wireframe: an app window mockup with a title bar, a left nav and a grid of
// content panels, each holding a title and a stack of placeholder bars.
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const TITLE_BAR_HEIGHT = 60;
const NAV_WIDTH = 280;
const DOT_RADIUS = 6;
const DOT_GAP = 22;
const DOT_START_X = 24;
const TITLE_SIZE = 30;
const NAV_ITEM_SIZE = 30;
const NAV_ITEM_HEIGHT = 56;
const NAV_TOP_PAD = 30;
const PANEL_TITLE_SIZE = 32;
const PANEL_PAD = 24;
const PANEL_GAP = 20;
const PLACEHOLDER_HEIGHT = 18;
const PLACEHOLDER_GAP = 14;
const PLACEHOLDER_STEP = 60;
const MIN_LINES = 1;
const MAX_LINES = 4;

const slotSchema = {
  window: {
    title: 'string',
    nav: { array: { min: 0, max: 5, of: 'string' } },
    panels: { array: { min: 1, max: 4, of: { title: 'string', lines: 'number' } } },
  },
};

const example = {
  window: {
    title: 'Creator campaigns',
    nav: ['Home', 'Creators', 'Reports'],
    panels: [
      { title: 'Shortlist', lines: 3 },
      { title: 'Budget', lines: 2 },
    ],
  },
};

function check(slots) {
  const errors = [];
  slots.window.panels.forEach((panel, i) => {
    if (panel.lines < MIN_LINES || panel.lines > MAX_LINES) {
      errors.push(`slots.window.panels[${i}].lines: expected ${MIN_LINES} to ${MAX_LINES}`);
    }
  });
  return errors;
}

function renderTitleBar(title, ctx) {
  const bar = `<rect x="0" y="0" width="${STAGE_WIDTH}" height="${TITLE_BAR_HEIGHT}" fill="${ctx.tone.soft}"/>`;
  const dots = [0, 1, 2]
    .map((i) => `<circle cx="${DOT_START_X + i * DOT_GAP}" cy="${TITLE_BAR_HEIGHT / 2}" r="${DOT_RADIUS}" fill="${COLORS.ink2}"/>`)
    .join('');
  const titleX = DOT_START_X + 2 * DOT_GAP + 40;
  const maxChars = maxCharsFor(STAGE_WIDTH - titleX - PANEL_PAD, TITLE_SIZE);
  const label = textLines({
    x: titleX,
    y: TITLE_BAR_HEIGHT / 2 + TITLE_SIZE * 0.35,
    lines: wrapText(title, maxChars, 1),
    size: TITLE_SIZE,
    weight: 700,
    fill: COLORS.ink,
    anchor: 'start',
  });
  return bar + dots + label;
}

function renderNav(nav, ctx) {
  const bg = `<rect x="0" y="${TITLE_BAR_HEIGHT}" width="${NAV_WIDTH}" height="${STAGE_HEIGHT - TITLE_BAR_HEIGHT}" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="2"/>`;
  const maxChars = maxCharsFor(NAV_WIDTH - 60, NAV_ITEM_SIZE);
  const items = nav
    .map((item, i) => {
      const y = TITLE_BAR_HEIGHT + NAV_TOP_PAD + i * NAV_ITEM_HEIGHT + NAV_ITEM_SIZE;
      const fill = i === 0 ? ctx.tone.accent : COLORS.ink2;
      return textLines({ x: 30, y, lines: wrapText(item, maxChars, 1), size: NAV_ITEM_SIZE, weight: 600, fill, anchor: 'start' });
    })
    .join('');
  return bg + items;
}

function panelRows(panels) {
  if (panels.length <= 2) return [panels];
  const firstCount = Math.ceil(panels.length / 2);
  return [panels.slice(0, firstCount), panels.slice(firstCount)];
}

function renderPanel(panel, x, y, width, height) {
  const box = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="2"/>`;
  const titleMaxChars = maxCharsFor(width - PANEL_PAD * 2, PANEL_TITLE_SIZE);
  const title = textLines({
    x: x + PANEL_PAD,
    y: y + PANEL_PAD + PANEL_TITLE_SIZE * 0.8,
    lines: wrapText(panel.title, titleMaxChars, 1),
    size: PANEL_TITLE_SIZE,
    weight: 600,
    fill: COLORS.ink,
    anchor: 'start',
  });
  const barsTop = y + PANEL_PAD + PANEL_TITLE_SIZE + 20;
  const bars = Array.from({ length: panel.lines }, (_, j) => {
    const barWidth = Math.max(width - PANEL_PAD * 2 - j * PLACEHOLDER_STEP, PLACEHOLDER_STEP);
    const barY = barsTop + j * (PLACEHOLDER_HEIGHT + PLACEHOLDER_GAP);
    return `<rect data-role="placeholder" x="${x + PANEL_PAD}" y="${barY}" width="${barWidth}" height="${PLACEHOLDER_HEIGHT}" rx="6" fill="${COLORS.line}"/>`;
  }).join('');
  return `<g data-role="panel">${box}${title}${bars}</g>`;
}

function render(slots, ctx) {
  const { window } = slots;
  const frame = `<rect x="0" y="0" width="${STAGE_WIDTH}" height="${STAGE_HEIGHT}" rx="20" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="3"/>`;
  const titleBar = renderTitleBar(window.title, ctx);
  const nav = renderNav(window.nav, ctx);

  const contentX = NAV_WIDTH;
  const contentY = TITLE_BAR_HEIGHT;
  const contentWidth = STAGE_WIDTH - NAV_WIDTH;
  const contentHeight = STAGE_HEIGHT - TITLE_BAR_HEIGHT;

  const rows = panelRows(window.panels);
  const rowHeight = Math.floor((contentHeight - PANEL_GAP * (rows.length - 1)) / rows.length);
  const panels = rows
    .map((row, ri) => {
      const rowY = contentY + ri * (rowHeight + PANEL_GAP);
      const colWidth = Math.floor((contentWidth - PANEL_GAP * (row.length - 1)) / row.length);
      return row
        .map((panel, ci) => {
          const panelX = contentX + ci * (colWidth + PANEL_GAP);
          return renderPanel(panel, panelX, rowY, colWidth, rowHeight);
        })
        .join('');
    })
    .join('');

  return frame + titleBar + nav + panels;
}

module.exports = { name: 'wireframe', slotSchema, example, render, check };
