'use strict';
// Contrast and colour distance. Run with: node --test tests/design-contrast.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = path.resolve(__dirname, '..', 'plugins', 'opm-design', 'skills', 'frontend-design', 'scripts', 'contrast.mjs');
const load = () => import(pathToFileURL(SCRIPT).href);
const close = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('known WCAG pairs', async () => {
  const { contrastRatio } = await load();
  close(contrastRatio('#000000', '#FFFFFF'), 21, 0.001);
  close(contrastRatio('#777777', '#ffffff'), 4.48, 0.01);
  close(contrastRatio('#fff', '#000'), 21, 0.001);
  close(contrastRatio('#336699', '#336699'), 1, 0.001);
});

test('passesAA uses 4.5 for body text and 3 for large text', async () => {
  const { passesAA, contrastRatio } = await load();
  const grey = contrastRatio('#777777', '#FFFFFF');
  assert.equal(passesAA(grey), false);
  assert.equal(passesAA(grey, { isLargeText: true }), true);
});

test('parseHex rejects anything that is not #RGB or #RRGGBB', async () => {
  const { parseHex, isHex } = await load();
  assert.deepEqual(parseHex('#0aF'), { r: 0, g: 170, b: 255 });
  for (const bad of ['000000', '#12345', '#GGGGGG', 'red', '', undefined]) {
    assert.equal(isHex(bad), false, String(bad));
    assert.throws(() => parseHex(bad), /not a hex colour/);
  }
});

test('deltaE76 is about 100 for black and white and under 3 for near twins', async () => {
  const { deltaE76, SAME_COLOUR_DELTA_E } = await load();
  close(deltaE76('#000000', '#FFFFFF'), 100, 0.5);
  assert.ok(deltaE76('#FF0000', '#FE0101') < SAME_COLOUR_DELTA_E);
  assert.ok(deltaE76('#FF0000', '#0000FF') > SAME_COLOUR_DELTA_E);
});

test('the CLI exits 0 on a pass, 1 on a fail and 2 on bad input', () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const pass = run('#000000', '#FFFFFF');
  assert.equal(pass.status, 0);
  assert.match(pass.stdout, /21\.00:1 PASS \(needs 4\.5:1\)/);
  const fail = run('#777777', '#FFFFFF');
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /4\.48:1 FAIL/);
  assert.equal(run('#777777', '#FFFFFF', '--large').status, 0);
  const delta = run('--delta', '#FF0000', '#FE0101');
  assert.equal(delta.status, 0);
  assert.match(delta.stdout, /same colour, merge/);
  const bad = run('red', '#FFFFFF');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /not a hex colour/);
});
