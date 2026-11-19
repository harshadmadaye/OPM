'use strict';
// chat: one to three chat windows side by side, each a stack of message
// bubbles. A bubble sits on the right when its sender is the protagonist.
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const WINDOW_GAP = 50;
const TITLE_BAR_HEIGHT = 64;
const APP_SIZE = 30;
const BUBBLE_HEIGHT = 100;
const TEXT_SIZE = 30;
const BUBBLE_WIDTH_RATIO = 0.78;
const BUBBLE_MARGIN = 24;

const slotSchema = {
  windows: {
    array: {
      min: 1,
      max: 3,
      of: {
        app: 'string',
        messages: { array: { min: 1, max: 4, of: { from: 'string', text: 'string' } } },
      },
    },
  },
};

const example = {
  windows: [
    {
      app: 'Mail',
      messages: [
        { from: 'Client', text: 'Any update on the March invoice?' },
        { from: 'Asha', text: 'Sending it over within the hour.' },
      ],
    },
    {
      app: 'Notes',
      messages: [{ from: 'Asha', text: 'Logged the follow-up in the shared sheet.' }],
    },
  ],
};

function isProtagonist(from, ctx) {
  return !!ctx.protagonist && String(from).toLowerCase() === String(ctx.protagonist.name).toLowerCase();
}

function renderMessages(messages, x, width, ctx) {
  const bubbleWidth = Math.round(width * BUBBLE_WIDTH_RATIO);
  const available = STAGE_HEIGHT - TITLE_BAR_HEIGHT;
  const count = messages.length;
  const gap = (available - count * BUBBLE_HEIGHT) / (count + 1);
  const maxChars = maxCharsFor(bubbleWidth - BUBBLE_MARGIN * 2, TEXT_SIZE);

  return messages
    .map((msg, i) => {
      const onRight = isProtagonist(msg.from, ctx);
      const side = onRight ? 'right' : 'left';
      const bubbleX = onRight ? x + width - bubbleWidth - BUBBLE_MARGIN : x + BUBBLE_MARGIN;
      const bubbleY = TITLE_BAR_HEIGHT + gap + i * (BUBBLE_HEIGHT + gap);
      const fill = onRight ? ctx.tone.soft : COLORS.ground;
      const bubble = `<rect x="${bubbleX}" y="${bubbleY}" width="${bubbleWidth}" height="${BUBBLE_HEIGHT}" rx="20" fill="${fill}"/>`;
      const text = textLines({
        x: bubbleX + BUBBLE_MARGIN,
        y: bubbleY + 42,
        lines: wrapText(msg.text, maxChars, 2),
        size: TEXT_SIZE,
        weight: 500,
        fill: COLORS.ink,
        anchor: 'start',
      });
      return `<g data-side="${side}">${bubble}${text}</g>`;
    })
    .join('\n');
}

function renderWindow(win, x, width, ctx) {
  const frame = `<rect x="${x}" y="0" width="${width}" height="${STAGE_HEIGHT}" rx="24" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="3"/>`;
  const titleBar = `<rect x="${x}" y="0" width="${width}" height="${TITLE_BAR_HEIGHT}" rx="24" fill="${ctx.tone.soft}"/>`;
  const maxAppChars = maxCharsFor(width - 48, APP_SIZE);
  const appLabel = textLines({
    x: x + 24,
    y: 40,
    lines: wrapText(win.app, maxAppChars, 1),
    size: APP_SIZE,
    weight: 700,
    fill: ctx.tone.accent,
    anchor: 'start',
  });
  const messages = renderMessages(win.messages, x, width, ctx);
  return `<g>${frame}${titleBar}${appLabel}${messages}</g>`;
}

function render(slots, ctx) {
  const count = slots.windows.length;
  const windowWidth = Math.floor((STAGE_WIDTH - WINDOW_GAP * (count - 1)) / count);
  return slots.windows
    .map((win, i) => renderWindow(win, i * (windowWidth + WINDOW_GAP), windowWidth, ctx))
    .join('\n');
}

module.exports = { name: 'chat', slotSchema, example, render };
