'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'dev-server.sh');

function run(args) {
  const result = spawnSync('sh', [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }

test('dev-server.sh start, status, duplicate start, stop', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-devserver-'));
  fs.writeFileSync(path.join(project, '.gitignore'), 'node_modules/\n');
  const port = await freePort();
  const url = `http://localhost:${port}`;
  const serverCode = `require('http').createServer((q,s)=>s.end('ok')).listen(${port})`;

  const start = run(['start', '--project', project, '--name', 'web', '--url', url, '--', 'node', '-e', serverCode]);
  assert.strictEqual(start.code, 0, start.out);
  assert.match(start.out, /READY http:\/\/localhost/);
  const pid = Number(fs.readFileSync(path.join(project, '.opm', 'web.pid'), 'utf8'));
  assert.ok(pidAlive(pid), 'server pid should be alive');
  assert.match(fs.readFileSync(path.join(project, '.gitignore'), 'utf8'), /^\.opm\/$/m);

  const status = run(['status', '--project', project]);
  assert.match(status.out, /web alive pid=\d+ url=http/);

  const again = run(['start', '--project', project, '--name', 'web', '--url', url, '--', 'node', '-e', '1']);
  assert.match(again.out, /ALREADY_RUNNING/);

  const stop = run(['stop', '--project', project, '--name', 'web']);
  assert.strictEqual(stop.code, 0, stop.out);
  assert.match(stop.out, /STOPPED web/);
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(!pidAlive(pid), 'server pid should be dead after stop');
  assert.match(run(['status', '--project', project]).out, /no processes recorded/);
  fs.rmSync(project, { recursive: true, force: true });
});

test('dev-server.sh start without --url only detaches', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-devserver-'));
  const start = run(['start', '--project', project, '--name', 'mobile', '--', 'sleep', '5']);
  assert.strictEqual(start.code, 0, start.out);
  assert.match(start.out, /STARTED pid=\d+/);
  assert.doesNotMatch(start.out, /READY|TIMEOUT/);
  run(['stop', '--project', project, '--name', 'mobile']);
  fs.rmSync(project, { recursive: true, force: true });
});

test('dev-server.sh reports a process that exits before ready', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-devserver-'));
  const port = await freePort();
  const start = run(['start', '--project', project, '--name', 'web', '--url', `http://localhost:${port}`, '--', 'node', '-e', 'console.log("boom");process.exit(1)']);
  assert.strictEqual(start.code, 1);
  assert.match(start.out, /EXITED before ready/);
  fs.rmSync(project, { recursive: true, force: true });
});

test('dev-server.sh rejects missing project', () => {
  const result = run(['status', '--project', '/nonexistent/opm-project']);
  assert.strictEqual(result.code, 1);
});
