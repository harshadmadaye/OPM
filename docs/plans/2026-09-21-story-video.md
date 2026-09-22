# opm:story-video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use opm:executing-plans to implement this plan task-by-task. Each task follows opm:tdd-workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `opm:story-video <path>` skill: a storyboard-driven pipeline of Node scripts that renders slides from a layout kit, screenshots them, narrates them and encodes a 1920x1080 MP4 with a sidecar `.srt`, on macOS, Linux and Windows.

**Architecture:** The main thread writes `storyboard.json`; everything after it is deterministic scripts under `skills/story-video/scripts/`. Pure logic (paths, hashing, SRT, validation, layout rendering, argument building) lives in small modules with injected dependencies so it is unit-testable; the CLIs are thin and every one that spawns a tool has `--dry-run`. A per-scene hash manifest makes every step incremental.

**Tech Stack:** Node 18+ CommonJS with no npm dependencies of its own, `node:test`, one Python file using `edge-tts`, ffmpeg-static and ffprobe-static installed at run time into a per-user tools folder.

**Spec:** docs/specs/2026-09-18-story-video.md

## Global Constraints

- All scripts are CommonJS (`'use strict'`, `require`), Node 18 or later, zero npm dependencies. Each CLI file exports its functions and runs only under `if (require.main === module)`.
- No bash, zsh, `afinfo`, `sips` or other OS-specific tools in the pipeline. OS differences are handled by taking `platform` as a parameter (default `process.platform`), never by reading it deep inside a function.
- Never build shell command strings. Spawn with an argument array. Paths may contain spaces, including a trailing space in a directory name.
- Every CLI takes one positional argument, the story directory (`docs/story/<slug>/` in a target project), and derives every other path from `storyPaths()`.
- Exact values: frame 1920x1080; stage 1740x530; safe margin 90px; heading 84px; sub line 42px; no text inside a layout below 30px; lead-in 0.6s; tail 0.9s; fade 0.4s; 25 fps; libx264 crf 20 preset medium `-tune stillimage`; AAC 128k stereo 44100 Hz; default voice `en-IN-NeerjaExpressiveNeural`; default rate `+6%`; pace 134 words per minute.
- Tests: `node --test tests/*.test.js`. No network, no browser, no ffmpeg, no audio. Test files are named `tests/story-video-<area>.test.js`.
- Errors are explicit: a failing script exits non-zero with one line naming the scene or the file. No swallowed exceptions, no leftover `console.log` debugging.
- Source files stay under 400 lines; one responsibility per file.
- Skill rules (README, Contributing): `name` equals the directory, description in third person with "Use when" triggers, body under 400 lines, no first person.
- Tests are the contract. Where a step gives rules instead of full code, the rules plus the tests fully determine the behaviour; do not add behaviour neither asks for.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File map

```
skills/story-video/
  SKILL.md                         Task 10
  templates/slides.css             Task 6
  templates/storyboard.example.json Task 5
  templates/layouts.md             Task 10
  scripts/
    lib/constants.js  lib/paths.js  lib/png.js  lib/srt.js  lib/manifest.js   Task 1
    pictograms.js  layouts/svg.js  layouts/schema.js                          Task 2
    layouts/index.js  layouts/{title,flow,checklist,chat}.js                  Task 3
    layouts/{spreadsheet,funnel,wireframe,crossed,roadmap}.js                 Task 4
    lib/storyboard.js  validate-storyboard.js                                 Task 5
    render-slides.js                                                          Task 6
    setup.js  render-frames.js                                                Task 7
    build-video.js                                                            Task 8
    lib/local-voice.js  narrate.js  narrate.py                                Task 9
tests/story-video-{lib,kit,layouts,storyboard,slides,frames,build,narrate,skill}.test.js
```

---

### Task 1: Library foundations (constants, paths, png, srt, manifest)

**Files:**
- Create: `skills/story-video/scripts/lib/constants.js`, `lib/paths.js`, `lib/png.js`, `lib/srt.js`, `lib/manifest.js`
- Test: `tests/story-video-lib.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `constants`: `WIDTH=1920, HEIGHT=1080, STAGE_WIDTH=1740, STAGE_HEIGHT=530, MIN_FONT=30, LEAD=0.6, TAIL=0.9, FADE=0.4, FPS=25, WORDS_PER_MINUTE=134, DEFAULT_VOICE='en-IN-NeerjaExpressiveNeural', DEFAULT_RATE='+6%'`.
  - `paths.toolsDir({ env, homedir })` string; `paths.venvPython(tools, platform)` string; `paths.toolBinary(tools, 'ffmpeg'|'ffprobe')` string or `null`; `paths.browserCandidates(platform, env)` string[]; `paths.findBrowser({ platform, env, exists, which })` string or `null`; `paths.storyPaths(storyDir)` object with `root, storyboard, slides, css, frames, audio, segments, build, manifest, contactSheet, concatList, gitignore, mp4, srt`; `paths.sceneFile(dir, id, ext)` returns `<dir>/scene-<id>.<ext>`.
  - `png.readPngSize(buffer)` returns `{ width, height }`, throws `Error('not a PNG')`.
  - `srt.formatTime(seconds)`, `srt.splitSentences(text)`, `srt.buildSrt(scenes, { lead, tail })` where `scenes` is `[{ narration, duration }]`.
  - `manifest.hashOf(...parts)`, `manifest.loadManifest(file)`, `manifest.saveManifest(file, data)`, `manifest.isFresh(data, key, inputHash, outputPath, exists)`, `manifest.record(data, key, inputHash)` (returns a new object), `manifest.inputs.slide(scene, storyboard, index, total)`, `manifest.inputs.frame(html, css)`, `manifest.inputs.audio(scene, storyboard, engine)`, `manifest.inputs.segment(pngBuffer, mp3Buffer)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-lib.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-lib.test.js`
Expected: FAIL with `Cannot find module '.../skills/story-video/scripts/lib/constants.js'`.

- [ ] **Step 3: Implement the five modules**

Rules:

- `constants.js`: a frozen object with exactly the values in the Interfaces block.
- `paths.js`:
  - `toolsDir({ env = process.env, homedir = os.homedir() } = {})`: `env.OPM_STORY_TOOLS` when set, else `path.join(homedir, '.opm', 'story-video-tools')`.
  - `venvPython(tools, platform = process.platform)`: use `path.win32.join(tools, 'venv', 'Scripts', 'python.exe')` on `win32`, `path.posix.join(tools, 'venv', 'bin', 'python')` otherwise.
  - `toolBinary(tools, name)`: `name` must be `ffmpeg` or `ffprobe`, else throw `Error('unknown tool: <name>')`. Resolve `path.join(tools, 'node_modules', '<name>-static')`; if that directory does not exist return `null`; otherwise `require` it. `ffmpeg-static` exports the path string; `ffprobe-static` exports `{ path }`.
  - `browserCandidates(platform, env)`: macOS returns, in order, `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `/Applications/Chromium.app/Contents/MacOS/Chromium`, `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`, `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`. Windows builds with `path.win32.join`, skipping undefined env roots: `<PROGRAMFILES>\Google\Chrome\Application\chrome.exe`, `<PROGRAMFILES(X86)>\Google\Chrome\Application\chrome.exe`, `<LOCALAPPDATA>\Google\Chrome\Application\chrome.exe`, `<LOCALAPPDATA>\Chromium\Application\chrome.exe`, `<PROGRAMFILES(X86)>\Microsoft\Edge\Application\msedge.exe`, `<PROGRAMFILES>\Microsoft\Edge\Application\msedge.exe`, `<PROGRAMFILES>\BraveSoftware\Brave-Browser\Application\brave.exe`. Any other platform returns the six command names in the test.
  - `findBrowser({ platform = process.platform, env = process.env, exists = fs.existsSync, which = defaultWhich } = {})`: `env.CHROME_PATH` if it exists; on macOS and Windows the first candidate that exists; elsewhere the first non-null `which(name)`. `defaultWhich(name)` scans `env.PATH` split by `path.delimiter` for an existing file; no shelling out.
  - `storyPaths(storyDir)` and `sceneFile(dir, id, ext)` exactly as the test shows. The slug for `mp4` and `srt` is `path.basename(storyDir)`.
- `png.js`: check `buffer.length >= 24`, the 8-byte signature, and the ASCII `IHDR` at offset 12; width is `readUInt32BE(16)`, height `readUInt32BE(20)`.
- `srt.js`:
  - `formatTime`: round to whole milliseconds first, then split into `HH:MM:SS,mmm`.
  - `splitSentences`: split on whitespace that follows `.`, `!` or `?`; trim; drop empties.
  - `buildSrt(scenes, { lead = LEAD, tail = TAIL } = {})`: keep a running `offset`. For each scene speech starts at `offset + lead` and lasts `duration`; each sentence takes a share of `duration` equal to its character length over the scene's total sentence characters; cues are numbered from 1 across the whole file; after the scene `offset += lead + duration + tail`. Blocks are `index`, `start --> end`, text, empty line; the file ends with that last empty line's newline omitted, as in the test.
- `manifest.js`:
  - `hashOf(...parts)`: SHA-256 hex; update with each part (string or Buffer) followed by a single `\0` byte, so `('a','b')` differs from `('ab')`.
  - `loadManifest`: `{}` when the file is missing; on a JSON parse error throw `Error('cannot read <file>: <message>')`.
  - `saveManifest`: `mkdirSync(dirname, { recursive: true })`, then write pretty JSON.
  - `inputs.slide`: hash of `JSON.stringify` of `{ layout, heading, sub, slots, part, planned: Boolean(scene.planned), visual }`, plus `JSON.stringify(storyboard.parts || null)`, `JSON.stringify(storyboard.protagonist || null)`, and `${index}/${total}`.
  - `inputs.audio`: hash of `scene.narration`, `storyboard.voice || DEFAULT_VOICE`, `storyboard.rate || DEFAULT_RATE`, `engine`.
  - `inputs.frame(html, css)` and `inputs.segment(png, mp3)`: `hashOf` of their two arguments plus, for `segment`, `JSON.stringify({ LEAD, TAIL, FADE, FPS })`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/story-video-lib.test.js`
Expected: `pass 9`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add skills/story-video/scripts/lib tests/story-video-lib.test.js
git commit -m "story-video: add path, png, srt and manifest libraries"
```

---

### Task 2: Pictograms, SVG helpers and the slot checker

**Files:**
- Create: `skills/story-video/scripts/pictograms.js`, `skills/story-video/scripts/layouts/svg.js`, `skills/story-video/scripts/layouts/schema.js`
- Test: `tests/story-video-kit.test.js`

**Interfaces:**
- Consumes: `constants.MIN_FONT` from `skills/story-video/scripts/lib/constants.js`.
- Produces:
  - `pictograms.names()` string[] sorted; `pictograms.has(name)`; `pictograms.pictogram(name, { x, y, size = 100, color, strokeWidth = 6 })` returns an SVG `<g>` string; throws `Error('unknown pictogram: <name>')`.
  - `svg.COLORS = { ground:'#f2f5f4', surface:'#ffffff', ink:'#101a19', ink2:'#445553', line:'#d3dcda' }`; `svg.TONES = { amber:{ accent:'#b26a00', soft:'#f6ecd8' }, teal:{ accent:'#0d6d67', soft:'#dcecea' } }`; `svg.esc(text)`; `svg.maxCharsFor(width, size)`; `svg.wrapText(text, maxChars, maxLines = 2)` string[]; `svg.textLines({ x, y, lines, size, weight = 500, fill, anchor = 'start', lineHeight = 1.2 })` string, throws `RangeError` when `size < MIN_FONT`.
  - `schema.checkSlots(shape, slots, { hasIcon })` string[] of error messages, each starting with `slots`.

Slot shape language used by every layout:

| Spec | Meaning |
|---|---|
| `'string'`, `'string?'` | required or optional non-empty string |
| `'icon'`, `'icon?'` | a string for which `hasIcon(name)` is true |
| `'bool?'` | optional boolean |
| `'number'` | finite number |
| `{ enum: ['a','b'] }` | one of the listed strings |
| `{ array: { min, max, of: <spec or shape> }, optional?: true }` | array with a length range |
| `{ shape: { ... }, optional?: true }` | nested object |
| a plain object with none of the keys `enum`, `array`, `shape` | shorthand for a required nested shape |

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-kit.test.js`:

```js
'use strict';
// Tests for the slide kit primitives. Run with: node --test tests/story-video-kit.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '..', 'skills', 'story-video', 'scripts');
const pictograms = require(path.join(SCRIPTS, 'pictograms.js'));
const svg = require(path.join(SCRIPTS, 'layouts', 'svg.js'));
const { checkSlots } = require(path.join(SCRIPTS, 'layouts', 'schema.js'));

const EXPECTED_ICONS = ['calendar', 'camera', 'chart', 'chat', 'check', 'clock', 'cross', 'deck', 'document', 'email', 'handshake', 'laptop', 'link', 'lock', 'megaphone', 'money', 'people', 'person', 'phone', 'search', 'sheet', 'star', 'video', 'warning'];

