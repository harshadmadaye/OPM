'use strict';
// CLI: render each storyboard scene into a standalone slide HTML file.
// Usage: node render-slides.js <storyDir>
const fs = require('node:fs');
const path = require('node:path');
const { loadStoryboard, validateStoryboard } = require('./lib/storyboard');
const { getLayout } = require('./layouts/index');
const { TONES, esc } = require('./layouts/svg');
const { storyPaths, sceneFile } = require('./lib/paths');
const {
  loadManifest, saveManifest, isFresh, record, inputs, hashOf, customRecord, parseCustomRecord,
} = require('./lib/manifest');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('./lib/constants');

const SLIDES_CSS_SOURCE = path.join(__dirname, '..', 'templates', 'slides.css');
const GITIGNORE_CONTENT = 'frames/\naudio/\nsegments/\n.build/\n';
const SCENE_FILE_RE = /^scene-(\d\d)\.html$/;

function knownPart(scene, storyboard) {
  if (scene.part === undefined || !storyboard.parts) return undefined;
  return storyboard.parts[scene.part];
}

function toneFor(scene, storyboard) {
  const part = knownPart(scene, storyboard);
  return part ? part.tone : 'teal';
}

function renderSlideHtml(scene, storyboard, index, total) {
  if (scene.layout === 'custom') {
    throw new Error('custom scenes are not rendered by the kit');
  }
  const layout = getLayout(scene.layout);
  if (!layout) {
    throw new Error(`unknown layout "${scene.layout}"`);
  }

  const tone = toneFor(scene, storyboard);
  const part = knownPart(scene, storyboard);
  const chip = part ? `  <div class="chip">${esc(part.label)}</div>\n` : '';
  const planned = scene.planned ? '  <div class="planned">PLANNED</div>\n' : '';
  const sub = scene.sub ? `  <p class="sub">${esc(scene.sub)}</p>\n` : '';
  const counter = `${scene.id} / ${String(total).padStart(2, '0')}`;
  const svgInner = layout.render(scene.slots, { tone: TONES[tone], protagonist: storyboard.protagonist || null });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Scene ${scene.id}</title>
<link rel="stylesheet" href="slides.css">
</head>
<body class="tone-${tone}">
<div class="slide">
${chip}${planned}  <h1>${esc(scene.heading)}</h1>
${sub}  <div class="stage"><svg viewBox="0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
${svgInner}
  </svg></div>
  <div class="counter">${counter}</div>
</div>
</body>
</html>
`;
}

// Slide files left behind by a scene that was deleted from the storyboard. They
// are reported, never removed: the developer may have hand-edited one.
function orphanSlides(slidesDir, board) {
  if (!fs.existsSync(slidesDir)) return [];
  const known = new Set(board.scenes.map((scene) => scene.id));
  return fs
    .readdirSync(slidesDir)
    .map((name) => name.match(SCENE_FILE_RE))
    .filter(Boolean)
    .map((match) => match[1])
    .filter((id) => !known.has(id))
    .sort();
}

// A custom slide is hand-drawn by an agent, so the script cannot tell a drawing
// apart from the brief that asked for it except by what it wrote down last run.
// `recorded` is the parsed manifest entry or null, `brief` the current scene
// hash, `html` the hash of the file's bytes or null when there is no file.
//   no file                      -> missing, and the ask is recorded
//   no record                    -> fresh: someone drew it before we ever asked
//   brief changed                -> stale: the drawing answers an older brief
//   html changed                 -> fresh: the agent redrew it
//   nothing changed since an ask -> stale: the agent has not redrawn it yet
//   nothing changed since an ok  -> fresh
function customVerdict(recorded, brief, html) {
  if (html === null) return { report: 'missing', entry: customRecord({ brief, html: null, asked: true }) };
  if (!recorded) return { report: 'fresh', entry: customRecord({ brief, html, asked: false }) };
  if (recorded.brief !== brief) return { report: 'stale', entry: customRecord({ brief, html, asked: true }) };
  if (recorded.html !== html) return { report: 'fresh', entry: customRecord({ brief, html, asked: false }) };
  if (recorded.asked) return { report: 'stale', entry: customRecord({ brief, html, asked: true }) };
  return { report: 'fresh', entry: customRecord({ brief, html, asked: false }) };
}

function renderAll(storyDir, { log = console.log } = {}) {
  const paths = storyPaths(storyDir);
  const board = loadStoryboard(paths.storyboard);
  const { errors } = validateStoryboard(board);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  fs.mkdirSync(paths.slides, { recursive: true });
  fs.copyFileSync(SLIDES_CSS_SOURCE, paths.css);
  if (!fs.existsSync(paths.gitignore)) {
    fs.writeFileSync(paths.gitignore, GITIGNORE_CONTENT);
  }

  const total = board.scenes.length;
  let manifest = loadManifest(paths.manifest);
  const written = [];
  const skipped = [];
  const custom = [];
  const customMissing = [];
  const customStale = [];

  board.scenes.forEach((scene, index) => {
    const file = sceneFile(paths.slides, scene.id, 'html');

    if (scene.layout === 'custom') {
      custom.push(scene.id);
      const customKey = `custom:${scene.id}`;
      const brief = inputs.custom(scene, index, total);
      const html = fs.existsSync(file) ? hashOf(fs.readFileSync(file)) : null;
      const verdict = customVerdict(parseCustomRecord(manifest[customKey]), brief, html);
      if (verdict.report === 'missing') customMissing.push(scene.id);
      if (verdict.report === 'stale') customStale.push(scene.id);
      manifest = record(manifest, customKey, verdict.entry);
      return;
    }

    const key = `slide:${scene.id}`;
    const hash = inputs.slide(scene, board, index, total);
    if (isFresh(manifest, key, hash, file, fs.existsSync)) {
      skipped.push(scene.id);
      log(`fresh scene-${scene.id}.html`);
      return;
    }

    const html = renderSlideHtml(scene, board, index, total);
    fs.writeFileSync(file, html);
    manifest = record(manifest, key, hash);
    written.push(scene.id);
    log(`wrote scene-${scene.id}.html`);
  });

  saveManifest(paths.manifest, manifest);

  return { written, skipped, custom, customMissing, customStale, orphans: orphanSlides(paths.slides, board) };
}

function run(argv) {
  const storyDir = argv[0];
  if (!storyDir) {
    process.stderr.write('error: usage: render-slides.js <storyDir>\n');
    process.exitCode = 1;
    return;
  }

  let result;
  try {
    result = renderAll(storyDir, { log: (line) => process.stdout.write(`${line}\n`) });
  } catch (err) {
    err.message.split('\n').forEach((line) => process.stderr.write(`error: ${line}\n`));
    process.exitCode = 1;
    return;
  }

  if (result.orphans.length > 0) {
    process.stdout.write(`orphan slides, not in the storyboard: ${result.orphans.join(', ')}\n`);
  }
  const toDraw = [...result.customMissing, ...result.customStale].sort();
  process.stdout.write(`custom scenes to draw: ${toDraw.length > 0 ? toDraw.join(', ') : 'none'}\n`);
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = { renderSlideHtml, renderAll, orphanSlides, run };
