'use strict';
// Unit tests for the story-video library modules. Run with: node --test tests/story-video-lib.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LIB = path.resolve(__dirname, '..', 'skills', 'story-video', 'scripts', 'lib');
const constants = require(path.join(LIB, 'constants.js'));
const paths = require(path.join(LIB, 'paths.js'));
const { readPngSize } = require(path.join(LIB, 'png.js'));
const srt = require(path.join(LIB, 'srt.js'));
const manifest = require(path.join(LIB, 'manifest.js'));

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-story-lib-'));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

test('constants carry the measured values', () => {
  assert.equal(constants.WIDTH, 1920);
  assert.equal(constants.HEIGHT, 1080);
  assert.equal(constants.STAGE_WIDTH, 1740);
  assert.equal(constants.STAGE_HEIGHT, 530);
  assert.equal(constants.MIN_FONT, 30);
  assert.deepEqual([constants.LEAD, constants.TAIL, constants.FADE, constants.FPS], [0.6, 0.9, 0.4, 25]);
  assert.equal(constants.WORDS_PER_MINUTE, 134);
  assert.equal(constants.DEFAULT_VOICE, 'en-IN-NeerjaExpressiveNeural');
  assert.equal(constants.DEFAULT_RATE, '+6%');
});

test('toolsDir defaults under the home directory and honours OPM_STORY_TOOLS', () => {
  assert.equal(paths.toolsDir({ env: {}, homedir: '/home/u' }), path.join('/home/u', '.opm', 'story-video-tools'));
  assert.equal(paths.toolsDir({ env: { OPM_STORY_TOOLS: '/x/tools' }, homedir: '/home/u' }), '/x/tools');
});

test('venvPython differs by platform', () => {
  assert.equal(paths.venvPython('/t', 'darwin'), '/t/venv/bin/python');
  assert.equal(paths.venvPython('/t', 'linux'), '/t/venv/bin/python');
  assert.equal(paths.venvPython('C:\\t', 'win32'), 'C:\\t\\venv\\Scripts\\python.exe');
});

test('toolBinary resolves through the installed npm package and returns null when absent', () => {
  const tools = path.join(tmpRoot, 'tools');
  assert.equal(paths.toolBinary(tools, 'ffmpeg'), null);
  fs.mkdirSync(path.join(tools, 'node_modules', 'ffmpeg-static'), { recursive: true });
  fs.writeFileSync(path.join(tools, 'node_modules', 'ffmpeg-static', 'index.js'), "module.exports = '/fake/ffmpeg';");
  fs.mkdirSync(path.join(tools, 'node_modules', 'ffprobe-static'), { recursive: true });
  fs.writeFileSync(path.join(tools, 'node_modules', 'ffprobe-static', 'index.js'), "module.exports = { path: '/fake/ffprobe' };");
  assert.equal(paths.toolBinary(tools, 'ffmpeg'), '/fake/ffmpeg');
  assert.equal(paths.toolBinary(tools, 'ffprobe'), '/fake/ffprobe');
  assert.throws(() => paths.toolBinary(tools, 'sox'), /unknown tool/);
});

