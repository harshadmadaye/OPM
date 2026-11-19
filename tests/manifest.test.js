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

test('the marketplace lists only the opm plugin, and core ships the design and video skills', () => {
  const marketplace = read('.claude-plugin/marketplace.json');
  assert.deepEqual(marketplace.plugins.map((p) => [p.name, p.source]), [['opm', './']]);
  assert.ok(!fs.existsSync(path.join(ROOT, 'plugins')), 'there are no add-on plugins');
  for (const skill of ['explainer-video', 'frontend-design', 'design-system', 'ux-flows']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'skills', skill, 'SKILL.md')), `${skill} SKILL.md missing`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'agents', 'design-reviewer.md')));
  assert.ok(fs.existsSync(path.join(ROOT, 'shared', 'craft-floor.md')));
});

test('the plugin and marketplace descriptions disclose the cloud voice and the consented download', () => {
  const descriptions = [read('.claude-plugin/plugin.json').description, read('.claude-plugin/marketplace.json').plugins[0].description];
  for (const text of descriptions) {
    assert.match(text, /Microsoft cloud/, 'must disclose the cloud text-to-speech route');
    assert.match(text, /asks before/, 'must say visual QA asks before downloading');
    assert.match(text, /150 MB/, 'must state the download size');
    assert.match(text, /~\/\.opm\/design-tools/, 'must name the install folder');
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
  const pointer = 'Optional: `/opm:explainer-video <path>` turns this into a narrated explainer.';
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

test('using-opm points to the design skills and full-loop asks for their evidence', () => {
  const pointer = 'Optional: `/opm:frontend-design`, `/opm:design-system` and `/opm:ux-flows` for UI work.';
  const usingOpm = fs.readFileSync(path.join(ROOT, 'skills', 'using-opm', 'SKILL.md'), 'utf8');
  assert.ok(usingOpm.includes(pointer), 'using-opm does not carry the design pointer line');
  const fullLoop = fs.readFileSync(path.join(ROOT, 'skills', 'verification-before-completion', 'references', 'full-loop.md'), 'utf8');
  assert.match(fullLoop, /design skills.*visual-qa\.json.*design-reviewer/);
});

test('the README and the notices cover the design skills', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(!readme.includes('opm-design'), 'README still names the old opm-design plugin');
  assert.ok(!readme.includes('opm-video'), 'README still names the old opm-video plugin');
  const notices = fs.readFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.match(notices, /## Design skills sources/);
  assert.match(notices, /Apache-2\.0/);
});
