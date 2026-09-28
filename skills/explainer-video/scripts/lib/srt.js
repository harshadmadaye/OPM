'use strict';
// Builds an .srt sidecar from scene narration and duration: timestamps,
// sentence splitting and cumulative cue offsets across the whole story.

const { LEAD, TAIL } = require('./constants.js');

function pad(number, width) {
  return String(number).padStart(width, '0');
}

function formatTime(seconds) {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function buildSrt(scenes, { lead = LEAD, tail = TAIL } = {}) {
  const lines = [];
  let offset = 0;
  let index = 1;

  for (const scene of scenes) {
    const sentences = splitSentences(scene.narration);
    const totalChars = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
    let cursor = offset + lead;

    for (const sentence of sentences) {
      const share = totalChars > 0 ? (sentence.length / totalChars) * scene.duration : 0;
      const start = cursor;
      const end = cursor + share;
      lines.push(String(index), `${formatTime(start)} --> ${formatTime(end)}`, sentence, '');
      cursor = end;
      index += 1;
    }

    offset += lead + scene.duration + tail;
  }

  return lines.join('\n');
}

module.exports = { formatTime, splitSentences, buildSrt };
