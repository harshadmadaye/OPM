'use strict';
// crossed: a row of cards like flow, without arrows. A card marked crossed
// is dimmed and struck through to show it being ruled out.
const { pictogram } = require('../pictograms');
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const GAP = 70;
const CARD_HEIGHT = 410;
const ICON_SIZE = 150;
const LABEL_SIZE = 36;
const STRIKE_COLOR = '#b3261e';
const STRIKE_INSET = 40;
const STRIKE_WIDTH = 8;
const CROSSED_OPACITY = 0.45;

const slotSchema = { cards: { array: { min: 2, max: 4, of: { icon: 'icon', label: 'string', crossed: 'bool?' } } } };

const example = {
  cards: [
    { icon: 'sheet', label: 'Spreadsheets everywhere', crossed: true },
    { icon: 'email', label: 'Status updates by email', crossed: true },
    { icon: 'laptop', label: 'One shared workspace', crossed: false },
  ],
};

function renderStrike(x, top, width) {
  const x1 = x + STRIKE_INSET;
  const y1 = top + STRIKE_INSET;
  const x2 = x + width - STRIKE_INSET;
  const y2 = top + CARD_HEIGHT - STRIKE_INSET;
  return `<path data-role="strike" d="M${x1} ${y1} L${x2} ${y2} M${x1} ${y2} L${x2} ${y1}" fill="none" stroke="${STRIKE_COLOR}" stroke-width="${STRIKE_WIDTH}" stroke-linecap="round"/>`;
}

function render(slots, ctx) {
  const count = slots.cards.length;
  const cardWidth = Math.floor((STAGE_WIDTH - GAP * (count - 1)) / count);
  const top = Math.round((STAGE_HEIGHT - CARD_HEIGHT) / 2);
  const maxChars = maxCharsFor(cardWidth - 48, LABEL_SIZE);

  return slots.cards
    .map((card, i) => {
      const x = i * (cardWidth + GAP);
      const crossed = !!card.crossed;
      const iconColor = crossed ? COLORS.ink2 : ctx.tone.accent;
      const labelColor = crossed ? COLORS.ink2 : COLORS.ink;

      const box = `<rect data-role="card" x="${x}" y="${top}" width="${cardWidth}" height="${CARD_HEIGHT}" rx="28" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="3"/>`;
      const icon = pictogram(card.icon, { x: x + (cardWidth - ICON_SIZE) / 2, y: top + 50, size: ICON_SIZE, color: iconColor });
      const label = textLines({
        x: x + cardWidth / 2,
        y: top + 280,
        lines: wrapText(card.label, maxChars, 2),
        size: LABEL_SIZE,
        weight: 600,
        fill: labelColor,
        anchor: 'middle',
      });
      const body = crossed ? `<g opacity="${CROSSED_OPACITY}">${icon}${label}</g>` : `${icon}${label}`;
      const strike = crossed ? renderStrike(x, top, cardWidth) : '';

      return `<g>${box}${body}${strike}</g>`;
    })
    .join('\n');
}

module.exports = { name: 'crossed', slotSchema, example, render };
