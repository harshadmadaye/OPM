'use strict';
// Tests for the npx installer's pure logic. Run with: node --test tests/installer.test.js
// Nothing here spawns Claude Code, reaches the network, or touches a real repo.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN = path.resolve(__dirname, '..', 'bin', 'install.js');
const { parseArgs, currentMarketplaceSource, installRules, LANGUAGES } = require(BIN);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-installer-'));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

test('parseArgs: defaults, flags, target and language validation', () => {
  const d = parseArgs([]);
  assert.equal(d.plugin, true);
  assert.equal(d.rules, null, 'null means "ask", which is different from an empty list');
  assert.equal(d.target, process.cwd());

  assert.deepEqual(parseArgs(['--rules', 'typescript,react']).rules, ['typescript', 'react']);
  assert.deepEqual(parseArgs(['--rules', ' python , dart ']).rules, ['python', 'dart']);
  assert.deepEqual(parseArgs(['--plugin-only']).rules, []);

  const rulesOnly = parseArgs(['--rules-only']);
  assert.equal(rulesOnly.plugin, false);
  assert.equal(rulesOnly.rulesOnly, true);

  assert.equal(parseArgs(['--no-plugin']).plugin, false);
  assert.equal(parseArgs(['-y']).yes, true);
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['/some/repo']).target, path.resolve('/some/repo'));

  assert.throws(() => parseArgs(['--rules', 'cobol']), /unknown language: cobol/);
  assert.throws(() => parseArgs(['--rules']), /--rules needs a comma-separated list/);
  assert.throws(() => parseArgs(['--wat']), /unknown option: --wat/);
});

test('currentMarketplaceSource finds the opm entry and ignores the others', () => {
  const listing = [
    'Configured marketplaces:',
    '',
    '  ❯ claude-plugins-official',
    '    Source: GitHub (anthropics/claude-plugins-official)',
    '',
    '  ❯ opm',
    '    Source: GitHub (fe-techTeam/OPM)',
    '',
    '  ❯ firebase',
    '    Source: GitHub (firebase/agent-skills)',
  ].join('\n');
  assert.equal(currentMarketplaceSource(listing), 'fe-techTeam/OPM');

  const current = listing.replace('fe-techTeam/OPM', 'harshadmadaye/OPM');
  assert.equal(currentMarketplaceSource(current), 'harshadmadaye/OPM');

  const without = listing.replace('  ❯ opm\n    Source: GitHub (fe-techTeam/OPM)\n\n', '');
  assert.equal(currentMarketplaceSource(without), null);
  assert.equal(currentMarketplaceSource('Configured marketplaces:\n'), null);
});

test('installRules copies common plus the chosen languages, and nothing else', () => {
  const rulesRoot = path.join(tmpRoot, 'rules');
  for (const [dir, file] of [['common', 'a.md'], ['typescript', 'b.md'], ['python', 'c.md']]) {
    fs.mkdirSync(path.join(rulesRoot, dir), { recursive: true });
    fs.writeFileSync(path.join(rulesRoot, dir, file), `# ${dir}\n`);
  }
  fs.mkdirSync(path.join(rulesRoot, 'typescript', 'nested'), { recursive: true });
  fs.writeFileSync(path.join(rulesRoot, 'typescript', 'nested', 'deep.md'), '# deep\n');

  const target = path.join(tmpRoot, 'repo with a space');
  fs.mkdirSync(target, { recursive: true });
  const count = installRules(target, ['typescript'], rulesRoot, () => {});

  const dest = path.join(target, '.claude', 'rules', 'opm');
  assert.equal(count, 3, 'common/a.md, typescript/b.md and the nested file');
  assert.ok(fs.existsSync(path.join(dest, 'common', 'a.md')));
  assert.ok(fs.existsSync(path.join(dest, 'typescript', 'nested', 'deep.md')));
  assert.ok(!fs.existsSync(path.join(dest, 'python')), 'a language that was not asked for is not copied');

  assert.throws(() => installRules(path.join(tmpRoot, 'nope'), [], rulesRoot, () => {}), /target is not a directory/);
});

test('the real rules directory has a folder for every advertised language', () => {
  const rulesRoot = path.resolve(__dirname, '..', 'rules');
  for (const lang of [...LANGUAGES, 'common']) {
    assert.ok(fs.existsSync(path.join(rulesRoot, lang)), `rules/${lang} is missing`);
  }
});

test('the CLI prints usage and exits 0, without touching Claude Code', () => {
  const out = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /npx opm-core@latest/);
  for (const lang of LANGUAGES) assert.ok(out.stdout.includes(lang), `usage should list ${lang}`);
});

test('a bad option exits 1 with one clear line and no stack trace', () => {
  const out = spawnSync(process.execPath, [BIN, '--nope'], { encoding: 'utf8' });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /^error: unknown option: --nope$/m);
  assert.ok(!out.stderr.includes('at Object.'), 'no stack trace');
});

test('package.json ships the installer and the rules, and matches the plugin version', () => {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const plugin = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(pkg.version, plugin.version, 'npm and plugin versions must move together');
  assert.equal(pkg.bin['opm-core'], 'bin/install.js');
  for (const needed of ['bin/', 'rules/']) assert.ok(pkg.files.includes(needed), `files must include ${needed}`);
  assert.ok(!pkg.dependencies, 'the installer stays dependency-free');
});
