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
