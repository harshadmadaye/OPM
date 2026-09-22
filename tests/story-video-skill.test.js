'use strict';
// Checks on the story-video skill documents. Run with: node --test tests/story-video-skill.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '..', 'skills', 'story-video');
const { LAYOUTS } = require(path.join(SKILL_DIR, 'scripts', 'layouts', 'index.js'));
const pictograms = require(path.join(SKILL_DIR, 'scripts', 'pictograms.js'));

test('SKILL.md follows the contributing rules and states what the video is', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(front, 'frontmatter missing');
  assert.match(front[1], /^name: story-video$/m);
  assert.match(front[1], /^description: .*Use when/m);
  assert.match(front[1], /^description: .*narrated slideshow/m);
  assert.match(front[1], /^description: .*not animation/m);
  assert.match(front[1], /^argument-hint: /m);
  assert.match(front[1], /^disable-model-invocation: true$/m);
  assert.ok(text.slice(front[0].length).split('\n').length < 400, 'body must stay under 400 lines');
  for (const script of ['setup.js', 'validate-storyboard.js', 'render-slides.js', 'render-frames.js', 'narrate.js', 'build-video.js']) {
    assert.ok(text.includes(script), `SKILL.md does not mention ${script}`);
  }
  for (const heading of ['## Gates', '## Errors', '## Red flags', '## Safety']) assert.ok(text.includes(heading), heading);
  assert.ok(text.includes('Azure AI Speech'), 'the licensed option must be named');
  assert.ok(text.includes('templates/layouts.md'));
});

test('layouts.md documents every layout and every pictogram', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'templates', 'layouts.md'), 'utf8');
  for (const name of Object.keys(LAYOUTS)) assert.ok(text.includes(`## ${name}`), `layouts.md has no section for ${name}`);
  assert.ok(text.includes('## custom'));
  for (const icon of pictograms.names()) assert.ok(text.includes(`\`${icon}\``), `layouts.md does not list the ${icon} pictogram`);
});
