'use strict';
// spreadsheet: a header row plus body rows of cell text, spanning the full
// stage width, with an optional set of highlighted cells.
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const MAX_ROW_HEIGHT = 74;
const CELL_SIZE = 30;
const CELL_PADDING = 20;
const GRID_STROKE = 2;
const HIGHLIGHT_STROKE = 3;

const slotSchema = {
  columns: { array: { min: 2, max: 6, of: 'string' } },
  rows: { array: { min: 2, max: 6, of: { array: { min: 1, max: 6, of: 'string' } } } },
  highlight: { array: { min: 0, max: 12, of: { array: { min: 2, max: 2, of: 'number' } } }, optional: true },
};

const example = {
  columns: ['Creator', 'Rate', 'Status'],
  rows: [
    ['Asha Patel', '₹20k', 'Confirmed, contract signed and payment released'],
    ['Ravi Shah', '₹35k', 'Pending'],
    ['Mira Nair', '₹18k', 'Confirmed'],
  ],
  highlight: [[1, 2]],
};

function check(slots) {
  const errors = [];
  const colCount = slots.columns.length;
  slots.rows.forEach((row, i) => {
    if (row.length !== colCount) {
      errors.push(`slots.rows[${i}]: expected ${colCount} cells, got ${row.length}`);
    }
  });
  const highlight = slots.highlight || [];
  highlight.forEach(([row, col], i) => {
    if (row < 0 || row >= slots.rows.length || col < 0 || col >= colCount) {
      errors.push(`slots.highlight[${i}]: outside the table`);
    }
  });
  return errors;
}

function columnGeometry(colCount) {
  const width = Math.floor(STAGE_WIDTH / colCount);
  const xs = [];
  const widths = [];
  for (let i = 0; i < colCount; i += 1) {
    const x = i * width;
    xs.push(x);
    widths.push(i === colCount - 1 ? STAGE_WIDTH - x : width);
  }
  return { xs, widths };
}

function renderCell(text, x, width, y, rowHeight, weight, fill) {
  const maxChars = maxCharsFor(width - CELL_PADDING * 2, CELL_SIZE);
  return textLines({
    x: x + CELL_PADDING,
    y: y + rowHeight / 2 + CELL_SIZE * 0.35,
    lines: wrapText(text, maxChars, 1),
    size: CELL_SIZE,
    weight,
    fill,
    anchor: 'start',
  });
}

function renderHeader(columns, top, rowHeight, xs, widths, ctx) {
  const bg = `<rect x="0" y="${top}" width="${STAGE_WIDTH}" height="${rowHeight}" fill="${ctx.tone.soft}"/>`;
  const texts = columns
    .map((col, i) => renderCell(col, xs[i], widths[i], top, rowHeight, 700, COLORS.ink))
    .join('');
  return `<g data-role="header">${bg}${texts}</g>`;
}

function renderRow(row, rowIndex, top, rowHeight, xs, widths, ctx, highlightSet) {
  const y = top + rowHeight * (rowIndex + 1);
  const highlights = row
    .map((_, c) => {
      if (!highlightSet.has(`${rowIndex}:${c}`)) return '';
      return `<rect data-role="highlight" x="${xs[c]}" y="${y}" width="${widths[c]}" height="${rowHeight}" fill="${ctx.tone.soft}" stroke="${ctx.tone.accent}" stroke-width="${HIGHLIGHT_STROKE}"/>`;
    })
    .join('');
  const cells = row.map((cell, c) => renderCell(cell, xs[c], widths[c], y, rowHeight, 500, COLORS.ink)).join('');
  return `<g data-role="row">${highlights}${cells}</g>`;
}

function renderGrid(top, rowHeight, rowCount, xs) {
  const bottom = top + rowHeight * (rowCount + 1);
  const outline = `<rect x="0" y="${top}" width="${STAGE_WIDTH}" height="${bottom - top}" fill="none" stroke="${COLORS.line}" stroke-width="${GRID_STROKE}"/>`;
  const verticals = xs
    .slice(1)
    .map((x) => `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${COLORS.line}" stroke-width="${GRID_STROKE}"/>`)
    .join('');
  const horizontals = [];
  for (let i = 1; i <= rowCount; i += 1) {
    const y = top + rowHeight * i;
    horizontals.push(`<line x1="0" y1="${y}" x2="${STAGE_WIDTH}" y2="${y}" stroke="${COLORS.line}" stroke-width="${GRID_STROKE}"/>`);
  }
  return outline + verticals + horizontals.join('');
}

function render(slots, ctx) {
  const { columns, rows } = slots;
  const highlight = slots.highlight || [];
  const rowCount = rows.length;
  const colCount = columns.length;
  const rowHeight = Math.min(MAX_ROW_HEIGHT, Math.floor(STAGE_HEIGHT / (rowCount + 1)));
  const tableHeight = rowHeight * (rowCount + 1);
  const top = Math.round((STAGE_HEIGHT - tableHeight) / 2);
  const { xs, widths } = columnGeometry(colCount);
  const highlightSet = new Set(highlight.map(([row, col]) => `${row}:${col}`));

  const grid = renderGrid(top, rowHeight, rowCount, xs);
  const header = renderHeader(columns, top, rowHeight, xs, widths, ctx);
  const body = rows.map((row, i) => renderRow(row, i, top, rowHeight, xs, widths, ctx, highlightSet)).join('\n');

  return grid + header + body;
}

module.exports = { name: 'spreadsheet', slotSchema, example, render, check };
