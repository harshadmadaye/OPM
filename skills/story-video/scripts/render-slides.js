'use strict';
// CLI: render each storyboard scene into a standalone slide HTML file.
// Usage: node render-slides.js <storyDir>
const fs = require('node:fs');
const path = require('node:path');
const { loadStoryboard, validateStoryboard } = require('./lib/storyboard');
const { getLayout } = require('./layouts/index');
const { TONES, esc } = require('./layouts/svg');
const { storyPaths, sceneFile } = require('./lib/paths');
const { loadManifest, saveManifest, isFresh, record, inputs } = require('./lib/manifest');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('./lib/constants');

const SLIDES_CSS_SOURCE = path.join(__dirname, '..', 'templates', 'slides.css');
const GITIGNORE_CONTENT = 'frames/\naudio/\nsegments/\n.build/\n';

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

  board.scenes.forEach((scene, index) => {
    const file = sceneFile(paths.slides, scene.id, 'html');

    if (scene.layout === 'custom') {
      custom.push(scene.id);
      if (!fs.existsSync(file)) customMissing.push(scene.id);
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

  return { written, skipped, custom, customMissing };
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

  const ids = result.customMissing.length > 0 ? result.customMissing.join(', ') : 'none';
  process.stdout.write(`custom scenes to draw: ${ids}\n`);
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = { renderSlideHtml, renderAll, run };
