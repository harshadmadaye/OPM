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
const { customRecord, parseCustomRecord, hashOf } = require(path.join(SKILL, 'scripts', 'lib', 'manifest.js'));
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
  assert.deepEqual(renderAll(dir, { log: () => {} }).customStale, [customId], 'still stale while the drawing on disk is the old one');
  fs.writeFileSync(path.join(dir, 'slides', `scene-${customId}.html`), '<html>redrawn</html>');
  assert.deepEqual(renderAll(dir, { log: () => {} }).customStale, [], 'the redrawn html settles it');

  const reheaded = board();
  custom(reheaded).visual = revised.scenes.find((s) => s.layout === 'custom').visual;
  custom(reheaded).heading = 'What every build leaves out';
  writeBoard(reheaded);
  const out = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, new RegExp(`custom scenes to draw: ${customId}`), 'the CLI lists stale ids, not just missing ones');
});

// The seven states render-slides has to tell apart for one custom scene. The
// script never sees the drawing agent work, so it records the brief it asked
// against and the html that was on disk at that moment; a redraw shows up as
// changed bytes.
const CUSTOM_ID = board().scenes.find((s) => s.layout === 'custom').id;

function customStory(name) {
  const dir = storyDir(name);
  const slide = path.join(dir, 'slides', `scene-${CUSTOM_ID}.html`);
  const customScene = (b) => b.scenes.find((s) => s.layout === 'custom');
  return {
    dir,
    run: () => renderAll(dir, { log: () => {} }),
    draw: (html) => {
      fs.mkdirSync(path.dirname(slide), { recursive: true });
      fs.writeFileSync(slide, html);
    },
    erase: () => fs.rmSync(slide, { force: true }),
    editBrief: (visual) => {
      const b = board();
      customScene(b).visual = visual;
      fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(b));
    },
    recorded: () => parseCustomRecord(JSON.parse(fs.readFileSync(path.join(dir, '.build', 'manifest.json'), 'utf8'))[`custom:${CUSTOM_ID}`]),
    htmlHash: () => hashOf(fs.readFileSync(slide)),
  };
}

test('custom row 1: no file and nothing recorded is missing, and the ask is recorded', () => {
  const story = customStory('custom row one');
  const first = story.run();
  assert.deepEqual(first.customMissing, [CUSTOM_ID]);
  assert.deepEqual(first.customStale, []);
  const rec = story.recorded();
  assert.equal(rec.html, null, 'no html on disk to record');
  assert.equal(rec.asked, true, 'the record was written while asking');
});

test('custom row 2: no file stays missing even once recorded', () => {
  const story = customStory('custom row two');
  story.run();
  const brief = story.recorded().brief;
  const again = story.run();
  assert.deepEqual(again.customMissing, [CUSTOM_ID]);
  assert.deepEqual(again.customStale, []);
  assert.deepEqual(story.recorded(), { brief, html: null, asked: true });

  story.draw('<html>drawn</html>');
  story.run();
  story.erase();
  const gone = story.run();
  assert.deepEqual(gone.customMissing, [CUSTOM_ID], 'a deleted drawing is missing again');
  assert.equal(story.recorded().html, null, 'and the recorded html goes with it');
});

test('custom row 3: a slide drawn before the script ever ran is fresh, not stale', () => {
  const story = customStory('custom row three');
  story.draw('<html>hand drawn</html>');
  const first = story.run();
  assert.deepEqual(first.customMissing, []);
  assert.deepEqual(first.customStale, []);
  assert.deepEqual(story.recorded(), { brief: story.recorded().brief, html: story.htmlHash(), asked: false });
});

test('custom row 4: the drawing that answers the ask is fresh', () => {
  const story = customStory('custom row four');
  story.run();
  assert.equal(story.recorded().html, null);
  story.draw('<html>V1</html>');
  const drawn = story.run();
  assert.deepEqual(drawn.customMissing, []);
  assert.deepEqual(drawn.customStale, []);
  assert.equal(story.recorded().html, story.htmlHash());
  assert.equal(story.recorded().asked, false, 'the drawing was accepted');
});

