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
  assert.equal(marketplace.plugins[0].version, plugin.version);
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const first = changelog.match(/^## (\S+) - \d{4}-\d{2}-\d{2}$/m);
  assert.ok(first, 'changelog has no version heading');
  assert.equal(first[1], plugin.version);
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
