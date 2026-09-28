'use strict';
// funnel: stacked bars narrowing from top to bottom, each holding a label on
// the left and a value on the right. The top bar carries the tone accent.
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const TOP_WIDTH = 1500;
const WIDTH_STEP = 230;
const GAP = 16;
const MAX_HEIGHT = 96;
const LABEL_SIZE = 34;
const VALUE_SIZE = 36;
const PAD = 40;
const VALUE_AREA_WIDTH = 300;
const LABEL_GAP = 20;

const slotSchema = { stages: { array: { min: 2, max: 5, of: { label: 'string', value: 'string' } } } };

const example = {
  stages: [
    { label: 'Creators found', value: '120' },
    { label: 'Replied to outreach', value: '40' },
    { label: 'Signed the agreement', value: '5' },
  ],
};

function render(slots, ctx) {
  const stages = slots.stages;
  const n = stages.length;
  const height = Math.min(MAX_HEIGHT, Math.floor((STAGE_HEIGHT - GAP * (n - 1)) / n));
  const totalHeight = height * n + GAP * (n - 1);
  const top = Math.round((STAGE_HEIGHT - totalHeight) / 2);

  const valueMaxChars = maxCharsFor(VALUE_AREA_WIDTH - PAD, VALUE_SIZE);

  return stages
    .map((stage, i) => {
      const width = TOP_WIDTH - WIDTH_STEP * i;
      const x = Math.round((STAGE_WIDTH - width) / 2);
      const y = top + i * (height + GAP);
      const isFirst = i === 0;
      const fill = isFirst ? ctx.tone.accent : ctx.tone.soft;
      const textColor = isFirst ? '#ffffff' : COLORS.ink;

      const bar = `<rect data-role="stage" x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="${fill}"/>`;

      const valueLine = wrapText(stage.value, valueMaxChars, 1)[0];
      const value = textLines({
        x: x + width - PAD,
        y: y + height / 2 + VALUE_SIZE * 0.35,
        lines: [valueLine],
        size: VALUE_SIZE,
        weight: 700,
        fill: textColor,
        anchor: 'end',
      });

      const labelMaxWidth = width - PAD * 2 - VALUE_AREA_WIDTH - LABEL_GAP;
      const labelMaxChars = maxCharsFor(labelMaxWidth, LABEL_SIZE);
      const labelLine = wrapText(stage.label, labelMaxChars, 1)[0];
      const label = textLines({
        x: x + PAD,
        y: y + height / 2 + LABEL_SIZE * 0.35,
        lines: [labelLine],
        size: LABEL_SIZE,
        weight: 500,
        fill: textColor,
        anchor: 'start',
      });

      return `<g>${bar}${label}${value}</g>`;
    })
    .join('\n');
}

module.exports = { name: 'funnel', slotSchema, example, render };