test('custom row 5: html that changed after a stale ask is fresh again', () => {
  const story = customStory('custom row five');
  story.run();
  story.draw('<html>V1</html>');
  story.run();
  story.editBrief('A different picture entirely: one badge, no thumbnail.');
  assert.deepEqual(story.run().customStale, [CUSTOM_ID]);
  story.draw('<html>V2</html>');
  const redrawn = story.run();
  assert.deepEqual(redrawn.customStale, []);
  assert.deepEqual(redrawn.customMissing, []);
  assert.equal(story.recorded().html, story.htmlHash());
  assert.equal(story.recorded().asked, false);
});

test('custom row 6: an ask the agent never answered stays stale', () => {
  const story = customStory('custom row six');
  story.run();
  story.draw('<html>V1</html>');
  story.run();
  story.editBrief('A different picture entirely: one badge, no thumbnail.');
  const asked = story.run();
  assert.deepEqual(asked.customStale, [CUSTOM_ID]);
  const record = story.recorded();
  assert.equal(record.asked, true);

  const again = story.run();
  assert.deepEqual(again.customStale, [CUSTOM_ID], 'silence is not a redraw');
  assert.deepEqual(again.customMissing, []);
  assert.deepEqual(story.recorded(), record, 'the record is left as it stands');
});

test('custom row 7: a brief edited after the ask makes the drawing stale', () => {
  const story = customStory('custom row seven');
  story.run();
  story.draw('<html>V1</html>');
  // The documented Phase 4 order: the storyboard is edited at G3, with no
  // render-slides run between the drawing and the edit.
  story.editBrief('A different picture entirely: one badge, no thumbnail.');
  const edited = story.run();
  assert.deepEqual(edited.customStale, [CUSTOM_ID], 'the brief changed under the drawing');
  assert.deepEqual(edited.customMissing, []);
  const record = story.recorded();
  assert.equal(record.html, story.htmlHash(), 'the html as it currently stands');
  assert.equal(record.asked, true);
});

test('the Phase 4 replay: ask, draw, edit, rerun, no redraw, rerun, redraw, rerun', () => {
  const story = customStory('custom replay');
  const toDraw = (result) => [...result.customMissing, ...result.customStale].sort();

  assert.deepEqual(toDraw(story.run()), [CUSTOM_ID], 'first run asks for the drawing');
  story.draw('<html>V1</html>');
  story.editBrief('A different picture entirely: one badge, no thumbnail.');
  assert.deepEqual(toDraw(story.run()), [CUSTOM_ID], 'the edit puts it back on the list');
  assert.deepEqual(toDraw(story.run()), [CUSTOM_ID], 'and it stays there until it is redrawn');
  story.draw('<html>V2</html>');
  assert.deepEqual(toDraw(story.run()), [], 'the redraw clears it');
  assert.deepEqual(toDraw(story.run()), [], 'and it stays clear');
});

test('a custom manifest entry round-trips the brief, the html and why it was written', () => {
  assert.equal(customRecord({ brief: 'b', html: 'h', asked: true }), 'b:h:asked');
  assert.equal(customRecord({ brief: 'b', html: null, asked: false }), 'b:-:ok');
  assert.deepEqual(parseCustomRecord('b:h:asked'), { brief: 'b', html: 'h', asked: true });
  assert.deepEqual(parseCustomRecord('b:-:ok'), { brief: 'b', html: null, asked: false });
  for (const junk of [undefined, null, 42, '', 'b', 'b:h', 'b:h:maybe', 'b:h:ok:extra', ':h:ok', 'b::ok']) {
    assert.equal(parseCustomRecord(junk), null, `parsed junk: ${JSON.stringify(junk)}`);
  }
});

test('a slide left behind by a deleted scene is reported, never removed', () => {
  const dir = storyDir('story four');
  renderAll(dir, { log: () => {} });
  assert.deepEqual(renderAll(dir, { log: () => {} }).orphans, []);

  const orphan = path.join(dir, 'slides', 'scene-99.html');
  fs.writeFileSync(orphan, '<html>left behind</html>');
  assert.deepEqual(renderAll(dir, { log: () => {} }).orphans, ['99']);
  assert.ok(fs.existsSync(orphan), 'a hand-edited slide is never deleted for us');

  const out = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /orphan slides, not in the storyboard: 99/);
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