test('findBrowser: CHROME_PATH wins, then the first existing candidate, per platform', () => {
  const chromeMac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const edgeMac = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
  const only = (...allowed) => (p) => allowed.includes(p);
  assert.equal(paths.findBrowser({ platform: 'darwin', env: { CHROME_PATH: '/custom/chrome' }, exists: only('/custom/chrome', chromeMac), which: () => null }), '/custom/chrome');
  assert.equal(paths.findBrowser({ platform: 'darwin', env: {}, exists: only(chromeMac, edgeMac), which: () => null }), chromeMac);
  assert.equal(paths.findBrowser({ platform: 'darwin', env: {}, exists: only(edgeMac), which: () => null }), edgeMac);
  assert.equal(paths.findBrowser({ platform: 'darwin', env: {}, exists: () => false, which: () => null }), null);

  const winEnv = { PROGRAMFILES: 'C:\\Program Files', 'PROGRAMFILES(X86)': 'C:\\Program Files (x86)', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' };
  const edgeWin = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.equal(paths.findBrowser({ platform: 'win32', env: winEnv, exists: only(edgeWin), which: () => null }), edgeWin);
  assert.ok(paths.browserCandidates('win32', winEnv).includes('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'));

  const which = (name) => (name === 'chromium-browser' ? '/usr/bin/chromium-browser' : null);
  assert.equal(paths.findBrowser({ platform: 'linux', env: {}, exists: () => false, which }), '/usr/bin/chromium-browser');
  assert.deepEqual(paths.browserCandidates('linux', {}), ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser']);
});

test('storyPaths derives every path from the story directory, spaces included', () => {
  const root = path.join('/p', 'My Project ', 'docs', 'story', 'launch-plan');
  const p = paths.storyPaths(root);
  assert.equal(p.root, root);
  assert.equal(p.storyboard, path.join(root, 'storyboard.json'));
  assert.equal(p.slides, path.join(root, 'slides'));
  assert.equal(p.css, path.join(root, 'slides', 'slides.css'));
  assert.equal(p.frames, path.join(root, 'frames'));
  assert.equal(p.audio, path.join(root, 'audio'));
  assert.equal(p.segments, path.join(root, 'segments'));
  assert.equal(p.build, path.join(root, '.build'));
  assert.equal(p.manifest, path.join(root, '.build', 'manifest.json'));
  assert.equal(p.contactSheet, path.join(root, '.build', 'contact-sheet.png'));
  assert.equal(p.concatList, path.join(root, '.build', 'concat.txt'));
  assert.equal(p.gitignore, path.join(root, '.gitignore'));
  assert.equal(p.mp4, path.join(root, 'launch-plan.mp4'));
  assert.equal(p.srt, path.join(root, 'launch-plan.srt'));
  assert.equal(paths.sceneFile(p.frames, '03', 'png'), path.join(root, 'frames', 'scene-03.png'));
});

function pngHeader(width, height) {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

test('readPngSize reads IHDR and rejects anything else', () => {
  assert.deepEqual(readPngSize(pngHeader(1920, 1080)), { width: 1920, height: 1080 });
  assert.throws(() => readPngSize(Buffer.from('<html></html>')), /not a PNG/);
  assert.throws(() => readPngSize(Buffer.alloc(4)), /not a PNG/);
});

test('srt: time format, sentence split and cumulative cues offset by the lead-in', () => {
  assert.equal(srt.formatTime(0.6), '00:00:00,600');
  assert.equal(srt.formatTime(3725.042), '01:02:05,042');
  assert.deepEqual(srt.splitSentences('One two. Three four! Five?'), ['One two.', 'Three four!', 'Five?']);
  const out = srt.buildSrt([
    { narration: 'Aaaa bbbb. Cccc dddd.', duration: 10 },
    { narration: 'Eeee.', duration: 5 },
  ], { lead: 0.6, tail: 0.9 });
  assert.equal(out, [
    '1', '00:00:00,600 --> 00:00:05,600', 'Aaaa bbbb.', '',
    '2', '00:00:05,600 --> 00:00:10,600', 'Cccc dddd.', '',
    '3', '00:00:12,100 --> 00:00:17,100', 'Eeee.', '',
  ].join('\n'));
});

test('manifest: hashing, freshness, immutable record, load and save', () => {
  assert.equal(manifest.hashOf('a', 'b'), manifest.hashOf('a', 'b'));
  assert.notEqual(manifest.hashOf('a', 'b'), manifest.hashOf('ab'));
  assert.equal(manifest.hashOf(Buffer.from('a')), manifest.hashOf('a'));

  const empty = {};
  const next = manifest.record(empty, 'audio:01', 'h1');
  assert.deepEqual(empty, {});
  assert.deepEqual(next, { 'audio:01': 'h1' });
  assert.equal(manifest.isFresh(next, 'audio:01', 'h1', '/out.mp3', () => true), true);
  assert.equal(manifest.isFresh(next, 'audio:01', 'h2', '/out.mp3', () => true), false);
  assert.equal(manifest.isFresh(next, 'audio:01', 'h1', '/out.mp3', () => false), false);
  assert.equal(manifest.isFresh(next, 'audio:02', 'h1', '/out.mp3', () => true), false);

  const file = path.join(tmpRoot, 'nested', '.build', 'manifest.json');
  assert.deepEqual(manifest.loadManifest(file), {});
  manifest.saveManifest(file, next);
  assert.deepEqual(manifest.loadManifest(file), next);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => manifest.loadManifest(file), /manifest\.json/);
});

test('manifest inputs: narration touches audio only, slots touch the slide only', () => {
  const board = { title: 'T', voice: 'v1', scenes: [] };
  const scene = { id: '01', layout: 'flow', heading: 'H', sub: 'S', slots: { steps: [] }, narration: 'Hello there.' };
  const slide = manifest.inputs.slide(scene, board, 0, 3);
  const audio = manifest.inputs.audio(scene, board, 'neural');

  const renarrated = { ...scene, narration: 'Hello again.' };
  assert.equal(manifest.inputs.slide(renarrated, board, 0, 3), slide);
  assert.notEqual(manifest.inputs.audio(renarrated, board, 'neural'), audio);

  const reslotted = { ...scene, slots: { steps: [{ icon: 'chat', label: 'x' }] } };
  assert.notEqual(manifest.inputs.slide(reslotted, board, 0, 3), slide);
  assert.equal(manifest.inputs.audio(reslotted, board, 'neural'), audio);

  assert.notEqual(manifest.inputs.slide(scene, board, 0, 4), slide, 'scene counter depends on the total');
  assert.notEqual(manifest.inputs.audio(scene, { ...board, voice: 'v2' }, 'neural'), audio);
  assert.notEqual(manifest.inputs.audio(scene, board, 'local'), audio);
  assert.notEqual(manifest.inputs.frame('<html>a</html>', 'css'), manifest.inputs.frame('<html>b</html>', 'css'));
  assert.notEqual(manifest.inputs.segment(Buffer.from('png1'), Buffer.from('mp3')), manifest.inputs.segment(Buffer.from('png2'), Buffer.from('mp3')));
});
