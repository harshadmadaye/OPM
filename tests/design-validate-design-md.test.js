'use strict';
// DESIGN.md validator. Run with: node --test tests/design-validate-design-md.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = path.resolve(__dirname, '..', 'plugins', 'opm-design', 'skills', 'design-system', 'scripts', 'validate-design-md.mjs');
const load = () => import(pathToFileURL(SCRIPT).href);

const VALID = [
  '---',
  'colors:',
  '  ink:',
  '    value: "#111827"',
  '    role: text',
  '  paper:',
  '    value: "#FFFFFF"',
  '    role: surface',
  '  action:',
  '    value: "#2563EB"',
  '    role: Primary action',
  'typography:',
  '  body:',
  '    family: "Inter, system-ui, sans-serif"',
  '    size: 16px',
  'spacing:',
  '  scale: 4 8 12 16 24 32 48',
  'radius:',
  '  md: 8px',
  '---',
  '',
  '## Intent',
  'Calm and fast.',
  '',
].join('\n');

const withLine = (from, to) => VALID.replace(from, to);

test('a valid file has no violations and keeps the body', async () => {
  const { validateDesignMd, parseDesignMd } = await load();
  assert.deepEqual(validateDesignMd(VALID).violations, []);
  const { tokens, body } = parseDesignMd(VALID);
  assert.equal(tokens.colors.ink.value, '#111827');
  assert.equal(tokens.colors.action.role, 'Primary action');
  assert.match(body, /## Intent/);
});

test('a missing token group is a violation naming the group', async () => {
  const { validateDesignMd } = await load();
  const { violations } = validateDesignMd(withLine('radius:\n  md: 8px\n', ''));
  assert.equal(violations.length, 1);
  assert.match(violations[0].rule, /missing token group "radius"/);
});

test('a bad hex value is a violation naming the colour', async () => {
  const { validateDesignMd } = await load();
  const { violations } = validateDesignMd(withLine('"#2563EB"', '"#2563E"'));
  assert.ok(violations.some((v) => /colour "action" value "#2563E" is not a hex colour/.test(v.rule)));
});

test('a missing text or surface role is a violation', async () => {
  const { validateDesignMd } = await load();
  const { violations } = validateDesignMd(withLine('role: surface', 'role: background'));
  assert.ok(violations.some((v) => /no colour has role "surface"/.test(v.rule)));
});

test('a failing text/surface pair cites F-01 with the ratio', async () => {
  const { validateDesignMd } = await load();
  const { violations } = validateDesignMd(withLine('"#111827"', '"#AAAAAA"'));
  assert.equal(violations.length, 1);
  assert.match(violations[0].rule, /^F-01 text "ink" on surface "paper" is 2\.\d\d:1, under 4\.5:1$/);
});

test('malformed YAML names the line', async () => {
  const { validateDesignMd } = await load();
  const tab = validateDesignMd(withLine('  md: 8px', '\tmd: 8px'));
  assert.match(tab.violations[0].rule, /malformed frontmatter, line 19:/);
  const unquoted = validateDesignMd(withLine('"#FFFFFF"', '#FFFFFF'));
  assert.match(unquoted.violations[0].rule, /line 7: quote values that start with "#"/);
  const indent = validateDesignMd(withLine('    role: text', '      role: text'));
  assert.match(indent.violations[0].rule, /line 5: unexpected indent/);
  const noFront = validateDesignMd('# Just a heading\n');
  assert.match(noFront.violations[0].rule, /line 1: DESIGN\.md must start with a --- frontmatter line/);
});

test('formatViolation prints the one-line contract', async () => {
  const { formatViolation } = await load();
  assert.equal(formatViolation({ rule: 'missing x', fix: 'add x' }), 'Violation: missing x. Fix: add x.');
});

test('the CLI exits 0 with ok on a valid file and 1 with Violation lines otherwise', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-design-md-'));
  const good = path.join(dir, 'GOOD.md');
  const bad = path.join(dir, 'BAD.md');
  fs.writeFileSync(good, VALID);
  fs.writeFileSync(bad, withLine('"#111827"', '"#AAAAAA"'));
  const ok = spawnSync(process.execPath, [SCRIPT, good], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^ok: .*3 colours; text on surface is 17\.\d\d:1/);
  const fail = spawnSync(process.execPath, [SCRIPT, bad], { encoding: 'utf8' });
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /^Violation: F-01 .*\. Fix: darken the text or lighten the surface token\.$/m);
  const missing = spawnSync(process.execPath, [SCRIPT, path.join(dir, 'NOPE.md')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /cannot read/);
});
