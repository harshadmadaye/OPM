'use strict';
// review-pack.js ranks a phase's commits by risk so a developer can read the riskiest
// five in 20 to 30 minutes. Builds a throwaway git repo in os.tmpdir().
// Run with: node --test tests/review-pack.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'skills/milestone-planning/scripts/review-pack.js');

let repo;
let base;
const shas = {};

function git(...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function commit(key, files, message, removals = []) {
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(repo, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  for (const file of removals) git('rm', '-q', file);
  git('add', '-A');
  git('commit', '-q', '-m', message);
  shas[key] = git('rev-parse', 'HEAD');
}

test.before(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'review-pack-'));
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  commit('seed', { 'README.md': '# demo\n', 'src/old.js': 'module.exports = 1;\n' }, 'chore: seed');
  base = shas.seed;
  commit('auth', { 'src/auth/middleware.js': 'function checkPermission(user) { return user.role === "admin"; }\n' }, 'feat: auth middleware');
  commit('migration', { 'db/migrations/001_add_users.sql': 'ALTER TABLE users ADD COLUMN email text;\n' }, 'feat: add users migration');
  commit('readme', { 'README.md': '# demo\n\nMore words.\n' }, 'docs: readme tweak');
  commit('payment', { 'src/payments/webhook.js': 'const res = await fetch("https://api.stripe.com/v1/charges");\n' }, 'feat: payment webhook');
  commit('delete', {}, 'refactor: drop old module', ['src/old.js']);
  commit('tests', { 'tests/thing.test.js': 'test("x", () => {});\n' }, 'test: add thing test');
});

test.after(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

const { rank } = require(SCRIPT);

function run(...args) {
  return spawnSync('node', [SCRIPT, ...args], { cwd: repo, encoding: 'utf8' });
}

test('A: rank puts auth, migration, payment and deletion above README and tests', () => {
  const order = rank(`${base}..HEAD`, { cwd: repo }).map((item) => item.sha);
  for (const risky of ['auth', 'migration', 'payment', 'delete']) {
    assert.ok(order.includes(shas[risky]), `${risky} should be ranked`);
  }
  for (const quiet of ['readme', 'tests']) {
    assert.ok(!order.includes(shas[quiet]), `${quiet} has no risk and should not be padded in`);
  }
});

test('B: each item shows git show sha7, files and categories', () => {
  const out = run(`${base}..HEAD`).stdout;
  assert.match(out, new RegExp(`git show ${shas.auth.slice(0, 7)}`));
  assert.match(out, /src\/auth\/middleware\.js/);
  assert.match(out, /categories: .*auth/i);
  assert.match(out, /categories: .*migrations/i);
  assert.match(out, /categories: .*payments/i);
  assert.match(out, /categories: .*data deletion/i);
  assert.match(out, /Questions:/);
});

test('C: --max 3 limits output to three items', () => {
  const out = run(`${base}..HEAD`, '--max', '3').stdout;
  assert.equal((out.match(/^## \d+\. /gm) || []).length, 3);
});

test('D: default shows at most five items', () => {
  const out = run(`${base}..HEAD`).stdout;
  assert.ok((out.match(/^## \d+\. /gm) || []).length <= 5);
});

test('E: a range with no risky commits says so instead of padding', () => {
  const out = run(`${shas.delete}..HEAD`);
  assert.equal(out.status, 0);
  assert.match(out.stdout, /no risky commits/i);
  assert.equal((out.stdout.match(/^## \d+\. /gm) || []).length, 0);
});

test('F: a bad range exits 1 with a clear message', () => {
  for (const bad of ['nonsense..HEAD', 'no-dots', '--oops', '$(touch x)..HEAD']) {
    const result = run(bad);
    assert.equal(result.status, 1, `${bad} should exit 1`);
    assert.match(result.stderr, /review-pack: /);
  }
  const noArg = run();
  assert.equal(noArg.status, 1);
  assert.equal(run(`${base}..HEAD`, '--max', 'abc').status, 1);
});

const fsRead = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\s+/g, ' ');

test('G: review-pack template has the Phase 1 pack shape', () => {
  const file = 'skills/milestone-planning/templates/review-pack.md';
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`);
  const text = fsRead(file);
  assert.match(text, /20 to 30 minutes/);
  assert.match(text, /explain how/i);
  assert.match(text, /\| Severity \| Found \| Fixed \| Parked \| Dismissed \|/);
  assert.match(text, /Things that went differently than planned/);
});

test('H: phase close in both skills writes REVIEW-PACK.md with review-pack.js', () => {
  for (const file of [
    'skills/milestone-planning/SKILL.md',
    'skills/milestone-planning/references/executing-a-phase.md',
    'skills/jump-start/references/build-and-run.md',
  ]) {
    assert.match(fsRead(file), /REVIEW-PACK\.md/, `${file} must mention REVIEW-PACK.md`);
  }
  for (const file of [
    'skills/milestone-planning/references/executing-a-phase.md',
    'skills/jump-start/references/build-and-run.md',
  ]) {
    assert.match(fsRead(file), /review-pack\.js/, `${file} must name the script`);
  }
  assert.match(
    fsRead('skills/milestone-planning/references/executing-a-phase.md'),
    /wait for the developer to say they read it/i,
  );
});
