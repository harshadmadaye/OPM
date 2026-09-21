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
const { toolBinary } = require(path.join(SCRIPTS, 'lib', 'paths.js'));

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
  assert.deepEqual(mac[0], { cmd: 'npm', args: ['install', '--no-audit', '--no-fund', 'ffmpeg-static@5.3.0', 'ffprobe-static@3.1.0'], cwd: '/t', shell: false });
  assert.deepEqual(mac[1], { cmd: '/usr/bin/python3', args: ['-m', 'venv', 'venv'], cwd: '/t', shell: false });
  assert.deepEqual(mac[2], { cmd: '/t/venv/bin/python', args: ['-m', 'pip', 'install', '--quiet', 'edge-tts==7.2.8'], cwd: '/t', shell: false });
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

test('toolBinary returns null (not a throw) for a half-installed package, and setup.check reports it as not ready', () => {
  const tools = path.join(tmpRoot, 'half-tools');
  fs.mkdirSync(path.join(tools, 'node_modules', 'ffmpeg-static'), { recursive: true });
  assert.equal(toolBinary(tools, 'ffmpeg'), null);
  const report = setup.check({ env: { OPM_STORY_TOOLS: tools }, platform: process.platform });
  assert.equal(report.ffmpeg, false);
});

test('chromeArgs: fixed flags, no network, own user-data-dir, encoded file URL', () => {
  const args = frames.chromeArgs({ userDataDir: '/tmp/ud-03', pngPath: '/p/My Project /frames/scene-03.png', htmlPath: '/p/My Project /slides/scene-03.html' });
  assert.deepEqual(args.slice(0, 9), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1920,1080', '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND', '--disable-background-networking']);
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

test('CLI --dry-run prints one JSON line per storyboard slide, skipping orphans', () => {
  const dir = path.join(tmpRoot, 'story dir ');
  fs.mkdirSync(path.join(dir, 'slides'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'slides', 'slides.css'), 'body{}');
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ title: 'T', scenes: [{ id: '01' }, { id: '02' }] }));
  // scene-03 was deleted from the storyboard but its slide file stayed behind.
  for (const id of ['01', '02', '03']) fs.writeFileSync(path.join(dir, 'slides', `scene-${id}.html`), `<html>${id}</html>`);
  const out = spawnSync(process.execPath, [path.join(SCRIPTS, 'render-frames.js'), dir, '--dry-run'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const lines = out.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.scene), ['01', '02'], 'an orphan slide costs no browser launch');
  const dirs = lines.map((l) => l.args.find((a) => a.startsWith('--user-data-dir=')));
  assert.notEqual(dirs[0], dirs[1]);
  assert.ok(lines[0].args[lines[0].args.length - 1].includes('story%20dir%20/slides/scene-01.html'));
  assert.ok(!fs.existsSync(path.join(dir, 'frames')), '--dry-run writes nothing');
});
