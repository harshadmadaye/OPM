'use strict';
// Per-scene hash manifest: lets every pipeline step skip work whose inputs and
// output are both unchanged since the last run.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { LEAD, TAIL, FADE, FPS, DEFAULT_VOICE, DEFAULT_RATE } = require('./constants.js');

const SEPARATOR = Buffer.from([0]);

function hashOf(...parts) {
  const hash = crypto.createHash('sha256');
  for (const part of parts) {
    hash.update(part);
    hash.update(SEPARATOR);
  }
  return hash.digest('hex');
}

function loadManifest(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`cannot read ${file}: ${err.message}`);
  }
}

function saveManifest(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function isFresh(data, key, inputHash, outputPath, exists) {
  return data[key] === inputHash && exists(outputPath);
}

function record(data, key, inputHash) {
  return { ...data, [key]: inputHash };
}

function slideInput(scene, storyboard, index, total) {
  const slideShape = {
    layout: scene.layout,
    heading: scene.heading,
    sub: scene.sub,
    slots: scene.slots,
    part: scene.part,
    planned: Boolean(scene.planned),
    visual: scene.visual,
  };
  return hashOf(
    JSON.stringify(slideShape),
    JSON.stringify(storyboard.parts || null),
    JSON.stringify(storyboard.protagonist || null),
    `${index}/${total}`,
  );
}

// A custom slide is drawn by an agent from the scene's own words, so it depends
// on everything the drawing brief carries plus the counter printed on the slide.
function customInput(scene, index, total) {
  const brief = {
    heading: scene.heading,
    sub: scene.sub,
    visual: scene.visual,
    planned: Boolean(scene.planned),
    part: scene.part,
  };
  return hashOf(JSON.stringify(brief), `${index}/${total}`);
}

function audioInput(scene, storyboard, engine) {
  return hashOf(
    scene.narration,
    storyboard.voice || DEFAULT_VOICE,
    storyboard.rate || DEFAULT_RATE,
    engine,
  );
}

function frameInput(html, css) {
  return hashOf(html, css);
}

function segmentInput(pngBuffer, mp3Buffer) {
  return hashOf(pngBuffer, mp3Buffer, JSON.stringify({ LEAD, TAIL, FADE, FPS }));
}

module.exports = {
  hashOf,
  loadManifest,
  saveManifest,
  isFresh,
  record,
  inputs: {
    slide: slideInput,
    custom: customInput,
    audio: audioInput,
    frame: frameInput,
    segment: segmentInput,
  },
};
