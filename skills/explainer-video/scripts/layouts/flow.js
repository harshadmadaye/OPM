'use strict';
// flow: a process, left to right, one card per step with arrows between neighbours.
const { pictogram } = require('../pictograms');
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const GAP = 70;
const CARD_HEIGHT = 410;
const ICON_SIZE = 150;
const LABEL_SIZE = 36;

const slotSchema = { steps: { array: { min: 2, max: 5, of: { icon: 'icon', label: 'string' } } } };

const example = {
  steps: [
    { icon: 'document', label: 'Write the storyboard' },
    { icon: 'laptop', label: 'Render the slides' },
    { icon: 'megaphone', label: 'Narrate each scene' },
    { icon: 'video', label: 'Encode the video' },
  ],
};

function render(slots, ctx) {
  const count = slots.steps.length;
  const cardWidth = Math.floor((STAGE_WIDTH - GAP * (count - 1)) / count);
  const top = Math.round((STAGE_HEIGHT - CARD_HEIGHT) / 2);
  const middle = top + CARD_HEIGHT / 2;
  const maxChars = maxCharsFor(cardWidth - 48, LABEL_SIZE);

  return slots.steps.map((step, i) => {
    const x = i * (cardWidth + GAP);
    const card = `<rect data-role="card" x="${x}" y="${top}" width="${cardWidth}" height="${CARD_HEIGHT}" rx="28" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="3"/>`;
    const icon = pictogram(step.icon, { x: x + (cardWidth - ICON_SIZE) / 2, y: top + 50, size: ICON_SIZE, color: ctx.tone.accent });
    const label = textLines({ x: x + cardWidth / 2, y: top + 280, lines: wrapText(step.label, maxChars, 2), size: LABEL_SIZE, weight: 600, fill: COLORS.ink, anchor: 'middle' });
    const arrow = i < count - 1
      ? `<path data-role="arrow" d="M${x + cardWidth + 14} ${middle} h${GAP - 28} m-16 -14 l16 14 l-16 14" fill="none" stroke="${ctx.tone.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
    return `<g>${card}${icon}${label}${arrow}</g>`;
  }).join('\n');
}

module.exports = { name: 'flow', slotSchema, example, render };
