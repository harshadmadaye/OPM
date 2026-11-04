'use strict';
// Screen inventory checks. Run with: node --test tests/design-check-flows.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = path.resolve(__dirname, '..', 'plugins', 'opm-design', 'skills', 'ux-flows', 'scripts', 'check-flows.mjs');
const load = () => import(pathToFileURL(SCRIPT).href);

const table = (rows) => [
  '# Flows', '', '## Screen inventory', '',
  '| Screen | Use cases | Key elements | Outgoing links |',
  '|---|---|---|---|',
  ...rows,
  '', 'After the table.',
].join('\n');

const CLEAN = table([
  '| `Cart` | UC-01 | Line items, Checkout button | Checkout, Home |',
  '| Checkout | UC-01, UC-02 | Address form, Pay button | Confirmation, Cart |',
  '| Confirmation | UC-01 | Order number | Home |',
]);

test('a clean inventory parses every row and has no violations', async () => {
  const { parseInventory, checkFlows } = await load();
  const rows = parseInventory(CLEAN);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { screen: 'Cart', useCases: ['UC-01'], outgoing: ['Checkout', 'Home'] });
  assert.deepEqual(rows[1].useCases, ['UC-01', 'UC-02']);
  assert.deepEqual(checkFlows(rows), []);
});

test('a screen with no outgoing link is a dead end', async () => {
  const { parseInventory, checkFlows } = await load();
  const rows = parseInventory(table(['| Confirmation | UC-01 | Order number | — |']));
  const violations = checkFlows(rows);
  assert.equal(violations.length, 1);
  assert.match(violations[0].rule, /dead end: screen "Confirmation" has no outgoing link/);
});

test('a screen used by no use case is an orphan', async () => {
  const { parseInventory, checkFlows } = await load();
  const violations = checkFlows(parseInventory(table(['| Legacy promo |  | Banner | Home |'])));
  assert.equal(violations.length, 1);
  assert.match(violations[0].rule, /orphan: screen "Legacy promo" is used by no use case/);
});

test('a missing or empty inventory is a violation', async () => {
  const { parseInventory, checkFlows } = await load();
  assert.equal(parseInventory('# Flows\n\nNo table here.\n'), null);
  assert.match(checkFlows(null)[0].rule, /no screen inventory table/);
  assert.match(checkFlows(parseInventory(table([])))[0].rule, /screen inventory is empty/);
});

test('the CLI exits 0 on a clean file, 1 with Violation lines, 2 without an argument', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-flows-'));
  const clean = path.join(dir, 'clean.md');
  const broken = path.join(dir, 'broken.md');
  fs.writeFileSync(clean, CLEAN);
  fs.writeFileSync(broken, table(['| Orphaned |  | x | - |']));
  const ok = spawnSync(process.execPath, [SCRIPT, clean], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /ok: 3 screens, no dead ends or orphans/);
  const fail = spawnSync(process.execPath, [SCRIPT, broken], { encoding: 'utf8' });
  assert.equal(fail.status, 1);
  assert.equal(fail.stdout.trim().split('\n').filter((l) => l.startsWith('Violation: ')).length, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2);
});