test('pictograms: the 24 names, tone colour, placement, unknown name', () => {
  assert.deepEqual(pictograms.names(), EXPECTED_ICONS);
  for (const name of EXPECTED_ICONS) {
    const out = pictograms.pictogram(name, { x: 10, y: 20, size: 200, color: '#123456' });
    assert.match(out, /^<g /, name);
    assert.ok(out.includes('translate(10 20) scale(2)'), `${name} placement`);
    assert.ok(out.includes('stroke="#123456"'), `${name} colour`);
    assert.ok(!/<text/.test(out), `${name} must not contain text`);
  }
  assert.equal(pictograms.has('phone'), true);
  assert.equal(pictograms.has('rocket'), false);
  assert.throws(() => pictograms.pictogram('rocket', { x: 0, y: 0, color: '#000' }), /unknown pictogram: rocket/);
});

test('svg helpers: escaping, wrapping with ellipsis, the 30px floor', () => {
  assert.equal(svg.esc('A & B <c> "d"'), 'A &amp; B &lt;c&gt; &quot;d&quot;');
  assert.deepEqual(svg.wrapText('short label', 20, 2), ['short label']);
  assert.deepEqual(svg.wrapText('one two three four five six', 10, 2), ['one two', 'three fou…']);
  assert.deepEqual(svg.wrapText('x'.repeat(50), 10, 1), ['xxxxxxxxx…']);
  assert.equal(svg.maxCharsFor(560, 40), 25);

  const out = svg.textLines({ x: 5, y: 50, lines: ['a & b', 'c'], size: 34, weight: 600, fill: '#101a19', anchor: 'middle' });
  assert.match(out, /^<text /);
  assert.ok(out.includes('font-size="34"') && out.includes('text-anchor="middle"') && out.includes('font-weight="600"'));
  assert.equal((out.match(/<tspan /g) || []).length, 2);
  assert.ok(out.includes('a &amp; b'));
  assert.throws(() => svg.textLines({ x: 0, y: 0, lines: ['x'], size: 29, fill: '#000' }), RangeError);
  assert.deepEqual(Object.keys(svg.TONES).sort(), ['amber', 'teal']);
});

