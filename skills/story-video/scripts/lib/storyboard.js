'use strict';
// Loads and validates a story-video storyboard.json against the layout kit's
// slot schemas and the narration/structure rules described in the plan.
const fs = require('node:fs');
const { getLayout } = require('../layouts/index');
const { checkSlots } = require('../layouts/schema');
const { has } = require('../pictograms');
const { TONES } = require('../layouts/svg');
const { WORDS_PER_MINUTE } = require('./constants');

// Measured against templates/slides.css: h1 is 84px on a 1740px line, sitting at
// top 182px, and .sub occupies 294px to 344px. One heading line clears the sub;
// a second one runs straight through it. With no sub there is room for two lines
// before the stage starts at 380px.
const HEADING_LIMIT_WITH_SUB = 38;
const HEADING_LIMIT_NO_SUB = 48;
const SUB_LIMIT = 90;
const NARRATION_MIN_WORDS = 25;
const NARRATION_MAX_WORDS = 110;
const ID_PATTERN = /^\d\d$/;
const SENTENCE_MIN_WORDS = 4;
const REPEAT_PREVIEW_LENGTH = 40;
const TARGET_TOLERANCE = 0.25;

function loadStoryboard(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${file}: ${err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`cannot read ${file}: ${err.message}`);
  }
}

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sceneLabel(scene, index) {
  if (scene && typeof scene.id === 'string' && scene.id) return `scene ${scene.id}`;
  return `scene #${index + 1}`;
}

function validateParts(parts, errors) {
  if (!parts || typeof parts !== 'object') return;
  for (const key of Object.keys(parts)) {
    const part = parts[key];
    if (!part || typeof part.label !== 'string' || part.label.length === 0) {
      errors.push(`parts.${key}: label required`);
    }
    if (!part || !Object.prototype.hasOwnProperty.call(TONES, part.tone)) {
      errors.push(`parts.${key}: tone must be amber or teal`);
    }
  }
}

function validateIds(scene, index, previousId, seenIds, errors, prefix) {
  const id = scene && scene.id;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    errors.push(prefix('id must be two digits'));
    return previousId;
  }
  if (seenIds.has(id)) errors.push(prefix('duplicate id'));
  seenIds.add(id);
  if (previousId !== null && Number(id) <= Number(previousId)) {
    errors.push(prefix('ids must ascend'));
  }
  return id;
}

function validateLayoutAndSlots(scene, errors, prefix) {
  const layoutName = scene && scene.layout;
  if (layoutName === 'custom') return;
  const layout = getLayout(layoutName);
  if (!layout) {
    errors.push(prefix(`unknown layout "${layoutName}"`));
    return;
  }
  const slotErrors = checkSlots(layout.slotSchema, (scene && scene.slots) || {}, { hasIcon: has });
  slotErrors.forEach((e) => errors.push(prefix(e)));
  if (slotErrors.length === 0 && typeof layout.check === 'function') {
    layout.check(scene.slots).forEach((e) => errors.push(prefix(e)));
  }
}

function validatePart(scene, board, errors, prefix) {
  if (!scene || scene.part === undefined) return;
  const parts = (board && board.parts) || {};
  if (!Object.prototype.hasOwnProperty.call(parts, scene.part)) {
    errors.push(prefix(`unknown part "${scene.part}"`));
  }
}

function validateHeadingAndSub(scene, errors, prefix) {
  const heading = scene && scene.heading;
  const sub = scene && scene.sub;
  const hasSub = Boolean(sub);
  const limit = hasSub ? HEADING_LIMIT_WITH_SUB : HEADING_LIMIT_NO_SUB;
  const because = hasSub ? 'when the scene has a sub line' : 'when the scene has no sub line';
  if (!heading) {
    errors.push(prefix('heading: required'));
  } else if (heading.length > limit) {
    errors.push(prefix(`heading is ${heading.length} characters, limit ${limit} ${because}`));
  }
  if (sub && sub.length > SUB_LIMIT) {
    errors.push(prefix(`sub is ${sub.length} characters, limit ${SUB_LIMIT}`));
  }
}

