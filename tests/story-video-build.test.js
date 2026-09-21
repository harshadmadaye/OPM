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