test('checkSlots: valid slots pass; each kind of violation is reported with its path', () => {
  const shape = {
    steps: { array: { min: 2, max: 3, of: { icon: 'icon', label: 'string', note: 'string?' } } },
    state: { enum: ['done', 'todo'] },
    footer: 'string?',
    flag: 'bool?',
    window: { shape: { title: 'string', count: 'number' }, optional: true },
  };
  const hasIcon = (n) => n === 'chat' || n === 'phone';
  const good = { steps: [{ icon: 'chat', label: 'A' }, { icon: 'phone', label: 'B', note: 'n' }], state: 'done' };
  assert.deepEqual(checkSlots(shape, good, { hasIcon }), []);

  const bad = {
    steps: [{ icon: 'rocket', label: '' }],
    state: 'later',
    footer: 7,
    flag: 'yes',
    window: { title: 'T', count: 'three' },
    extra: 1,
  };
  const errors = checkSlots(shape, bad, { hasIcon });
  const expectIncludes = (needle) => assert.ok(errors.some((e) => e.includes(needle)), `${needle}\n${errors.join('\n')}`);
  expectIncludes('slots.steps: expected 2 to 3 items, got 1');
  expectIncludes('slots.steps[0].icon: unknown icon "rocket"');
  expectIncludes('slots.steps[0].label: expected a non-empty string');
  expectIncludes('slots.state: expected one of done, todo');
  expectIncludes('slots.footer: expected a non-empty string');
  expectIncludes('slots.flag: expected a boolean');
  expectIncludes('slots.window.count: expected a number');
  expectIncludes('slots.extra: unknown slot');
  assert.deepEqual(checkSlots(shape, undefined, { hasIcon }), ['slots: expected an object']);
  assert.ok(checkSlots(shape, { state: 'done' }, { hasIcon }).some((e) => e.includes('slots.steps: required')));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-kit.test.js`
Expected: FAIL with `Cannot find module '.../scripts/pictograms.js'`.

- [ ] **Step 3: Implement**

Rules:

- `pictograms.js`: one frozen map from name to an SVG fragment drawn inside a 100x100 box using only `path`, `rect`, `circle`, `line`, `polyline` and `ellipse`, stroke-only (`fill="none"` comes from the wrapper). Each is a simple, recognisable line icon: `person` is a head circle and shoulders arc; `people` is two of those overlapped; `phone` a rounded rectangle with a speaker bar; `laptop` a screen and a base; `email` an envelope; `chat` a speech bubble; `sheet` a grid; `deck` a slide on a stand; `document` a page with lines; `calendar`; `clock`; `money` a coin with a bar; `chart` three bars; `search` a magnifier; `link` two chain loops; `lock`; `check` a tick in a circle; `cross` an X in a circle; `warning` a triangle with a bar; `star`; `camera`; `video` a play triangle in a rounded rectangle; `megaphone`; `handshake` two hands as simple clasped shapes. The wrapper is exactly `<g transform="translate(${x} ${y}) scale(${size / 100})" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">…</g>`.
- `svg.js`:
  - `esc` replaces `&`, `<`, `>`, `"` in that order.
  - `maxCharsFor(width, size)` is `Math.floor(width / (size * 0.56))`.
  - `wrapText`: greedy word wrap to `maxChars`; a single word longer than `maxChars` is cut. When text remains after `maxLines`, the last line is cut to `maxChars - 1` characters, trailing whitespace trimmed, and `…` appended.
  - `textLines`: one `<text>` with `x`, `y`, `font-size`, `font-weight`, `fill`, `text-anchor`; one `<tspan x dy>` per line, first `dy="0"`, the rest `dy="${size * lineHeight}"`; content escaped.
- `schema.js`: recursive walk following the table above. Messages are exactly those in the test. Report unknown keys at every object level. An optional value that is `undefined` is skipped; a required one reports `<path>: required`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/story-video-kit.test.js`
Expected: `pass 3`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add skills/story-video/scripts/pictograms.js skills/story-video/scripts/layouts/svg.js skills/story-video/scripts/layouts/schema.js tests/story-video-kit.test.js
git commit -m "story-video: add pictograms, svg helpers and slot checker"
```

---

### Task 3: Layout registry and the first four layouts

**Files:**
- Create: `skills/story-video/scripts/layouts/index.js`, `layouts/title.js`, `layouts/flow.js`, `layouts/checklist.js`, `layouts/chat.js`
- Test: `tests/story-video-layouts.test.js`

**Interfaces:**
- Consumes: `pictogram`, `has` from `../pictograms`; `COLORS`, `TONES`, `wrapText`, `maxCharsFor`, `textLines`, `esc` from `./svg`; `checkSlots` from `./schema`; `STAGE_WIDTH`, `STAGE_HEIGHT` from `../lib/constants`.
- Produces: each layout module exports `{ name, slotSchema, example, render(slots, ctx), check? }`. `ctx` is `{ tone: { accent, soft }, protagonist: { name, color } | null }`. `render` returns inner SVG markup for a `0 0 1740 530` viewBox (no outer `<svg>`). `check(slots)` is optional and returns extra error strings. `index.js` exports `LAYOUTS` (object keyed by name) and `getLayout(name)` (returns the module or `null`).

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-layouts.test.js`:

```js
'use strict';
// Generic tests that every registered layout must pass. Run with: node --test tests/story-video-layouts.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '..', 'skills', 'story-video', 'scripts');
const { LAYOUTS, getLayout } = require(path.join(SCRIPTS, 'layouts', 'index.js'));
const { checkSlots } = require(path.join(SCRIPTS, 'layouts', 'schema.js'));
const { TONES } = require(path.join(SCRIPTS, 'layouts', 'svg.js'));
const pictograms = require(path.join(SCRIPTS, 'pictograms.js'));

const EXPECTED = ['chat', 'checklist', 'flow', 'title'];
const CTX = { tone: TONES.amber, protagonist: { name: 'Asha', color: 'teal' } };
const LONG = 'x'.repeat(200);
const TEXT_KEYS = new Set(['label', 'text', 'title', 'footer', 'app', 'value']);

function withLongText(value, key) {
  if (Array.isArray(value)) return value.map((v) => withLongText(v, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withLongText(v, k)]));
  return typeof value === 'string' && TEXT_KEYS.has(key) ? LONG : value;
}

test('registry holds exactly the expected layouts', () => {
  assert.deepEqual(Object.keys(LAYOUTS).sort(), EXPECTED);
  assert.equal(getLayout('flow'), LAYOUTS.flow);
  assert.equal(getLayout('nope'), null);
});

for (const name of EXPECTED) {
  test(`${name}: example slots are valid and render inside the type rules`, () => {
    const layout = LAYOUTS[name];
    assert.equal(layout.name, name);
    assert.deepEqual(checkSlots(layout.slotSchema, layout.example, { hasIcon: pictograms.has }), []);
    if (layout.check) assert.deepEqual(layout.check(layout.example), []);
    const out = layout.render(layout.example, CTX);
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 200, 'renders real markup');
    assert.ok(!/<svg[\s>]/.test(out), 'returns inner markup only');
    const sizes = [...out.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
    assert.ok(sizes.length > 0, 'has text');
    assert.ok(Math.min(...sizes) >= 30, `smallest font is ${Math.min(...sizes)}`);
    assert.ok(out.includes(CTX.tone.accent), 'uses the tone accent');
  });

  test(`${name}: over-long text is truncated, never emitted whole`, () => {
    const layout = LAYOUTS[name];
    const out = layout.render(withLongText(layout.example), CTX);
    assert.ok(!out.includes(LONG), 'the 200 character string must not appear whole');
    assert.ok(out.includes('…'), 'truncation is marked with an ellipsis');
  });
}

test('flow draws one card per step and one arrow between neighbours', () => {
  const steps = [{ icon: 'email', label: 'A' }, { icon: 'chat', label: 'B' }, { icon: 'sheet', label: 'C' }, { icon: 'check', label: 'D' }];
  const out = LAYOUTS.flow.render({ steps }, CTX);
  assert.equal((out.match(/data-role="card"/g) || []).length, 4);
  assert.equal((out.match(/data-role="arrow"/g) || []).length, 3);
});

test('checklist marks each state differently; chat puts the protagonist on the right', () => {
  const list = LAYOUTS.checklist.render({ items: [{ label: 'a', state: 'done' }, { label: 'b', state: 'todo' }, { label: 'c', state: 'problem' }] }, CTX);
  for (const state of ['done', 'todo', 'problem']) assert.ok(list.includes(`data-state="${state}"`), state);
  const chat = LAYOUTS.chat.render({ windows: [{ app: 'Mail', messages: [{ from: 'Asha', text: 'Hi' }, { from: 'Client', text: 'Hello' }] }] }, CTX);
  assert.equal((chat.match(/data-side="right"/g) || []).length, 1);
  assert.equal((chat.match(/data-side="left"/g) || []).length, 1);
});

test('title renders with both halves, one half, or only a footer', () => {
  const both = LAYOUTS.title.render(LAYOUTS.title.example, CTX);
  assert.equal((both.match(/data-role="half"/g) || []).length, 2);
  const footerOnly = LAYOUTS.title.render({ footer: 'The story is illustrative.' }, CTX);
  assert.equal((footerOnly.match(/data-role="half"/g) || []).length, 0);
  assert.ok(footerOnly.includes('The story is illustrative.'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-layouts.test.js`
Expected: FAIL with `Cannot find module '.../layouts/index.js'`.

- [ ] **Step 3: Implement `flow.js` as the exemplar**

Create `skills/story-video/scripts/layouts/flow.js`:

```js
'use strict';
// flow: a process, left to right, one card per step with arrows between neighbours.
const { pictogram } = require('../pictograms');
const { COLORS, textLines, wrapText, maxCharsFor } = require('./svg');
const { STAGE_WIDTH, STAGE_HEIGHT } = require('../lib/constants');

const GAP = 70;
const CARD_HEIGHT = 410;
const ICON_SIZE = 150;
const LABEL_SIZE = 36;

const slotSchema = { steps: { array: { min: 2, max: 5, of: { icon: 'icon', label: 'string' } } } };

const example = {
  steps: [
    { icon: 'document', label: 'Write the storyboard' },
    { icon: 'laptop', label: 'Render the slides' },
    { icon: 'megaphone', label: 'Narrate each scene' },
    { icon: 'video', label: 'Encode the video' },
  ],
};

function render(slots, ctx) {
  const count = slots.steps.length;
  const cardWidth = Math.floor((STAGE_WIDTH - GAP * (count - 1)) / count);
  const top = Math.round((STAGE_HEIGHT - CARD_HEIGHT) / 2);
  const middle = top + CARD_HEIGHT / 2;
  const maxChars = maxCharsFor(cardWidth - 48, LABEL_SIZE);

  return slots.steps.map((step, i) => {
    const x = i * (cardWidth + GAP);
    const card = `<rect data-role="card" x="${x}" y="${top}" width="${cardWidth}" height="${CARD_HEIGHT}" rx="28" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="3"/>`;
    const icon = pictogram(step.icon, { x: x + (cardWidth - ICON_SIZE) / 2, y: top + 50, size: ICON_SIZE, color: ctx.tone.accent });
    const label = textLines({ x: x + cardWidth / 2, y: top + 280, lines: wrapText(step.label, maxChars, 2), size: LABEL_SIZE, weight: 600, fill: COLORS.ink, anchor: 'middle' });
    const arrow = i < count - 1
      ? `<path data-role="arrow" d="M${x + cardWidth + 14} ${middle} h${GAP - 28} m-16 -14 l16 14 l-16 14" fill="none" stroke="${ctx.tone.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
    return `<g>${card}${icon}${label}${arrow}</g>`;
  }).join('\n');
}

module.exports = { name: 'flow', slotSchema, example, render };
```

- [ ] **Step 4: Implement `title.js`, `checklist.js`, `chat.js` and `index.js` in the same style**

Rules (all coordinates inside 1740x530; all text through `textLines`, all labels through `wrapText`; every colour from `COLORS` or `ctx.tone`):

- `title`: `slotSchema = { left: { shape: { label: 'string', icons: { array: { min: 1, max: 4, of: 'icon' } } }, optional: true }, right: { same, optional: true }, footer: 'string?' }`. Each present half is a `<g data-role="half">`: an 840x400 rounded panel (left at x=0, right at x=900; a single half is centred), filled `ctx.tone.soft` for the right half and `COLORS.surface` for the left, its label at 44px weight 700 near the top, its icons in a centred row at 120px. `footer` is one line at 32px, `COLORS.ink2`, centred at y=505, wrapped to one line. With no halves and no footer, draw a centred 600x12 accent bar so the stage is never empty. `example` has both halves and a footer.
- `checklist`: `slotSchema = { items: { array: { min: 2, max: 6, of: { label: 'string', state: { enum: ['done', 'todo', 'problem'] } } } } }`. One column up to 3 items, two columns of 840 above that. Each row is a `<g data-state="…">`, 130px tall, vertically centred as a block: a 70px marker (`check` pictogram in the accent for `done`; an empty 60px circle in `COLORS.line` for `todo`; `warning` pictogram in `#b3261e` for `problem`) and the label at 38px weight 600, wrapped to 2 lines.
- `chat`: `slotSchema = { windows: { array: { min: 1, max: 3, of: { app: 'string', messages: { array: { min: 1, max: 4, of: { from: 'string', text: 'string' } } } } } } }`. Windows share the width with a 50px gap, full stage height, rounded, `COLORS.surface`; a 64px title bar in `ctx.tone.soft` with the app name at 30px weight 700. Each message is a `<g data-side="left|right">` bubble 100px tall: `right` and filled `ctx.tone.soft` when `from` equals `ctx.protagonist.name` (case-insensitive), otherwise `left` and filled `COLORS.ground`. Inside: `from` is not drawn; `text` at 30px wrapped to 2 lines. Bubbles take 78% of the window width.
- `index.js`: `const LAYOUTS = Object.freeze({ title, flow, checklist, chat })` and `getLayout(name)` using `Object.prototype.hasOwnProperty`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/story-video-layouts.test.js`
Expected: `pass 12`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add skills/story-video/scripts/layouts tests/story-video-layouts.test.js
git commit -m "story-video: add layout registry with title, flow, checklist and chat"
```

---

### Task 4: The remaining five layouts

**Files:**
- Create: `skills/story-video/scripts/layouts/spreadsheet.js`, `layouts/funnel.js`, `layouts/wireframe.js`, `layouts/crossed.js`, `layouts/roadmap.js`
- Modify: `skills/story-video/scripts/layouts/index.js` (register the five), `tests/story-video-layouts.test.js` (the `EXPECTED` list and five specific tests)

**Interfaces:**
- Consumes: the layout module contract `{ name, slotSchema, example, render(slots, ctx), check? }`, `ctx = { tone: { accent, soft }, protagonist }`, and the helpers `pictogram`, `COLORS`, `textLines`, `wrapText`, `maxCharsFor`, `STAGE_WIDTH`, `STAGE_HEIGHT`. Read `skills/story-video/scripts/layouts/flow.js` first; it is the style exemplar.
- Produces: `LAYOUTS` with nine entries: `chat, checklist, crossed, flow, funnel, roadmap, spreadsheet, title, wireframe`.

- [ ] **Step 1: Extend the tests**

In `tests/story-video-layouts.test.js` replace the `EXPECTED` line with:

```js
const EXPECTED = ['chat', 'checklist', 'crossed', 'flow', 'funnel', 'roadmap', 'spreadsheet', 'title', 'wireframe'];
```

and append:

```js
test('spreadsheet draws a header and one row group per row, highlights cells, and checks row width', () => {
  const slots = { columns: ['Creator', 'Rate', 'Status'], rows: [['Asha', '20k', 'Yes'], ['Ravi', '35k', 'No']], highlight: [[1, 2]] };
  const out = LAYOUTS.spreadsheet.render(slots, CTX);
  assert.equal((out.match(/data-role="row"/g) || []).length, 2);
  assert.equal((out.match(/data-role="highlight"/g) || []).length, 1);
  assert.deepEqual(LAYOUTS.spreadsheet.check(slots), []);
  const ragged = LAYOUTS.spreadsheet.check({ columns: ['A', 'B'], rows: [['1', '2'], ['1']] });
  assert.ok(ragged.some((e) => e.includes('slots.rows[1]: expected 2 cells, got 1')));
  const outside = LAYOUTS.spreadsheet.check({ columns: ['A', 'B'], rows: [['1', '2'], ['3', '4']], highlight: [[5, 0]] });
  assert.ok(outside.some((e) => e.includes('slots.highlight[0]: outside the table')));
});

test('funnel bars narrow from top to bottom', () => {
  const out = LAYOUTS.funnel.render({ stages: [{ label: 'Found', value: '120' }, { label: 'Replied', value: '40' }, { label: 'Signed', value: '5' }] }, CTX);
  const widths = [...out.matchAll(/data-role="stage" [^>]*width="(\d+)"/g)].map((m) => Number(m[1]));
  assert.equal(widths.length, 3);
  assert.ok(widths[0] > widths[1] && widths[1] > widths[2], widths.join(','));
});

test('wireframe draws the window, its nav items and one group per panel', () => {
  const out = LAYOUTS.wireframe.render({ window: { title: 'Campaigns', nav: ['Home', 'Creators'], panels: [{ title: 'Shortlist', lines: 3 }, { title: 'Budget', lines: 2 }] } }, CTX);
  assert.equal((out.match(/data-role="panel"/g) || []).length, 2);
  assert.equal((out.match(/data-role="placeholder"/g) || []).length, 5);
  assert.ok(out.includes('Campaigns') && out.includes('Creators'));
});

test('crossed strikes only the crossed cards; roadmap numbers its phases', () => {
  const crossed = LAYOUTS.crossed.render({ cards: [{ icon: 'sheet', label: 'Spreadsheets', crossed: true }, { icon: 'laptop', label: 'One workspace', crossed: false }] }, CTX);
  assert.equal((crossed.match(/data-role="strike"/g) || []).length, 1);
  const roadmap = LAYOUTS.roadmap.render({ phases: [{ label: 'Foundation', items: ['Login'] }, { label: 'Discovery', items: ['Search', 'Lists'] }, { label: 'Reporting', items: ['Exports'] }] }, CTX);
  assert.equal((roadmap.match(/data-role="phase"/g) || []).length, 3);
  assert.ok(roadmap.includes('>1<') && roadmap.includes('>3<'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-layouts.test.js`
Expected: FAIL. The registry test reports the five missing names and the new tests fail on `Cannot read properties of undefined`.

- [ ] **Step 3: Implement the five layouts and register them**

Rules (same conventions as `flow.js`: constants at the top, all text through `textLines`, labels through `wrapText` or truncated to one line with `wrapText(text, n, 1)`, colours from `COLORS` and `ctx.tone`, an `example` that passes its own `slotSchema`):

- `spreadsheet`: `slotSchema = { columns: { array: { min: 2, max: 6, of: 'string' } }, rows: { array: { min: 2, max: 6, of: { array: { min: 1, max: 6, of: 'string' } } } }, highlight: { array: { min: 0, max: 12, of: { array: { min: 2, max: 2, of: 'number' } } }, optional: true } }`. `check(slots)` returns `slots.rows[i]: expected <n> cells, got <m>` for every row whose length differs from `columns.length`, and `slots.highlight[i]: outside the table` for a `[row, col]` pair outside the rows and columns. Table spans the stage width; row height is `Math.min(74, Math.floor(STAGE_HEIGHT / (rows + 1)))`; header band filled `ctx.tone.soft` with 30px weight 700 text; each body row is a `<g data-role="row">` with 30px cells truncated to one line for the column width; grid lines in `COLORS.line`; each highlight is a `<rect data-role="highlight">` filled `ctx.tone.soft` with a 3px accent stroke drawn under the cell text.
- `funnel`: `slotSchema = { stages: { array: { min: 2, max: 5, of: { label: 'string', value: 'string' } } } }`. Bars are centred, 1500 wide at the top and 230 narrower per stage, height `Math.min(96, Math.floor((STAGE_HEIGHT - 16 * (n - 1)) / n))`, 16px apart, as `<rect data-role="stage" … width="<integer>">`. First bar filled with the accent and white text; later bars filled `ctx.tone.soft` with `COLORS.ink` text. `label` at 34px left-aligned 40px inside the bar, `value` at 36px weight 700 right-aligned 40px inside; label truncated to one line for the space left of the value.
- `wireframe`: `slotSchema = { window: { title: 'string', nav: { array: { min: 0, max: 5, of: 'string' } }, panels: { array: { min: 1, max: 4, of: { title: 'string', lines: 'number' } } } } }`. `check` reports `slots.window.panels[i].lines: expected 1 to 4` outside that range. One rounded window over the whole stage; a 60px title bar in `ctx.tone.soft` with three small circles and the title at 30px weight 700; a 280px left nav with items at 30px, the first in the accent; the rest is a grid of panels (one row up to 2 panels, two rows above that), each `<g data-role="panel">` with its title at 32px weight 600 and `lines` grey rounded bars, each `<rect data-role="placeholder">`, of decreasing width.
- `crossed`: `slotSchema = { cards: { array: { min: 2, max: 4, of: { icon: 'icon', label: 'string', crossed: 'bool?' } } } }`. Cards laid out like `flow` without arrows. A crossed card draws its icon and label in `COLORS.ink2` at `opacity="0.45"` and adds `<path data-role="strike">`, two diagonals corner to corner inset 40px, stroke `#b3261e`, width 8. Other cards use the accent.
- `roadmap`: `slotSchema = { phases: { array: { min: 2, max: 5, of: { label: 'string', items: { array: { min: 1, max: 3, of: 'string' } } } } } }`. A horizontal accent line at y=90 across the stage; each phase is a `<g data-role="phase">` in an equal column: a 72px circle on the line filled with the accent holding its number (1-based) at 34px weight 700 in white, centred, written as `>N<` with no surrounding whitespace; below, the label at 38px weight 700 wrapped to 2 lines, then each item at 30px, one line, prefixed with a bullet `•`.
- `index.js`: register all nine.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/story-video-layouts.test.js`
Expected: `pass 26`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add skills/story-video/scripts/layouts tests/story-video-layouts.test.js
git commit -m "story-video: add spreadsheet, funnel, wireframe, crossed and roadmap layouts"
```

---

### Task 5: Storyboard validator and the example storyboard

**Files:**
- Create: `skills/story-video/scripts/lib/storyboard.js`, `skills/story-video/scripts/validate-storyboard.js`, `skills/story-video/templates/storyboard.example.json`
- Test: `tests/story-video-storyboard.test.js`

**Interfaces:**
- Consumes: `getLayout(name)` and `LAYOUTS` from `scripts/layouts/index.js` (each layout has `slotSchema`, optional `check(slots)`); `checkSlots(shape, slots, { hasIcon })` from `scripts/layouts/schema.js`; `has` from `scripts/pictograms.js`; `TONES` from `scripts/layouts/svg.js`; `WORDS_PER_MINUTE` from `scripts/lib/constants.js`.
- Produces: `storyboard.loadStoryboard(file)` (parsed object; throws `Error('cannot read <file>: <message>')`); `storyboard.countWords(text)`; `storyboard.validateStoryboard(board)` returning `{ errors: string[], warnings: string[], summary: { scenes, words, minutes, customIds, plannedIds } }`. CLI: `node validate-storyboard.js <storyDir or storyboard.json>` prints `error: …` lines and exits 1, or prints warnings then one `ok: …` line and exits 0.

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-storyboard.test.js`:

```js
'use strict';
// Storyboard validation tests. Run with: node --test tests/story-video-storyboard.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SKILL = path.resolve(__dirname, '..', 'skills', 'story-video');
const { validateStoryboard, loadStoryboard, countWords } = require(path.join(SKILL, 'scripts', 'lib', 'storyboard.js'));
const { LAYOUTS } = require(path.join(SKILL, 'scripts', 'layouts', 'index.js'));
const CLI = path.join(SKILL, 'scripts', 'validate-storyboard.js');
const EXAMPLE = path.join(SKILL, 'templates', 'storyboard.example.json');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-story-board-'));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const example = () => JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));
const errorsOf = (mutate) => { const board = example(); mutate(board); return validateStoryboard(board).errors; };
const expectError = (mutate, needle) => {
  const errors = errorsOf(mutate);
  assert.ok(errors.some((e) => e.includes(needle)), `expected "${needle}" in:\n${errors.join('\n')}`);
};

test('the shipped example is valid, uses every layout and one custom scene', () => {
  const result = validateStoryboard(example());
  assert.deepEqual(result.errors, []);
  const used = new Set(example().scenes.map((s) => s.layout));
  for (const name of Object.keys(LAYOUTS)) assert.ok(used.has(name), `example does not use ${name}`);
  assert.ok(used.has('custom'));
  assert.equal(result.summary.scenes, example().scenes.length);
  assert.ok(result.summary.words > 250);
  assert.ok(result.summary.customIds.length === 1 && result.summary.plannedIds.length >= 1);
  assert.equal(countWords('One two,  three.\nFour'), 4);
});

test('structure errors', () => {
  assert.ok(validateStoryboard({}).errors.some((e) => e.includes('title: required')));
  assert.ok(validateStoryboard({ title: 'T', scenes: [] }).errors.some((e) => e.includes('scenes: expected at least one scene')));
  expectError((b) => { b.scenes[1].id = b.scenes[0].id; }, 'duplicate id');
  expectError((b) => { b.scenes[0].id = '1'; }, 'id must be two digits');
  expectError((b) => { [b.scenes[0].id, b.scenes[1].id] = [b.scenes[1].id, b.scenes[0].id]; }, 'ids must ascend');
  expectError((b) => { b.scenes[1].layout = 'hologram'; }, 'unknown layout "hologram"');
  expectError((b) => { b.scenes[1].part = 'nowhere'; }, 'unknown part "nowhere"');
  expectError((b) => { b.parts[Object.keys(b.parts)[0]].tone = 'pink'; }, 'tone must be amber or teal');
});

test('slot errors come through with the scene id', () => {
  const flowIndex = example().scenes.findIndex((s) => s.layout === 'flow');
  const id = example().scenes[flowIndex].id;
  expectError((b) => { b.scenes[flowIndex].slots.steps[0].icon = 'rocket'; }, `scene ${id}: slots.steps[0].icon: unknown icon "rocket"`);
  expectError((b) => { b.scenes[flowIndex].slots = { steps: [] }; }, `scene ${id}: slots.steps: expected 2 to 5 items, got 0`);
});

test('text rules', () => {
  expectError((b) => { b.scenes[1].heading = 'h'.repeat(49); }, 'heading is 49 characters, limit 48');
  expectError((b) => { b.scenes[1].sub = 's'.repeat(91); }, 'sub is 91 characters, limit 90');
  expectError((b) => { b.scenes[1].narration = ''; }, 'narration: required');
  expectError((b) => { b.scenes[1].narration = 'Too short.'; }, 'narration is 2 words, expected 25 to 110');
  expectError((b) => { b.scenes[1].narration += ' This uses A.I. tools.'; }, 'write "AI", not "A.I."');
  expectError((b) => { delete b.scenes[1].source; }, 'source: required');
  const customIndex = example().scenes.findIndex((s) => s.layout === 'custom');
  expectError((b) => { b.scenes[customIndex].visual = ''; }, 'custom scenes need a visual description');
});

test('a narration sentence copied onto the slide is an error', () => {
  const flowIndex = example().scenes.findIndex((s) => s.layout === 'flow');
  expectError((b) => {
    const scene = b.scenes[flowIndex];
    const sentence = scene.narration.split(/(?<=[.!?])\s+/).find((s) => s.split(/\s+/).length >= 4);
    scene.slots.steps[0].label = sentence;
  }, 'repeats a narration sentence');
});

test('length target produces a warning, not an error', () => {
  const board = example();
  board.targetMinutes = 30;
  const result = validateStoryboard(board);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => w.includes('target')));
});

test('CLI: ok line and exit 0 for a directory or a file, error lines and exit 1 otherwise', () => {
  const dir = path.join(tmpRoot, 'story dir ');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(EXAMPLE, path.join(dir, 'storyboard.json'));
  const okDir = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(okDir.status, 0, okDir.stderr);
  assert.match(okDir.stdout, /^ok: \d+ scenes, \d+ words, ~\d+\.\d min, custom: \d\d, planned: /m);
  assert.equal(spawnSync(process.execPath, [CLI, EXAMPLE], { encoding: 'utf8' }).status, 0);

  const broken = example();
  broken.scenes[1].layout = 'hologram';
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(broken));
  const bad = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /^error: scene \d\d: unknown layout "hologram"/m);

  const missing = spawnSync(process.execPath, [CLI, path.join(tmpRoot, 'nope')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /cannot read/);
  assert.throws(() => loadStoryboard(path.join(tmpRoot, 'nope', 'storyboard.json')), /cannot read/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-storyboard.test.js`
Expected: FAIL with `Cannot find module '.../lib/storyboard.js'`.

- [ ] **Step 3: Implement the validator**

Rules for `validateStoryboard(board)`; every scene-level message is prefixed `scene <id>: ` (use the array position, `scene #<n>`, when the id is missing):

1. `title: required` when missing or empty; `scenes: expected at least one scene` when not a non-empty array. Stop after structure errors that make scene checks impossible.
2. `parts`, when present: each value needs `label` (string) and `tone` in `TONES`, else `parts.<key>: tone must be amber or teal`.
3. Per scene: `id must be two digits` (`/^\d\d$/`), `duplicate id`, `ids must ascend` (compared with the previous scene's id as numbers).
4. `unknown layout "<x>"` unless `custom` or `getLayout(x)`. For kit layouts run `checkSlots(layout.slotSchema, scene.slots, { hasIcon: has })` then `layout.check(scene.slots)` if defined and there were no schema errors; prefix each with the scene.
5. `unknown part "<x>"` when `scene.part` is set and `board.parts` lacks it.
6. `heading: required`; `heading is <n> characters, limit 48`; `sub is <n> characters, limit 90` (sub is optional).
7. `narration: required`; else `narration is <n> words, expected 25 to 110`; `write "AI", not "A.I."` when the narration contains `A.I.`.
8. `source: required` unless `layout === 'title'`.
9. `custom scenes need a visual description` when `layout === 'custom'` and `visual` is empty.
10. Repetition: collect `heading`, `sub` and every string anywhere inside `slots`; split the narration into sentences; for each sentence of 4 or more words, compare case-insensitively with trailing `.!?` removed; if any collected string contains it, report `repeats a narration sentence on the slide: "<first 40 chars>"`.
11. Summary: `words` is the total narration words; `minutes` is `words / WORDS_PER_MINUTE` rounded to one decimal; `customIds`, `plannedIds`.
12. Warning when `targetMinutes` is set and `minutes` differs from it by more than 25%: `length is ~<m> min against a target of <t> min`.

`countWords` splits on whitespace and ignores empties. `loadStoryboard` reads and parses, wrapping any failure. The CLI accepts a directory (appends `storyboard.json`) or a file, prints each error as `error: <message>` to stderr, each warning as `warning: <message>` to stdout, and the ok line as `ok: <n> scenes, <w> words, ~<m> min, custom: <ids or none>, planned: <ids or none>` with ids joined by `, `.

- [ ] **Step 4: Write the example storyboard**

`templates/storyboard.example.json` explains story-video itself, so every fact comes from `docs/specs/2026-09-18-story-video.md` and `source` names the spec section. Requirements: top-level `title`, `note`, `source`, `targetMinutes: 4`, `voice`, `rate`, `protagonist: { "name": "Asha", "role": "developer", "color": "teal" }`, `parts` with `before` (label `BEFORE`, tone `amber`) and `after` (label `WITH THE SKILL`, tone `teal`); ten scenes with ids `01` to `10`, one per layout in this order: `title`, `flow`, `funnel`, `crossed`, `checklist`, `chat`, `spreadsheet`, `wireframe`, `roadmap`, then one `custom` scene with a `visual`. Each narration is 35 to 70 words, plain sentences, no sentence repeated in slots. Mark the `roadmap` scene and the `custom` scene `planned: true`. Facts to draw on: the hand-made run cost about 190k tokens, 77 tool calls and 22 minutes for 14 slides; the kit targets under 20k tokens; the five pipeline steps; the contact-sheet review; incremental rebuilds through a manifest; consent before audio leaves the machine; macOS, Linux and Windows; what is out of scope (animation, music, burned-in subtitles) goes in the `roadmap` or `crossed` scene as appropriate.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/story-video-storyboard.test.js`
Expected: `pass 7`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add skills/story-video/scripts/lib/storyboard.js skills/story-video/scripts/validate-storyboard.js skills/story-video/templates/storyboard.example.json tests/story-video-storyboard.test.js
git commit -m "story-video: add storyboard validator and example storyboard"
```

---

### Task 6: Slide frame and `render-slides.js`

**Files:**
- Create: `skills/story-video/templates/slides.css`, `skills/story-video/scripts/render-slides.js`
- Test: `tests/story-video-slides.test.js`

**Interfaces:**
- Consumes: `loadStoryboard`, `validateStoryboard` from `scripts/lib/storyboard.js`; `getLayout` from `scripts/layouts/index.js`; `TONES`, `esc` from `scripts/layouts/svg.js`; `storyPaths`, `sceneFile` from `scripts/lib/paths.js`; `loadManifest`, `saveManifest`, `isFresh`, `record`, `inputs.slide` from `scripts/lib/manifest.js`; `STAGE_WIDTH`, `STAGE_HEIGHT` from `scripts/lib/constants.js`.
- Produces: `renderSlideHtml(scene, storyboard, index, total)` returns a complete HTML document; `renderAll(storyDir, { log })` returns `{ written: string[], skipped: string[], custom: string[], customMissing: string[] }`. CLI: `node render-slides.js <storyDir>`. Manifest keys `slide:<id>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-slides.test.js`:

```js
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
  assert.deepEqual(renderAll(dir, { log: () => {} }).customMissing, []);
  fs.writeFileSync(path.join(dir, '.gitignore'), 'mine\n');
  renderAll(dir, { log: () => {} });
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'mine\n', 'an existing .gitignore is left alone');
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-slides.test.js`
Expected: FAIL with `Cannot find module '.../render-slides.js'`.

- [ ] **Step 3: Write `templates/slides.css`**

```css
/* Frame for opm:story-video slides. Exactly 1920 x 1080 with a 90px safe margin. */
:root {
  --ground: #f2f5f4;
  --surface: #ffffff;
  --ink: #101a19;
  --ink-2: #445553;
  --line: #d3dcda;
  --accent: #0d6d67;
  --accent-soft: #dcecea;
}
.tone-teal { --accent: #0d6d67; --accent-soft: #dcecea; }
.tone-amber { --accent: #b26a00; --accent-soft: #f6ecd8; }

* { box-sizing: border-box; }
html, body { width: 1920px; height: 1080px; margin: 0; padding: 0; overflow: hidden; }
body {
  background: var(--ground);
  color: var(--ink);
  font-family: -apple-system, "Segoe UI", "Helvetica Neue", Roboto, "Noto Sans", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.slide { position: relative; width: 1920px; height: 1080px; overflow: hidden; }

.chip, .planned {
  position: absolute;
  top: 90px;
  padding: 13px 28px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1;
  border-radius: 999px;
}
.chip { left: 90px; color: var(--accent); background: var(--accent-soft); }
.planned { right: 90px; color: var(--surface); background: var(--ink-2); }

h1 {
  position: absolute; left: 90px; top: 182px; width: 1740px; margin: 0;
  font-size: 84px; line-height: 1.04; font-weight: 700; letter-spacing: -0.015em; color: var(--ink);
}
.sub {
  position: absolute; left: 90px; top: 294px; width: 1740px; margin: 0;
  font-size: 42px; line-height: 1.2; font-weight: 500; color: var(--ink-2);
}
.stage { position: absolute; left: 90px; top: 380px; width: 1740px; height: 530px; }
.stage svg { display: block; width: 1740px; height: 530px; }
svg text { font-family: inherit; }

.counter {
  position: absolute; right: 90px; bottom: 90px;
  font-size: 28px; font-weight: 600; letter-spacing: 0.08em; line-height: 1; color: var(--ink-2);
}
```

- [ ] **Step 4: Implement `render-slides.js`**

Rules:

- `renderSlideHtml`: throw `Error('custom scenes are not rendered by the kit')` for `custom`. Tone: `board.parts[scene.part].tone` when the part exists, else `teal`. Document:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Scene {id}</title>
<link rel="stylesheet" href="slides.css">
</head>
<body class="tone-{tone}">
<div class="slide">
  {chip: <div class="chip">{part label, escaped}</div> only when the scene has a known part}
  {planned: <div class="planned">PLANNED</div> only when scene.planned}
  <h1>{heading, escaped}</h1>
  {sub: <p class="sub">{sub, escaped}</p> only when present}
  <div class="stage"><svg viewBox="0 0 1740 530" xmlns="http://www.w3.org/2000/svg">
{layout.render(scene.slots, { tone: TONES[tone], protagonist: board.protagonist || null })}
  </svg></div>
  <div class="counter">{id} / {total, two digits}</div>
</div>
</body>
</html>
```

- `renderAll(storyDir, { log = console.log } = {})`: load and validate; on validation errors throw an `Error` whose message is the errors joined by newlines. Create `slides/`; always copy `templates/slides.css` to `slides/slides.css`; write `.gitignore` only when it does not exist. For each kit scene compute `inputs.slide`, skip when `isFresh(manifest, 'slide:<id>', hash, file)`, else write and `record`. Save the manifest once at the end. `custom` lists every custom id; `customMissing` those without a file in `slides/`.
- CLI: print `wrote scene-<id>.html` or `fresh scene-<id>.html` per scene, then `custom scenes to draw: <ids>` when `customMissing` is not empty (`custom scenes to draw: none` otherwise). On any error print `error: <message>` lines to stderr and exit 1.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/story-video-slides.test.js`
Expected: `pass 5`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add skills/story-video/templates/slides.css skills/story-video/scripts/render-slides.js tests/story-video-slides.test.js
git commit -m "story-video: add slide frame and render-slides"
```

---

### Task 7: `setup.js` and `render-frames.js`

**Files:**
- Create: `skills/story-video/scripts/setup.js`, `skills/story-video/scripts/render-frames.js`
- Test: `tests/story-video-frames.test.js`

**Interfaces:**
- Consumes: `toolsDir`, `venvPython`, `toolBinary`, `findBrowser`, `storyPaths`, `sceneFile` from `scripts/lib/paths.js`; `readPngSize` from `scripts/lib/png.js`; `loadManifest`, `saveManifest`, `isFresh`, `record`, `inputs.frame` from `scripts/lib/manifest.js`; `WIDTH`, `HEIGHT` from `scripts/lib/constants.js`.
- Produces:
  - `setup.findPython({ platform, which })` returns `{ cmd, args }` or `null`; `setup.installPlan({ tools, platform, python })` returns `[{ cmd, args, cwd, shell }]`; `setup.check({ env, platform })` returns `{ node, toolsDir, browser, python, ffmpeg, ffprobe, edgeTts }`. CLI: `node setup.js --check` prints that object as JSON; `node setup.js` runs the plan.
  - `renderFrames.chromeArgs({ userDataDir, pngPath, htmlPath })` string[]; `renderFrames.listSlides(slidesDir)` `[{ id, htmlPath }]` sorted by id; `renderFrames.renderFrame({ browser, htmlPath, pngPath, userDataDir, timeoutMs, spawn })` Promise; CLI: `node render-frames.js <storyDir> [--dry-run]`. Manifest keys `frame:<id>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-frames.test.js`:

```js
'use strict';
// Tests for tool setup and frame rendering, without a browser. Run with: node --test tests/story-video-frames.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '..', 'skills', 'story-video', 'scripts');
const setup = require(path.join(SCRIPTS, 'setup.js'));
const frames = require(path.join(SCRIPTS, 'render-frames.js'));

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-story-frames-'));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

function pngFile(file, width, height) {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8); buf.write('IHDR', 12, 'ascii'); buf.writeUInt32BE(width, 16); buf.writeUInt32BE(height, 20);
  fs.writeFileSync(file, buf);
}

test('findPython prefers python3, then python, then the py launcher on Windows', () => {
  assert.deepEqual(setup.findPython({ platform: 'darwin', which: (n) => (n === 'python3' ? '/usr/bin/python3' : null) }), { cmd: '/usr/bin/python3', args: [] });
  assert.deepEqual(setup.findPython({ platform: 'linux', which: (n) => (n === 'python' ? '/usr/bin/python' : null) }), { cmd: '/usr/bin/python', args: [] });
  assert.deepEqual(setup.findPython({ platform: 'win32', which: (n) => (n === 'py' ? 'C:\\Windows\\py.exe' : null) }), { cmd: 'C:\\Windows\\py.exe', args: ['-3'] });
  assert.equal(setup.findPython({ platform: 'linux', which: () => null }), null);
});

test('installPlan: npm into the tools folder, venv and edge-tts only with Python, npm.cmd through a shell on Windows', () => {
  const mac = setup.installPlan({ tools: '/t', platform: 'darwin', python: { cmd: '/usr/bin/python3', args: [] } });
  assert.deepEqual(mac[0], { cmd: 'npm', args: ['install', '--no-audit', '--no-fund', 'ffmpeg-static', 'ffprobe-static'], cwd: '/t', shell: false });
  assert.deepEqual(mac[1], { cmd: '/usr/bin/python3', args: ['-m', 'venv', 'venv'], cwd: '/t', shell: false });
  assert.deepEqual(mac[2], { cmd: '/t/venv/bin/python', args: ['-m', 'pip', 'install', '--quiet', 'edge-tts'], cwd: '/t', shell: false });
  assert.equal(mac.length, 3);

  const win = setup.installPlan({ tools: 'C:\\t', platform: 'win32', python: { cmd: 'py', args: ['-3'] } });
  assert.equal(win[0].cmd, 'npm.cmd');
  assert.equal(win[0].shell, true);
  assert.deepEqual(win[1].args, ['-3', '-m', 'venv', 'venv']);
  assert.equal(win[2].cmd, 'C:\\t\\venv\\Scripts\\python.exe');

  assert.equal(setup.installPlan({ tools: '/t', platform: 'linux', python: null }).length, 1);
});

test('setup --check reports a fresh tools folder as not ready', () => {
  const tools = path.join(tmpRoot, 'tools');
  const out = spawnSync(process.execPath, [path.join(SCRIPTS, 'setup.js'), '--check'], { encoding: 'utf8', env: { ...process.env, OPM_STORY_TOOLS: tools } });
  assert.equal(out.status, 0, out.stderr);
  const report = JSON.parse(out.stdout);
  assert.deepEqual(Object.keys(report).sort(), ['browser', 'edgeTts', 'ffmpeg', 'ffprobe', 'node', 'python', 'toolsDir']);
  assert.equal(report.toolsDir, tools);
  assert.equal(report.ffmpeg, false);
  assert.equal(report.ffprobe, false);
  assert.equal(report.edgeTts, false);
  assert.equal(report.node, process.version);
  assert.ok(!fs.existsSync(tools), '--check must not create anything');
});

test('chromeArgs: fixed flags, own user-data-dir, encoded file URL', () => {
  const args = frames.chromeArgs({ userDataDir: '/tmp/ud-03', pngPath: '/p/My Project /frames/scene-03.png', htmlPath: '/p/My Project /slides/scene-03.html' });
  assert.deepEqual(args.slice(0, 7), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1920,1080', '--no-first-run', '--no-default-browser-check']);
  assert.ok(args.includes('--user-data-dir=/tmp/ud-03'));
  assert.ok(args.includes('--screenshot=/p/My Project /frames/scene-03.png'));
  assert.equal(args[args.length - 1], 'file:///p/My%20Project%20/slides/scene-03.html');
});

test('listSlides returns scene files in id order and ignores everything else', () => {
  const dir = path.join(tmpRoot, 'slides');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['scene-10.html', 'scene-02.html', 'slides.css', 'notes.html']) fs.writeFileSync(path.join(dir, f), '');
  assert.deepEqual(frames.listSlides(dir).map((s) => s.id), ['02', '10']);
});

function fakeSpawn(onStart) {
  const calls = [];
  const spawn = (cmd, args) => {
    const child = new EventEmitter();
    child.killed = false;
    child.kill = () => { child.killed = true; child.emit('exit', null, 'SIGTERM'); return true; };
    calls.push({ cmd, args, child });
    onStart(args);
    return child;
  };
  return { spawn, calls };
}

test('renderFrame waits for the PNG, kills the browser, removes the profile, and checks the size', async () => {
  const pngPath = path.join(tmpRoot, 'ok.png');
  const userDataDir = path.join(tmpRoot, 'ud-ok');
  const { spawn, calls } = fakeSpawn(() => { fs.mkdirSync(userDataDir, { recursive: true }); setTimeout(() => pngFile(pngPath, 1920, 1080), 30); });
  const size = await frames.renderFrame({ browser: '/b', htmlPath: '/s/scene-01.html', pngPath, userDataDir, timeoutMs: 3000, settleMs: 10, pollMs: 10, spawn });
  assert.deepEqual(size, { width: 1920, height: 1080 });
  assert.equal(calls[0].child.killed, true);
  assert.ok(!fs.existsSync(userDataDir));
});

test('renderFrame fails on the wrong size and on a timeout, naming the file', async () => {
  const small = path.join(tmpRoot, 'small.png');
  const a = fakeSpawn(() => pngFile(small, 800, 600));
  await assert.rejects(frames.renderFrame({ browser: '/b', htmlPath: '/s/scene-02.html', pngPath: small, userDataDir: path.join(tmpRoot, 'ud-a'), timeoutMs: 1000, settleMs: 5, pollMs: 5, spawn: a.spawn }), /scene-02.*800x600.*1920x1080/);
  const never = path.join(tmpRoot, 'never.png');
  const b = fakeSpawn(() => {});
  await assert.rejects(frames.renderFrame({ browser: '/b', htmlPath: '/s/scene-03.html', pngPath: never, userDataDir: path.join(tmpRoot, 'ud-b'), timeoutMs: 60, settleMs: 5, pollMs: 10, spawn: b.spawn }), /scene-03.*no frame after/);
  assert.equal(b.calls[0].child.killed, true);
});

test('CLI --dry-run prints one JSON line per slide with its own profile dir and an encoded URL', () => {
  const dir = path.join(tmpRoot, 'story dir ');
  fs.mkdirSync(path.join(dir, 'slides'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'slides', 'slides.css'), 'body{}');
  for (const id of ['01', '02']) fs.writeFileSync(path.join(dir, 'slides', `scene-${id}.html`), `<html>${id}</html>`);
  const out = spawnSync(process.execPath, [path.join(SCRIPTS, 'render-frames.js'), dir, '--dry-run'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const lines = out.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.scene), ['01', '02']);
  const dirs = lines.map((l) => l.args.find((a) => a.startsWith('--user-data-dir=')));
  assert.notEqual(dirs[0], dirs[1]);
  assert.ok(lines[0].args[lines[0].args.length - 1].includes('story%20dir%20/slides/scene-01.html'));
  assert.ok(!fs.existsSync(path.join(dir, 'frames')), '--dry-run writes nothing');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-frames.test.js`
Expected: FAIL with `Cannot find module '.../setup.js'`.

- [ ] **Step 3: Implement `setup.js`**

Rules:

- `findPython({ platform = process.platform, which })`: try `python3`, then `python`; on `win32` then `py` with `args: ['-3']`. `which` defaults to a PATH scan that also tries `.exe` on Windows; never spawn to detect.
- `installPlan`: exactly the three steps in the test, in that order; `cmd` is `npm.cmd` with `shell: true` on Windows (Node refuses to spawn `.cmd` files without a shell) and `npm` with `shell: false` elsewhere.
- `check({ env = process.env, platform = process.platform } = {})`: `node` is `process.version`; `browser` is `findBrowser(...)` or `null`; `python` is the found command or `null`; `ffmpeg`, `ffprobe` are booleans from `toolBinary` plus `fs.existsSync`; `edgeTts` is true when the venv python exists and `<tools>/venv` contains an `edge_tts` package directory (search `lib/python*/site-packages/edge_tts` and `Lib/site-packages/edge_tts`). `check` creates nothing.
- CLI without `--check`: create the tools folder, write `package.json` containing `{"private":true,"name":"opm-story-video-tools"}` when absent, then run each plan step with `spawnSync(cmd, args, { cwd, shell, stdio: 'inherit' })`, skipping the npm step when both binaries already resolve and the Python steps when `edgeTts` is already true. A non-zero step prints `error: <cmd> <args> failed with exit code <n>` and exits 1. Finish by printing the `check()` JSON.

- [ ] **Step 4: Implement `render-frames.js`**

Rules:

- `chromeArgs`: the seven fixed flags in the test order, then `--user-data-dir=`, `--screenshot=`, then `require('node:url').pathToFileURL(htmlPath).href` last.
- `listSlides(dir)`: files matching `/^scene-(\d\d)\.html$/`, sorted by id.
- `renderFrame({ browser, htmlPath, pngPath, userDataDir, timeoutMs = 40000, settleMs = 1000, pollMs = 500, spawn = child_process.spawn })`: delete any existing PNG; `spawn(browser, chromeArgs(...), { stdio: 'ignore' })`; poll every `pollMs` until the PNG exists with size greater than 0; wait `settleMs`; kill the child; remove `userDataDir` recursively with `force`; read the size. Reject with `Error('<basename of htmlPath>: no frame after <timeoutMs> ms')` on timeout (kill and clean up first), and with `Error('<basename>: frame is <w>x<h>, expected 1920x1080')` on a size mismatch. A spawn `error` event rejects with `Error('<basename>: cannot start browser: <message>')`.
- CLI: `storyPaths(dir)`; list slides; read `slides.css` once; for each slide compute `inputs.frame(html, css)`; `--dry-run` prints `JSON.stringify({ scene, args })` per slide using a profile dir of `path.join(os.tmpdir(), 'opm-story-chrome-<pid>-<id>')` and exits 0 without needing a browser or writing anything. Otherwise require a browser (`error: no Chromium-family browser found. Looked for Chrome, Chromium, Edge and Brave; set CHROME_PATH to override.`, exit 1), create `frames/`, skip fresh frames, render the rest one at a time, `record` each, save the manifest after every frame so an interrupted run keeps its progress, print `rendered scene-<id>.png` or `fresh scene-<id>.png`. Any failure prints `error: <message>` and exits 1.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/story-video-frames.test.js`
Expected: `pass 8`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add skills/story-video/scripts/setup.js skills/story-video/scripts/render-frames.js tests/story-video-frames.test.js
git commit -m "story-video: add tool setup and headless frame rendering"
```

---

### Task 8: `build-video.js`

**Files:**
- Create: `skills/story-video/scripts/build-video.js`
- Test: `tests/story-video-build.test.js`

**Interfaces:**
- Consumes: `loadStoryboard` from `scripts/lib/storyboard.js`; `storyPaths`, `sceneFile`, `toolsDir`, `toolBinary` from `scripts/lib/paths.js`; `buildSrt` from `scripts/lib/srt.js`; `loadManifest`, `saveManifest`, `isFresh`, `record`, `inputs.segment` from `scripts/lib/manifest.js`; `LEAD`, `TAIL`, `FADE`, `FPS`, `WIDTH`, `HEIGHT` from `scripts/lib/constants.js`.
- Produces: `segmentArgs({ png, mp3, out, duration })`, `concatArgs({ listFile, out })`, `concatList(segmentPaths)`, `contactSheetArgs({ frames, out })`, `probeArgs(mp3)`, `missingInputs(scenes, paths, exists)`. CLI: `node build-video.js build <storyDir> [--dry-run] [--assume-duration <seconds>]` and `node build-video.js contact-sheet <storyDir> [--dry-run]`. Manifest keys `segment:<id>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-build.test.js`:

```js
'use strict';
// Tests for the encoder's argument building and pre-flight checks. Run with: node --test tests/story-video-build.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SKILL = path.resolve(__dirname, '..', 'skills', 'story-video');
const build = require(path.join(SKILL, 'scripts', 'build-video.js'));
const CLI = path.join(SKILL, 'scripts', 'build-video.js');
const EXAMPLE = path.join(SKILL, 'templates', 'storyboard.example.json');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-story-build-'));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

function storyDir(name, { frames = true, audio = true } = {}) {
  const dir = path.join(tmpRoot, name);
  fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  fs.copyFileSync(EXAMPLE, path.join(dir, 'storyboard.json'));
  for (const scene of JSON.parse(fs.readFileSync(EXAMPLE, 'utf8')).scenes) {
    if (frames) fs.writeFileSync(path.join(dir, 'frames', `scene-${scene.id}.png`), 'png');
    if (audio) fs.writeFileSync(path.join(dir, 'audio', `scene-${scene.id}.mp3`), 'mp3');
  }
  return dir;
}

test('segmentArgs carries the measured encode settings', () => {
  const args = build.segmentArgs({ png: '/f/scene-01.png', mp3: '/a/scene-01.mp3', out: '/s/scene-01.mp4', duration: 10 });
  const joined = args.join(' ');
  assert.deepEqual(args.slice(0, 3), ['-y', '-loglevel', 'error']);
  assert.ok(joined.includes('-loop 1 -framerate 25 -i /f/scene-01.png -i /a/scene-01.mp3'));
  const filter = args[args.indexOf('-filter_complex') + 1];
  assert.equal(filter, '[1:a]adelay=600|600,apad,aresample=44100[a];[0:v]scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=11.1:d=0.4[v]');
  assert.ok(joined.includes('-map [v] -map [a] -t 11.5 -r 25'));
  assert.ok(joined.includes('-c:v libx264 -preset medium -crf 20 -tune stillimage -c:a aac -b:a 128k -ac 2'));
  assert.equal(args[args.length - 1], '/s/scene-01.mp4');
});

test('concat, probe and contact-sheet arguments', () => {
  assert.deepEqual(build.concatArgs({ listFile: '/b/concat.txt', out: '/o/x.mp4' }), ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', '/b/concat.txt', '-c', 'copy', '-movflags', '+faststart', '/o/x.mp4']);
  assert.equal(build.concatList(["/p/it's here/scene-01.mp4", 'C:\\p\\scene-02.mp4']), "file '/p/it'\\''s here/scene-01.mp4'\nfile 'C:/p/scene-02.mp4'\n");
  assert.deepEqual(build.probeArgs('/a/x.mp3'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', '/a/x.mp3']);
  const sheet = build.contactSheetArgs({ frames: ['/f/1.png', '/f/2.png', '/f/3.png', '/f/4.png', '/f/5.png'], out: '/b/sheet.png' });
  assert.equal(sheet.filter((a) => a === '-i').length, 5);
  assert.equal(sheet[sheet.indexOf('-filter_complex') + 1], '[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1:a=0,scale=480:270,tile=4x2[sheet]');
  assert.ok(sheet.join(' ').includes('-map [sheet] -frames:v 1 /b/sheet.png'));
});

test('missingInputs names every scene without a frame or audio', () => {
  const scenes = [{ id: '01' }, { id: '02' }, { id: '03' }];
  const paths = { frames: '/f', audio: '/a' };
  const exists = (p) => !p.endsWith('scene-02.png') && !p.endsWith('scene-03.mp3');
  assert.deepEqual(build.missingInputs(scenes, paths, exists), ['scene 02: missing frame /f/scene-02.png'.replace(/\//g, path.sep), 'scene 03: missing audio /a/scene-03.mp3'.replace(/\//g, path.sep)]);
});

test('build --dry-run prints one ffmpeg command per scene and the concat, and writes nothing', () => {
  const dir = storyDir('full story ');
  const out = spawnSync(process.execPath, [CLI, 'build', dir, '--dry-run', '--assume-duration', '10'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const lines = out.stdout.trim().split('\n').map((l) => JSON.parse(l));
  const scenes = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8')).scenes;
  assert.equal(lines.length, scenes.length + 1);
  assert.deepEqual(lines.slice(0, -1).map((l) => l.scene), scenes.map((s) => s.id));
  assert.ok(lines[0].args.includes('11.5'));
  const last = lines[lines.length - 1];
  assert.equal(last.step, 'concat');
  assert.ok(last.args[last.args.length - 1].endsWith(`${path.basename(dir)}.mp4`));
  assert.ok(!fs.existsSync(path.join(dir, 'segments')) && !fs.existsSync(path.join(dir, '.build')));
});

test('build fails before encoding when a frame or an audio file is missing, naming the scene', () => {
  const noAudio = storyDir('no audio', { audio: false });
  const a = spawnSync(process.execPath, [CLI, 'build', noAudio, '--dry-run'], { encoding: 'utf8' });
  assert.equal(a.status, 1);
  assert.match(a.stderr, /error: scene 01: missing audio/);
  assert.equal(a.stdout.trim(), '', 'nothing is planned when inputs are missing');
  const noFrames = storyDir('no frames', { frames: false });
  const b = spawnSync(process.execPath, [CLI, 'build', noFrames, '--dry-run'], { encoding: 'utf8' });
  assert.equal(b.status, 1);
  assert.match(b.stderr, /error: scene 01: missing frame/);
});

test('usage errors exit 1 with a usage line', () => {
  const out = spawnSync(process.execPath, [CLI, 'explode', tmpRoot], { encoding: 'utf8' });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /usage: build-video\.js <build\|contact-sheet> <storyDir>/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-build.test.js`
Expected: FAIL with `Cannot find module '.../build-video.js'`.

- [ ] **Step 3: Implement**

Rules:

- `segmentArgs({ png, mp3, out, duration })`: `total = round3(duration + LEAD + TAIL)`, `fadeOut = round3(total - FADE)` where `round3` rounds to 3 decimals and prints without trailing zeros (`11.5`, `11.1`). Arguments, in order: `-y -loglevel error -loop 1 -framerate 25 -i <png> -i <mp3> -filter_complex <filter> -map [v] -map [a] -t <total> -r 25 -c:v libx264 -preset medium -crf 20 -tune stillimage -c:a aac -b:a 128k -ac 2 <out>`. The filter is the exact string in the test, with `adelay` in milliseconds from `LEAD` and both fade durations from `FADE`.
- `concatList(paths)`: one `file '<path>'` line per segment, backslashes turned into forward slashes, each single quote written as `'\''`, newline after every line.
- `contactSheetArgs({ frames, out })`: `-y -loglevel error`, one `-i` per frame, the filter in the test with 4 columns and `Math.ceil(n / 4)` rows, `-map [sheet] -frames:v 1 <out>`.
- `missingInputs(scenes, paths, exists = fs.existsSync)`: for each scene in order, `scene <id>: missing frame <path>` then `scene <id>: missing audio <path>`.
- `build` command: load the storyboard; run `missingInputs`; if any, print each as `error: <line>` and exit 1 before anything else. `--dry-run`: use `--assume-duration` (default 10) for every scene, print `JSON.stringify({ scene, step: 'segment', args })` per scene and `JSON.stringify({ step: 'concat', args })`, write nothing, need no tools. Real run: resolve `ffmpeg` and `ffprobe` with `toolBinary(toolsDir())` (`error: ffmpeg is not installed; run setup.js first`, exit 1); create `segments/` and `.build/`; per scene read the PNG and MP3, compute `inputs.segment`, skip when fresh, otherwise probe the duration (`spawnSync(ffprobe, probeArgs(mp3))`, parse a float, fail with `scene <id>: cannot read audio duration`), encode, `record`, save the manifest; durations of fresh scenes are probed too because the SRT needs them. Then write `concat.txt`, run the concat, write the `.srt` from `buildSrt(scenes with durations)`, and print `done: <mp4> (<total seconds>s, <n> scenes)`. Any ffmpeg non-zero exit prints `error: scene <id>: ffmpeg failed` with its stderr and exits 1.
- `contact-sheet` command: frames for every scene in the storyboard must exist (same error wording); `--dry-run` prints `JSON.stringify({ step: 'contact-sheet', args })`; otherwise run ffmpeg and print `contact sheet: <path>`.
- Unknown command or missing directory: `usage: build-video.js <build|contact-sheet> <storyDir> [--dry-run] [--assume-duration <seconds>]` to stderr, exit 1.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/story-video-build.test.js`
Expected: `pass 6`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add skills/story-video/scripts/build-video.js tests/story-video-build.test.js
git commit -m "story-video: add segment encoding, concat, contact sheet and srt output"
```

---

### Task 9: Narration (`narrate.js`, `narrate.py`, local voices)

**Files:**
- Create: `skills/story-video/scripts/lib/local-voice.js`, `skills/story-video/scripts/narrate.js`, `skills/story-video/scripts/narrate.py`
- Test: `tests/story-video-narrate.test.js`

**Interfaces:**
- Consumes: `loadStoryboard` from `scripts/lib/storyboard.js`; `storyPaths`, `sceneFile`, `toolsDir`, `toolBinary`, `venvPython` from `scripts/lib/paths.js`; `loadManifest`, `saveManifest`, `isFresh`, `record`, `inputs.audio` from `scripts/lib/manifest.js`; `DEFAULT_VOICE`, `DEFAULT_RATE` from `scripts/lib/constants.js`.
- Produces: `localVoice.localVoicePlan({ platform, textFile, rawFile })` returns `{ cmd, args, rawExt }` or `null`; `localVoice.toMp3Args(rawFile, mp3File)`; `narrate.cleanText(text)`; `narrate.staleScenes(storyboard, paths, manifest, engine, exists)` returns scene objects needing narration. CLI: `node narrate.js <storyDir> --engine neural|local [--dry-run]`. Python: `narrate.py <storyboard.json> <audioDir> --only 01,03 [--dry-run]`. Manifest keys `audio:<id>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-narrate.test.js`:

```js
'use strict';
// Narration tests: planning only, nothing is spoken or sent. Run with: node --test tests/story-video-narrate.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SKILL = path.resolve(__dirname, '..', 'skills', 'story-video');
const SCRIPTS = path.join(SKILL, 'scripts');
const localVoice = require(path.join(SCRIPTS, 'lib', 'local-voice.js'));
const narrate = require(path.join(SCRIPTS, 'narrate.js'));
const manifestLib = require(path.join(SCRIPTS, 'lib', 'manifest.js'));
const { storyPaths } = require(path.join(SCRIPTS, 'lib', 'paths.js'));
const EXAMPLE = path.join(SKILL, 'templates', 'storyboard.example.json');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-story-narrate-'));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));
const board = () => JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));

test('localVoicePlan per platform reads the text from a file', () => {
  assert.deepEqual(localVoice.localVoicePlan({ platform: 'darwin', textFile: '/t/01.txt', rawFile: '/t/01' }), { cmd: 'say', args: ['-f', '/t/01.txt', '-o', '/t/01.aiff'], rawExt: 'aiff' });
  assert.deepEqual(localVoice.localVoicePlan({ platform: 'linux', textFile: '/t/01.txt', rawFile: '/t/01' }), { cmd: 'espeak-ng', args: ['-f', '/t/01.txt', '-w', '/t/01.wav'], rawExt: 'wav' });
  const win = localVoice.localVoicePlan({ platform: 'win32', textFile: "C:\\t\\it's.txt", rawFile: 'C:\\t\\01' });
  assert.equal(win.cmd, 'powershell');
  assert.deepEqual(win.args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
  assert.ok(win.args[3].includes('System.Speech') && win.args[3].includes("SetOutputToWaveFile('C:\\t\\01.wav')"));
  assert.ok(win.args[3].includes("ReadAllText('C:\\t\\it''s.txt')"), 'single quotes are doubled for PowerShell');
  assert.equal(localVoice.localVoicePlan({ platform: 'freebsd', textFile: '/t', rawFile: '/t' }), null);
  assert.deepEqual(localVoice.toMp3Args('/t/01.aiff', '/a/scene-01.mp3'), ['-y', '-loglevel', 'error', '-i', '/t/01.aiff', '-c:a', 'libmp3lame', '-b:a', '128k', '/a/scene-01.mp3']);
});

test('cleanText fixes the spelling that neural voices read badly', () => {
  assert.equal(narrate.cleanText('A.I. tools and A.I. clips'), 'AI tools and AI clips');
});

test('staleScenes: everything first, nothing once recorded, only the edited scene after an edit', () => {
  const b = board();
  const paths = storyPaths(path.join(tmpRoot, 'x'));
  assert.equal(narrate.staleScenes(b, paths, {}, 'neural', () => false).length, b.scenes.length);
  let recorded = {};
  for (const scene of b.scenes) recorded = manifestLib.record(recorded, `audio:${scene.id}`, manifestLib.inputs.audio(scene, b, 'neural'));
  assert.deepEqual(narrate.staleScenes(b, paths, recorded, 'neural', () => true), []);
  assert.equal(narrate.staleScenes(b, paths, recorded, 'local', () => true).length, b.scenes.length, 'a different engine re-narrates everything');
  b.scenes[2].narration += ' One more sentence for this scene.';
  assert.deepEqual(narrate.staleScenes(b, paths, recorded, 'neural', () => true).map((s) => s.id), [b.scenes[2].id]);
});

test('CLI --dry-run lists what would be narrated and with what, and needs an engine', () => {
  const dir = path.join(tmpRoot, 'story dir ');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(EXAMPLE, path.join(dir, 'storyboard.json'));
  const cli = path.join(SCRIPTS, 'narrate.js');
  const out = spawnSync(process.execPath, [cli, dir, '--engine', 'neural', '--dry-run'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const plan = JSON.parse(out.stdout);
  assert.equal(plan.engine, 'neural');
  assert.equal(plan.voice, board().voice);
  assert.equal(plan.rate, board().rate);
  assert.deepEqual(plan.scenes, board().scenes.map((s) => s.id));
  assert.ok(!fs.existsSync(path.join(dir, 'audio')));
  const noEngine = spawnSync(process.execPath, [cli, dir], { encoding: 'utf8' });
  assert.equal(noEngine.status, 1);
  assert.match(noEngine.stderr, /--engine neural\|local is required/);
});

const python = ['python3', 'python'].find((cmd) => spawnSync(cmd, ['--version']).status === 0);
test('narrate.py --dry-run plans without importing edge_tts', { skip: python ? false : 'python is not installed' }, () => {
  const out = spawnSync(python, [path.join(SCRIPTS, 'narrate.py'), EXAMPLE, path.join(tmpRoot, 'audio'), '--only', '01,03', '--dry-run'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /would narrate 01 voice=en-IN-NeerjaExpressiveNeural rate=\+6%/);
  assert.match(out.stdout, /would narrate 03 /);
  assert.ok(!/would narrate 02/.test(out.stdout));
  const bad = spawnSync(python, [path.join(SCRIPTS, 'narrate.py'), EXAMPLE, path.join(tmpRoot, 'audio'), '--only', '99', '--dry-run'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown scene id: 99/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-narrate.test.js`
Expected: FAIL with `Cannot find module '.../lib/local-voice.js'`.

- [ ] **Step 3: Write `narrate.py`**

```python
"""Narrate storyboard scenes to MP3 with Microsoft's neural voices through edge-tts.

Usage: narrate.py <storyboard.json> <audio_dir> --only 01,03 [--dry-run]

This sends the narration text to Microsoft's speech service through an unofficial
route. The skill asks for consent before it runs this script. Run it with the
Python from the story-video tools venv.
"""
import argparse
import asyncio
import json
import os
import sys

DEFAULT_VOICE = "en-IN-NeerjaExpressiveNeural"
DEFAULT_RATE = "+6%"
MAX_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2


def clean_text(text):
    return text.replace("A.I.", "AI")


async def narrate_scene(edge_tts, scene, voice, rate, out_path):
    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            await edge_tts.Communicate(clean_text(scene["narration"]), voice, rate=rate).save(out_path)
            if os.path.getsize(out_path) > 0:
                return
            last_error = "empty audio file"
        except Exception as error:  # edge-tts raises several unrelated types on network failure
            last_error = error
        print(f"retry scene {scene['id']} ({attempt}/{MAX_ATTEMPTS}): {last_error}", file=sys.stderr)
        await asyncio.sleep(RETRY_DELAY_SECONDS)
    raise SystemExit(f"error: scene {scene['id']}: narration failed after {MAX_ATTEMPTS} attempts: {last_error}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("storyboard")
    parser.add_argument("audio_dir")
    parser.add_argument("--only", required=True, help="comma-separated scene ids")
    parser.add_argument("--dry-run", action="store_true")
    options = parser.parse_args()

    with open(options.storyboard, encoding="utf-8") as handle:
        board = json.load(handle)
    voice = board.get("voice") or DEFAULT_VOICE
    rate = board.get("rate") or DEFAULT_RATE
    by_id = {scene["id"]: scene for scene in board["scenes"]}
    wanted = [item.strip() for item in options.only.split(",") if item.strip()]
    for scene_id in wanted:
        if scene_id not in by_id:
            raise SystemExit(f"error: unknown scene id: {scene_id}")

    if options.dry_run:
        for scene_id in wanted:
            print(f"would narrate {scene_id} voice={voice} rate={rate}")
        return

    import edge_tts  # imported late so --dry-run works without the package

    os.makedirs(options.audio_dir, exist_ok=True)
    for scene_id in wanted:
        out_path = os.path.join(options.audio_dir, f"scene-{scene_id}.mp3")
        await narrate_scene(edge_tts, by_id[scene_id], voice, rate, out_path)
        print(f"narrated {scene_id}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 4: Implement `lib/local-voice.js` and `narrate.js`**

Rules:

- `localVoicePlan`: exactly the three shapes in the test. The PowerShell command is one string: `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('<raw>.wav'); $s.Speak([System.IO.File]::ReadAllText('<textFile>')); $s.Dispose()` with every single quote inside a path doubled. Unknown platforms return `null`.
- `toMp3Args` as in the test.
- `cleanText` replaces every `A.I.` with `AI`.
- `staleScenes(storyboard, paths, manifest, engine, exists = fs.existsSync)`: scenes for which `isFresh(manifest, 'audio:<id>', inputs.audio(scene, storyboard, engine), sceneFile(paths.audio, id, 'mp3'), exists)` is false.
- CLI: `--engine` must be `neural` or `local`, else `error: --engine neural|local is required` and exit 1. `--dry-run` prints `JSON.stringify({ engine, voice, rate, scenes: [stale ids] })` and writes nothing. Real run, `neural`: require `venvPython(toolsDir())` to exist (`error: edge-tts is not installed; run setup.js first`), spawn it with `[narrate.py, storyboard, audioDir, '--only', ids.join(',')]` and `stdio: ['ignore', 'pipe', 'inherit']`; for every `narrated <id>` line on stdout `record` that scene and save the manifest, so finished scenes survive a later failure; a non-zero exit exits 1 after saving. Real run, `local`: `localVoicePlan` for `process.platform` (`error: no local voice on this platform`), require ffmpeg from the tools folder; per scene write the cleaned narration to `.build/narration-<id>.txt`, run the voice command with `spawnSync`, convert with ffmpeg, delete the raw file and the text file, `record`, save. A missing voice binary (`ENOENT`) prints `error: <cmd> is not installed` and exits 1. Print `narrated <id>` per scene and `fresh: <n> scenes` for the skipped count.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/story-video-narrate.test.js`
Expected: `pass 5`, `fail 0` (the Python test may report as skipped where Python is absent).

- [ ] **Step 6: Commit**

```bash
git add skills/story-video/scripts/lib/local-voice.js skills/story-video/scripts/narrate.js skills/story-video/scripts/narrate.py tests/story-video-narrate.test.js
git commit -m "story-video: add neural and local narration with incremental reruns"
```

---

### Task 10: `SKILL.md` and the layout reference

**Files:**
- Create: `skills/story-video/SKILL.md`, `skills/story-video/templates/layouts.md`
- Test: `tests/story-video-skill.test.js`

**Interfaces:**
- Consumes: the CLIs from earlier tasks, all taking the story directory: `setup.js [--check]`, `validate-storyboard.js <storyDir>`, `render-slides.js <storyDir>`, `render-frames.js <storyDir>`, `build-video.js contact-sheet <storyDir>`, `narrate.js <storyDir> --engine neural|local`, `build-video.js build <storyDir>`. Layout names and slot shapes from `skills/story-video/scripts/layouts/*.js`; pictogram names from `skills/story-video/scripts/pictograms.js`.
- Produces: the skill invoked as `/opm:story-video <path>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/story-video-skill.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/story-video-skill.test.js`
Expected: FAIL with `ENOENT` on `SKILL.md`.

- [ ] **Step 3: Write `SKILL.md`**

Create `skills/story-video/SKILL.md` with exactly this content:

````markdown
---
name: story-video
description: Turns a spec or document into a narrated explainer video. Produces a 1920x1080 MP4 of illustrated still slides with a neural voice-over and a sidecar .srt; it is a narrated slideshow with fades, not animation. Slides come from a script-rendered layout kit so the run is cheap and repeatable on macOS, Linux and Windows. Use when the developer runs /opm:story-video <path>, asks for an explainer or walkthrough video of a spec, brew-idea result, milestone summary or other document, or wants to rebuild such a video after an edit.
argument-hint: <path to spec or document>
disable-model-invocation: true
---

# Story-video

One document in, a narrated explainer out. The developer is involved at three
points: the length, the storyboard with audio consent, and the finished video.
Everything between is scripts.

**Announce at start:** "Using opm:story-video; this makes a narrated slideshow, not animation."

Invocation text is in `$ARGUMENTS`. Scripts live next to this file in
`${CLAUDE_PLUGIN_ROOT}/skills/story-video/scripts/` (written `S/` below). Every
script takes the story directory as its one argument. Layout slots and
pictogram names: `templates/layouts.md`. A complete example:
`templates/storyboard.example.json`.

## Gates

| Gate | Passes only when |
|---|---|
| G1 Source | The path exists, is readable text, and can support about 270 words of narration (a 2 minute video) |
| G2 Storyboard and audio | `validate-storyboard.js` prints `ok:` AND the developer chose a build option on the latest storyboard |
| G3 Video | The developer chose "Approve" on the latest build, not an earlier one |

Never skip a gate. Silence or "sounds good" does not pass one.

## Phase 0: parse and check tools

1. The source path is all of `$ARGUMENTS`. Resolve it to an absolute path. It may contain spaces, even a trailing space in a directory name; always pass paths as separate arguments.
2. `slug`: the source file name without a leading date and without its extension, in kebab-case. Story directory: `docs/story/<slug>/` in the current project.
3. Run `node S/setup.js --check`. `browser: null` stops the run: name the browsers looked for (Chrome, Chromium, Edge, Brave) and the `CHROME_PATH` override. `python: null` means only the local voice can be offered at G2; say so now.

## Phase 1: read and size

Read the source. Propose a length and ask once with AskUserQuestion: 2, 4 or 6
minutes, default 4. The measured pace is 134 words per minute including pauses.

| Target | Narration words | Scenes |
|---|---|---|
| 2 min | about 270 | about 5 |
| 4 min | about 540 | about 9 |
| 6 min | about 800 | about 14 |

If the source cannot support 270 words without padding, stop at G1 and say how
much it could support.

## Phase 2: storyboard

Write `docs/story/<slug>/storyboard.json` yourself, in the main thread, in the
shape of `templates/storyboard.example.json`. Then run
`node S/validate-storyboard.js <storyDir>` and fix every error.

Rules for the author:
- Every fact in narration, headings and slots comes from the source. Each scene's `source` names the section. Invent nothing.
- Anything the source describes as not built yet gets `planned: true`.
- Narration is never repeated on the slide. The voice carries the words; the slide carries the picture.
- Write "AI", not "A.I.".
- Declare one `protagonist` at the top level and use that name in every scene that shows a person.
- Pick a kit layout for every scene you can. Use `custom` only when no layout can carry the point, and say why in `visual`.
- `voice` and `rate` are optional. Suggest a voice that fits the source's language and locale; write the narration in that language. Do not translate the source.

## Phase 3: approve the storyboard, consent to audio (G2)

Show: the title, each scene's id, layout and heading, the narration word count
and estimated length from the validator, which scenes are `planned`, and every
person's name that appears in the storyboard. If a named person is real, say
so, and make sure `note` does not describe them as made up.

Ask one question with AskUserQuestion:

- **Build with the neural voice.** The narration text is sent to Microsoft's speech service through edge-tts, an unofficial route with no licence or uptime guarantee. Fine for internal use. For client-facing or public videos the licensed route is Azure AI Speech, which this skill does not implement.
- **Build with the local OS voice.** Nothing leaves the machine. It sounds noticeably robotic.
- **Change the storyboard.** Free text. Revise, re-validate, ask again.

Ask once per run. Rebuilds after G3 feedback reuse the answer. Offer the
neural option only when Python was found in Phase 0.

## Phase 4: build

Run in order. Every step is incremental: unchanged scenes are skipped.

1. `node S/setup.js` installs ffmpeg, ffprobe and edge-tts into the tools folder. First run takes about a minute.
2. `node S/render-slides.js <storyDir>` writes `slides/`. It ends with `custom scenes to draw: <ids>`.
3. If that list is not `none`, dispatch one agent for all of them:

```
Agent (subagent_type: general-purpose, model: opus)
description: "Draw custom story-video slides"
prompt: |
  Draw slides for scenes <ids> of <abs storyDir>/storyboard.json. For each,
  write <abs storyDir>/slides/scene-<id>.html. Copy the whole document from
  <abs storyDir>/slides/scene-<a kit scene id>.html and change only the
  heading, sub line, chip, counter and the contents of the
  <svg viewBox="0 0 1740 530"> stage. Draw what the scene's `visual` field
  describes. Rules: nothing on the stage under 30px; stay inside the 1740x530
  stage; do not put the narration on the slide; draw the protagonist the same
  way the kit's `person` pictogram does; use only the colours in slides.css.
  Do not edit slides.css, do not take screenshots, do not dispatch subagents.
  Report: files written.
```

4. `node S/render-frames.js <storyDir>` writes one 1920x1080 PNG per slide.
5. `node S/build-video.js contact-sheet <storyDir>` writes `.build/contact-sheet.png`. Read that one image. Open a full frame from `frames/` only when a tile looks wrong. Fix the storyboard slot or the custom slide, then rerun from step 2.
6. `node S/narrate.js <storyDir> --engine neural` or `--engine local`, as chosen at G2.
7. `node S/build-video.js build <storyDir>` writes `<slug>.mp4` and `<slug>.srt`.

## Phase 5: approve the video (G3)

Open the MP4: `open` on macOS, `xdg-open` on Linux, `start ""` on Windows.
Report its length, size and scene count. Ask: "Approve" or "Request changes"
(free text). On changes: edit the storyboard or a custom slide, re-validate,
and rerun Phase 4 from step 2. Do not work out what changed; the scripts do.
Every rebuild gets its own approval question.

## Phase 6: finish

Commit `storyboard.json`, `slides/`, `<slug>.srt`, `<slug>.mp4` and `.gitignore`
as `docs(story): <slug> explainer video`. Frames, audio and segments are
ignored by the `.gitignore` the skill wrote. Report the MP4 path, length, size,
the voice used, and that an edit is rebuilt by rerunning Phase 4.

## Errors

| Situation | Do |
|---|---|
| Source missing, not text, or too thin | Stop at G1 and say which |
| No Chromium-family browser | Stop; name the browsers looked for and `CHROME_PATH` |
| No Python 3 | Continue; offer only the local voice at G2 and say why |
| `setup.js` fails (offline, npm or pip error) | Stop; show the failing command's last lines |
| Validator errors | Fix them all before G2; never build around one |
| `narrate.js` fails after 3 attempts on a scene | Finished scenes are kept. Offer a retry or the local voice |
| No local voice (`espeak-ng` missing on Linux) | Say so; do not install it |
| A frame is not 1920x1080 or never appears | Stop naming the scene; the slide file stays for inspection |
| Missing frame or audio at build | `build-video.js` names the scene before encoding; rerun the step that makes it |
| Custom-slide agent fails | Kit scenes are still built. Offer a retry or switch that scene to a kit layout |

## Red flags

| Thought | Reality |
|---|---|
| "I'll draw every slide myself, the kit looks generic" | That cost 190k tokens once. Use a layout; `custom` is for the scene that truly needs it. |
| "I'll look at every frame to be safe" | Read the contact sheet once. Open a frame only when a tile looks wrong. |
| "This fact makes the story better" | If it is not in the source, it is not in the video. |
| "It's planned but basically decided" | Planned is labelled planned. |
| "They agreed to the neural voice last time" | Consent is per run. Ask at G2. |
| "The name is obviously fictional" | List the names and let the developer say. Keep `note` truthful. |
| "ffmpeg is missing, I'll install it with the system package manager" | Tools go in the tools folder through `setup.js`. Never touch the system. |
| "I'll put the narration on the slide so it's clear" | The validator rejects it, and it reads badly on video. |
| "Small edit, I'll work out which files to rebuild" | Rerun the same commands. The manifest rebuilds only what changed. |

## Safety

- Narration text leaves the machine only after consent at G2, and only to Microsoft's speech endpoint.
- Nothing is installed outside `~/.opm/story-video-tools/` (`OPM_STORY_TOOLS` overrides). No PATH changes, no global packages. Deleting that folder is a full uninstall.
- The skill writes only under `docs/story/<slug>/` and commits only at Phase 6.
- Real people are surfaced at G2. `note` must not describe a real person as made up.
````

- [ ] **Step 4: Write `templates/layouts.md`**

Read every file in `skills/story-video/scripts/layouts/` and `skills/story-video/scripts/pictograms.js`, then write the reference from the code, not from memory. Structure: a two-line introduction (what `slots` is, the 30px rule is enforced by the kit); one `## <layout>` section per registered layout, in alphabetical order, each with one sentence on when to use it, its slot shape as a JSON example copied from the module's `example`, and the limits from its `slotSchema` (item counts, enum values); a `## custom` section (when to use it, `visual` is required, one agent draws it); and a `## Pictograms` section listing every name from `pictograms.names()` in backticks on one wrapped line.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/story-video-skill.test.js`
Expected: `pass 2`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add skills/story-video/SKILL.md skills/story-video/templates/layouts.md tests/story-video-skill.test.js
git commit -m "story-video: add SKILL.md and layout reference"
```

---

### Task 11: Pointers, README, CHANGELOG and version 0.4.0

**Files:**
- Modify: `skills/using-opm/SKILL.md:33`, `skills/brew-idea/SKILL.md` (Phase 5 list), `skills/jump-start/SKILL.md:159` (Phase 9 list), `skills/milestone-planning/SKILL.md:246` (close the milestone), `README.md` (skill table, a usage section, both skill counts, layout block), `CHANGELOG.md:1-3`, `.claude-plugin/plugin.json:4`, `.claude-plugin/marketplace.json:15`
- Modify: `tests/manifest.test.js` (one new test)

**Interfaces:**
- Consumes: the command `/opm:story-video <path>`.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

Append to `tests/manifest.test.js`:

```js
test('story-video is pointed to, never copied, by the skills that can feed it', () => {
  const pointer = 'Optional: `/opm:story-video <path>` turns this into a narrated explainer.';
  for (const skill of ['brew-idea', 'jump-start', 'milestone-planning']) {
    const text = fs.readFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8');
    assert.ok(text.includes(pointer), `${skill} does not carry the pointer line`);
    assert.equal(text.split('story-video').length - 1, 1, `${skill} must mention story-video exactly once`);
  }
  const usingOpm = fs.readFileSync(path.join(ROOT, 'skills', 'using-opm', 'SKILL.md'), 'utf8');
  assert.ok(usingOpm.includes('opm:story-video'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/manifest.test.js`
Expected: the new test FAILS with `brew-idea does not carry the pointer line`, and the existing README test FAILS with `README does not list story-video`.

- [ ] **Step 3: Add the pointers**

The pointer sentence is exactly: ``Optional: `/opm:story-video <path>` turns this into a narrated explainer.``

- `skills/brew-idea/SKILL.md`, Phase 5, after the `opm:jump-start` bullet, add a bullet: `- ` + the pointer sentence.
- `skills/jump-start/SKILL.md`, Phase 9, after step 3, add `4. ` + the pointer sentence.
- `skills/milestone-planning/SKILL.md`, at the end of the "Close the milestone" step's paragraph, add the pointer sentence as its own sentence.
- `skills/using-opm/SKILL.md`, after the `opm:brew-idea` line, add: ``Explainer video of a spec or document: `opm:story-video <path>` makes a narrated slideshow (MP4) from it.``

- [ ] **Step 4: README**

- Line 33: `All 14 skills` becomes `All 15 skills`. Layout block: `14 skills` becomes `15 skills`.
- In the "Bigger scope" table, after the `jump-start` row, add:

```markdown
| `story-video` | A spec or document becomes a narrated explainer video: illustrated still slides from a layout kit, a neural voice-over, MP4 plus `.srt`. A narrated slideshow, not animation. macOS, Linux and Windows. |
```

- After the `/opm:brew-idea` usage paragraph, add:

````markdown
`/opm:story-video <path>` turns a spec, a brew-idea result or any document into a
narrated explainer:

```
/opm:story-video docs/specs/2026-09-17-influencer-platform-brew.md
```

You pick a length (2, 4 or 6 minutes) and approve the storyboard. Slides are
rendered by script from nine layouts, so a typical video costs under 20k tokens
instead of the 190k a hand-drawn one took. Narration uses Microsoft's neural
voices through edge-tts after you consent, or a local voice with nothing
leaving the machine. ffmpeg and edge-tts are installed into
`~/.opm/story-video-tools/`, never system-wide. Needs Node 18+, a
Chromium-family browser, and Python 3 for the neural voice.
````

- [ ] **Step 5: CHANGELOG and version**

Insert above the current first version heading in `CHANGELOG.md`:

```markdown
## 0.4.0 - 2026-09-21

- New skill `opm:story-video <path>`: a spec or document becomes a narrated explainer video (1920x1080 MP4 plus `.srt`). A narrated slideshow with fades, not animation. The main thread writes `storyboard.json`; scripts do the rest: nine script-rendered slide layouts and 24 pictograms, headless-browser frames, edge-tts or local-voice narration, ffmpeg encoding, a contact sheet for one-look review, and a per-scene hash manifest so edits rebuild only what changed. Works on macOS, Linux and Windows; tools install into `~/.opm/story-video-tools/`.
- Gates for length, storyboard plus audio consent, and the final video. Sourcing and planned-feature labelling are fields the validator checks.
- `brew-idea`, `jump-start`, `milestone-planning` and `using-opm` carry a one-line pointer to it. They hold none of its rules.
- Tests: nine `story-video-*` test files covering the libraries, kit, layouts, validator, slide rendering, frame rendering, encoding arguments, narration planning and the skill documents. None needs a network, a browser, ffmpeg or audio.

```

Change `"version": "0.3.0"` to `"version": "0.4.0"` in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.

- [ ] **Step 6: Run the whole suite**

Run: `node --test tests/*.test.js`
Expected: `fail 0`. Also run `claude plugin validate .` and expect `Validation passed`.

- [ ] **Step 7: Commit**

```bash
git add skills/using-opm/SKILL.md skills/brew-idea/SKILL.md skills/jump-start/SKILL.md skills/milestone-planning/SKILL.md README.md CHANGELOG.md .claude-plugin/plugin.json .claude-plugin/marketplace.json tests/manifest.test.js
git commit -m "Document story-video, add pointers and bump plugin to 0.4.0"
```
