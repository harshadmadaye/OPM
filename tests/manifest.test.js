'use strict';
// Plugin manifest checks. Run with: node --test tests/manifest.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

test('plugin.json and marketplace.json carry the same version and it heads the changelog', () => {
  const plugin = read('.claude-plugin/plugin.json');
  const marketplace = read('.claude-plugin/marketplace.json');
  for (const entry of marketplace.plugins) assert.equal(entry.version, plugin.version, `${entry.name} is not on the core version`);
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const first = changelog.match(/^## (\S+) - \d{4}-\d{2}-\d{2}$/m);
  assert.ok(first, 'changelog has no version heading');
  assert.equal(first[1], plugin.version);
});

test('the marketplace lists core and the optional opm-video and opm-design plugins, and only opm-video ships explainer-video', () => {
  const marketplace = read('.claude-plugin/marketplace.json');
  assert.deepEqual(marketplace.plugins.map((p) => [p.name, p.source]), [
    ['opm', './'],
    ['opm-video', './plugins/opm-video'],
    ['opm-design', './plugins/opm-design'],
  ]);
  const video = read('plugins/opm-video/.claude-plugin/plugin.json');
  assert.equal(video.name, 'opm-video');
  assert.equal(video.version, read('.claude-plugin/plugin.json').version);
  assert.match(video.description, /Microsoft cloud/, 'opm-video must disclose the cloud text-to-speech route');
  assert.ok(fs.existsSync(path.join(ROOT, 'plugins', 'opm-video', 'skills', 'explainer-video', 'SKILL.md')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'skills', 'explainer-video')), 'core must not register explainer-video');
});

test('opm-design is on the core version and discloses its consented download', () => {
  const design = read('plugins/opm-design/.claude-plugin/plugin.json');
  assert.equal(design.name, 'opm-design');
  assert.equal(design.version, read('.claude-plugin/plugin.json').version);
  for (const text of [design.description, read('.claude-plugin/marketplace.json').plugins.find((p) => p.name === 'opm-design').description]) {
    assert.match(text, /asks before/, 'opm-design must say it asks before downloading');
    assert.match(text, /150 MB/, 'opm-design must state the download size');
    assert.match(text, /~\/\.opm\/design-tools/, 'opm-design must name the install folder');
  }
  for (const core of ['frontend-design', 'design-system', 'ux-flows']) {
    assert.ok(!fs.existsSync(path.join(ROOT, 'skills', core)), `core must not register ${core}`);
  }
});

test('every skill directory is listed in the README and using-opm names brew-idea', () => {
  const skills = fs.readdirSync(path.join(ROOT, 'skills')).filter((d) => fs.existsSync(path.join(ROOT, 'skills', d, 'SKILL.md')));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  for (const s of skills) assert.ok(readme.includes(`\`${s}\``), `README does not list ${s}`);
  assert.ok(readme.includes(`All ${skills.length} skills`), `README heading does not say All ${skills.length} skills`);
  assert.ok(readme.includes(`${skills.length} skills (SKILL.md`), `README layout count is not ${skills.length}`);
  const usingOpm = fs.readFileSync(path.join(ROOT, 'skills', 'using-opm', 'SKILL.md'), 'utf8');
  assert.ok(usingOpm.includes('opm:brew-idea'), 'using-opm workflow map does not mention brew-idea');
});

test('explainer-video is pointed to, never copied, by the skills that can feed it', () => {
  const pointer = 'Optional: `/opm-video:explainer-video <path>` turns this into a narrated explainer (install the opm-video plugin first).';
  for (const skill of ['brew-idea', 'jump-start', 'milestone-planning']) {
    const text = fs.readFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8');
    assert.ok(text.includes(pointer), `${skill} does not carry the pointer line`);
    assert.equal(text.split('explainer-video').length - 1, 1, `${skill} must mention explainer-video exactly once`);
  }
  const usingOpm = fs.readFileSync(path.join(ROOT, 'skills', 'using-opm', 'SKILL.md'), 'utf8');
  assert.ok(usingOpm.includes(pointer), 'using-opm does not carry the pointer line');
});

test('package.json declares the tested Claude Code range and a modsMin no newer than its upper bound', () => {
  const declared = read('package.json').opm && read('package.json').opm.claudeCode;
  assert.ok(declared, 'package.json has no opm.claudeCode');
  const semver = /^\d+\.\d+\.\d+$/;
  const [low, high] = String(declared.tested).split(' - ');
  assert.match(low, semver, 'tested range must read "<low> - <high>"');
  assert.match(high || '', semver, 'tested range must read "<low> - <high>"');
  assert.match(String(declared.modsMin), semver);
  const parts = (v) => v.split('.').map(Number);
  const compare = (a, b) => parts(a).reduce((acc, n, i) => acc || n - parts(b)[i], 0);
  assert.ok(compare(low, high) <= 0, 'range low is above its high');
  assert.ok(compare(declared.modsMin, high) <= 0, 'modsMin is above the tested upper bound');
});

test('opm-design ships its three skills and agent, and core points to it without depending on it', () => {
  const design = path.join(ROOT, 'plugins', 'opm-design');
  for (const skill of ['frontend-design', 'design-system', 'ux-flows']) {
    assert.ok(fs.existsSync(path.join(design, 'skills', skill, 'SKILL.md')), `${skill} SKILL.md missing`);
  }
  assert.ok(fs.existsSync(path.join(design, 'agents', 'design-reviewer.md')));
  assert.ok(fs.existsSync(path.join(design, 'shared', 'craft-floor.md')));
  const pointer = 'Optional: `/opm-design:frontend-design`, `/opm-design:design-system` and `/opm-design:ux-flows` for UI work (install the opm-design plugin first).';
  const usingOpm = fs.readFileSync(path.join(ROOT, 'skills', 'using-opm', 'SKILL.md'), 'utf8');
  assert.ok(usingOpm.includes(pointer), 'using-opm does not carry the opm-design pointer line');
  assert.equal(usingOpm.split('opm-design:').length - 1, 3, 'using-opm mentions opm-design only in the pointer');
  const fullLoop = fs.readFileSync(path.join(ROOT, 'skills', 'verification-before-completion', 'references', 'full-loop.md'), 'utf8');
  assert.match(fullLoop, /opm-design.*visual-qa\.json.*design-reviewer/);
});

test('the README and the notices cover opm-design', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(readme.includes('claude plugin install opm-design@opm'));
  assert.ok(readme.includes('### 🎨 `opm-design`'));
  assert.match(readme, /plugins\/ +opm-video and opm-design/);
  const notices = fs.readFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.match(notices, /## opm-design sources/);
  assert.match(notices, /Apache-2\.0/);
});
