'use strict';
// Tests for slide rendering. Run with: node --test tests/story-video-slides.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SKILL = path.resolve(__dirname, '..', 'skills', 'story-video');
const { renderSlideHtml, renderAll } = require(path.join(SKILL, 'scripts', 'render-slides.js'));
const CLI = path.join(SKILL, 'scripts', 'render-slides.js');
const EXAMPLE = path.join(SKILL, 'templates', 'storyboard.example.json');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-story-slides-'));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

function storyDir(name) {
  const dir = path.join(tmpRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(EXAMPLE, path.join(dir, 'storyboard.json'));
  return dir;
}
const board = () => JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));

test('a kit slide has the frame, the stage, the counter, and never the narration', () => {
  const b = board();
  const index = b.scenes.findIndex((s) => s.layout === 'flow');
  const scene = b.scenes[index];
  const html = renderSlideHtml(scene, b, index, b.scenes.length);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.ok(html.includes('<link rel="stylesheet" href="slides.css">'));
  assert.ok(html.includes(`<h1>${scene.heading}</h1>`));
  assert.ok(html.includes('class="sub"') && html.includes('class="chip"'));
  assert.ok(html.includes('<svg viewBox="0 0 1740 530"'));
  assert.ok(html.includes(`${scene.id} / ${String(b.scenes.length).padStart(2, '0')}`));
  assert.match(html, /<body class="tone-(amber|teal)">/);
  for (const sentence of scene.narration.split(/(?<=[.!?])\s+/)) assert.ok(!html.includes(sentence), 'narration leaked onto the slide');
});

test('PLANNED chip only when planned; headings are escaped; no part means no chip', () => {
  const b = board();
  const planned = b.scenes.findIndex((s) => s.planned && s.layout !== 'custom');
  assert.ok(renderSlideHtml(b.scenes[planned], b, planned, b.scenes.length).includes('class="planned"'));
  const plain = b.scenes.findIndex((s) => !s.planned && s.layout !== 'custom');
  const scene = { ...b.scenes[plain], heading: 'Cost & <time>', part: undefined };
  const html = renderSlideHtml(scene, b, plain, b.scenes.length);
  assert.ok(!html.includes('class="planned"'));
  assert.ok(html.includes('Cost &amp; &lt;time&gt;'));
  assert.ok(!html.includes('class="chip"'));
  assert.throws(() => renderSlideHtml({ ...scene, layout: 'custom' }, b, plain, b.scenes.length), /custom scenes are not rendered by the kit/);
});

test('renderAll writes kit slides, css and .gitignore, lists custom scenes, and is incremental', () => {
  const dir = storyDir('story one ');
  const b = board();
  const kitIds = b.scenes.filter((s) => s.layout !== 'custom').map((s) => s.id);
  const customIds = b.scenes.filter((s) => s.layout === 'custom').map((s) => s.id);

  const first = renderAll(dir, { log: () => {} });
  assert.deepEqual(first.written, kitIds);
  assert.deepEqual(first.skipped, []);
  assert.deepEqual(first.custom, customIds);
  assert.deepEqual(first.customMissing, customIds);
  for (const id of kitIds) assert.ok(fs.existsSync(path.join(dir, 'slides', `scene-${id}.html`)));
  for (const id of customIds) assert.ok(!fs.existsSync(path.join(dir, 'slides', `scene-${id}.html`)));
  assert.ok(fs.readFileSync(path.join(dir, 'slides', 'slides.css'), 'utf8').includes('1920px'));
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'frames/\naudio/\nsegments/\n.build/\n');

  const second = renderAll(dir, { log: () => {} });
  assert.deepEqual(second.written, []);
  assert.deepEqual(second.skipped, kitIds);

  const edited = board();
  const target = edited.scenes.find((s) => s.layout === 'flow');
  target.slots.steps[0].label = 'Changed label';
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(edited));
  const third = renderAll(dir, { log: () => {} });
  assert.deepEqual(third.written, [target.id]);

  fs.writeFileSync(path.join(dir, 'slides', `scene-${customIds[0]}.html`), '<html></html>');
  const drawn = renderAll(dir, { log: () => {} });
  assert.deepEqual(drawn.customMissing, [], 'a drawn custom slide is no longer missing');
  assert.deepEqual(drawn.customStale, [], 'and it is not stale either, since nothing changed under it');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'mine\n');
  renderAll(dir, { log: () => {} });
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'mine\n', 'an existing .gitignore is left alone');
});

test('editing a custom scene puts it back on the list to draw', () => {
  const dir = storyDir('story three');
  const customId = board().scenes.find((s) => s.layout === 'custom').id;
  const custom = (b) => b.scenes.find((s) => s.layout === 'custom');
  const writeBoard = (b) => fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(b));

  renderAll(dir, { log: () => {} });
  fs.writeFileSync(path.join(dir, 'slides', `scene-${customId}.html`), '<html></html>');
  assert.deepEqual(renderAll(dir, { log: () => {} }).customStale, []);

  const revised = board();
  custom(revised).visual = 'A different picture entirely: one badge, no thumbnail.';
  writeBoard(revised);
  const after = renderAll(dir, { log: () => {} });
  assert.deepEqual(after.customMissing, []);
  assert.deepEqual(after.customStale, [customId], 'an edited visual makes the drawn slide stale');
  assert.deepEqual(renderAll(dir, { log: () => {} }).customStale, [], 'the new hash is recorded once');

  const reheaded = board();
  custom(reheaded).visual = revised.scenes.find((s) => s.layout === 'custom').visual;
  custom(reheaded).heading = 'What every build leaves out';
  writeBoard(reheaded);
  const out = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, new RegExp(`custom scenes to draw: ${customId}`), 'the CLI lists stale ids, not just missing ones');
});

test('CLI refuses an invalid storyboard and reports custom scenes', () => {
  const dir = storyDir('story two');
  const ok = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /custom scenes to draw: \d\d/);
  const broken = board();
  broken.scenes[1].layout = 'hologram';
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(broken));
  const bad = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown layout "hologram"/);
});

test('slides.css holds the frame values', () => {
  const css = fs.readFileSync(path.join(SKILL, 'templates', 'slides.css'), 'utf8');
  for (const needle of ['width: 1920px', 'height: 1080px', 'left: 90px', 'font-size: 84px', 'font-size: 42px', 'width: 1740px', 'height: 530px', '.tone-amber', '.tone-teal', '.planned', '.counter', '.chip']) {
    assert.ok(css.includes(needle), `slides.css is missing "${needle}"`);
  }
});