function validateNarration(scene, errors, prefix) {
  const narration = scene && scene.narration;
  if (!narration) {
    errors.push(prefix('narration: required'));
    return;
  }
  const words = countWords(narration);
  if (words < NARRATION_MIN_WORDS || words > NARRATION_MAX_WORDS) {
    errors.push(prefix(`narration is ${words} words, expected ${NARRATION_MIN_WORDS} to ${NARRATION_MAX_WORDS}`));
  }
  if (narration.includes('A.I.')) {
    errors.push(prefix('write "AI", not "A.I."'));
  }
}

function validateSourceAndVisual(scene, errors, prefix) {
  const layoutName = scene && scene.layout;
  if (layoutName !== 'title' && !(scene && scene.source)) {
    errors.push(prefix('source: required'));
  }
  if (layoutName === 'custom' && !(scene && scene.visual)) {
    errors.push(prefix('custom scenes need a visual description'));
  }
}

function validateScenes(scenes, board, errors) {
  let previousId = null;
  const seenIds = new Set();
  scenes.forEach((scene, index) => {
    const label = sceneLabel(scene, index);
    const prefix = (msg) => `${label}: ${msg}`;
    previousId = validateIds(scene, index, previousId, seenIds, errors, prefix);
    validateLayoutAndSlots(scene, errors, prefix);
    validatePart(scene, board, errors, prefix);
    validateHeadingAndSub(scene, errors, prefix);
    validateNarration(scene, errors, prefix);
    validateSourceAndVisual(scene, errors, prefix);
  });
}

function collectStrings(value, acc) {
  if (typeof value === 'string') {
    acc.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, acc));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectStrings(v, acc));
  }
}

function checkRepetition(scenes, errors) {
  scenes.forEach((scene, index) => {
    if (!scene || !scene.narration) return;
    const label = sceneLabel(scene, index);
    const collected = [];
    if (scene.heading) collected.push(scene.heading);
    if (scene.sub) collected.push(scene.sub);
    collectStrings(scene.slots, collected);
    const normalizedCollected = collected.map((s) => s.toLowerCase());
    const sentences = scene.narration.split(/(?<=[.!?])\s+/);
    sentences.forEach((sentence) => {
      const words = sentence.trim().split(/\s+/).filter(Boolean);
      if (words.length < SENTENCE_MIN_WORDS) return;
      const normalized = sentence.trim().replace(/[.!?]+$/, '').toLowerCase();
      if (!normalized) return;
      if (normalizedCollected.some((s) => s.includes(normalized))) {
        errors.push(`${label}: repeats a narration sentence on the slide: "${sentence.slice(0, REPEAT_PREVIEW_LENGTH)}"`);
      }
    });
  });
}

function computeSummary(scenes) {
  const summary = { scenes: scenes.length, words: 0, minutes: 0, customIds: [], plannedIds: [] };
  scenes.forEach((scene) => {
    if (!scene) return;
    summary.words += countWords(scene.narration);
    if (scene.layout === 'custom' && scene.id) summary.customIds.push(scene.id);
    if (scene.planned && scene.id) summary.plannedIds.push(scene.id);
  });
  summary.minutes = Math.round((summary.words / WORDS_PER_MINUTE) * 10) / 10;
  return summary;
}

function validateStoryboard(board) {
  const errors = [];
  const warnings = [];

  const title = board && board.title;
  if (!title || typeof title !== 'string') {
    errors.push('title: required');
  }

  validateParts(board && board.parts, errors);

  const scenes = board && board.scenes;
  const scenesValid = Array.isArray(scenes) && scenes.length > 0;
  if (!scenesValid) {
    errors.push('scenes: expected at least one scene');
  }

  let summary = { scenes: 0, words: 0, minutes: 0, customIds: [], plannedIds: [] };
  if (scenesValid) {
    validateScenes(scenes, board, errors);
    checkRepetition(scenes, errors);
    summary = computeSummary(scenes);
  }

  if (board && board.targetMinutes) {
    const diff = Math.abs(summary.minutes - board.targetMinutes);
    if (diff > board.targetMinutes * TARGET_TOLERANCE) {
      warnings.push(`length is ~${summary.minutes.toFixed(1)} min against a target of ${board.targetMinutes} min`);
    }
  }

  return { errors, warnings, summary };
}

module.exports = { loadStoryboard, countWords, validateStoryboard };
