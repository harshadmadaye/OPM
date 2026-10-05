'use strict';
// Guards the npm package contents. Run with: node --test tests/package-contents.test.js
// `npm pack --dry-run --json` lists exactly what `npm publish` would ship, so a
// stray file (a script, a debug log, a secret) fails here before it reaches npm.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACK_TIMEOUT_MS = 60000;
const ALLOWED_FILES = ['package.json', 'README.md', 'LICENSE'];
const ALLOWED_DIRS = ['bin/', 'rules/'];

function packedPaths() {
  // On Windows npm is npm.cmd, which Node only runs through a shell.
  const isWindows = process.platform === 'win32';
  const stdout = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: PACK_TIMEOUT_MS,
  });
  const [pack] = JSON.parse(stdout);
  return pack.files.map((file) => file.path.split(path.sep).join('/'));
}

test('npm package ships only the allowlisted files', { timeout: PACK_TIMEOUT_MS * 2 }, () => {
  const paths = packedPaths();
  const unexpected = paths.filter(
    (file) => !ALLOWED_FILES.includes(file) && !ALLOWED_DIRS.some((dir) => file.startsWith(dir)),
  );
  assert.deepEqual(unexpected, [], `files outside the allowlist would be published: ${unexpected.join(', ')}`);
  assert.ok(paths.includes('bin/install.js'), 'the installer must be in the package');
  assert.ok(paths.includes('package.json'), 'package.json must be in the package');
});
