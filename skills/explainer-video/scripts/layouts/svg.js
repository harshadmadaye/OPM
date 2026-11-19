'use strict';
// SVG text and colour helpers shared by every slide layout.
const { MIN_FONT } = require('../lib/constants.js');

const COLORS = Object.freeze({
  ground: '#f2f5f4',
  surface: '#ffffff',
  ink: '#101a19',
  ink2: '#445553',
  line: '#d3dcda',
});

const TONES = Object.freeze({
  amber: Object.freeze({ accent: '#b26a00', soft: '#f6ecd8' }),
  teal: Object.freeze({ accent: '#0d6d67', soft: '#dcecea' }),
});

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function maxCharsFor(width, size) {
  // A tiny epsilon guards against binary floating-point rounding (e.g.
  // 40 * 0.56 landing a hair above 22.4) pushing an exact ratio down a step.
  return Math.floor(width / (size * 0.56) + 1e-9);
}

// Greedy word wrap to maxChars per line. A single word longer than maxChars
// is cut into maxChars-sized pieces. When more lines remain than maxLines
// allows, the last kept line is trimmed to maxChars - 1 chars and gets a
// trailing ellipsis.
function wrapText(text, maxChars, maxLines = 2) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const pieces = [];
  for (const word of words) {
    if (word.length > maxChars) {
      for (let i = 0; i < word.length; i += maxChars) {
        pieces.push(word.slice(i, i + maxChars));
      }
    } else {
      pieces.push(word);
    }
  }

  const lines = [];
  let current = '';
  for (const piece of pieces) {
    if (current === '') {
      current = piece;
    } else if ((current + ' ' + piece).length <= maxChars) {
      current = current + ' ' + piece;
    } else {
      lines.push(current);
      current = piece;
    }
  }
  if (current !== '') lines.push(current);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] = last.slice(0, maxChars - 1).replace(/\s+$/, '') + '…';
    return kept;
  }
  return lines;
}

function textLines({ x, y, lines, size, weight = 500, fill, anchor = 'start', lineHeight = 1.2 }) {
  if (size < MIN_FONT) {
    throw new RangeError(`text size ${size}px is below the ${MIN_FONT}px floor`);
  }
  const tspans = lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * lineHeight}">${esc(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${tspans}</text>`;
}

module.exports = { COLORS, TONES, esc, maxCharsFor, wrapText, textLines };
