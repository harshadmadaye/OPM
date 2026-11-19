#!/usr/bin/env node
// Checks the screen inventory in a flows.md: no dead ends, no orphan screens.
// Usage: node check-flows.mjs <docs/ux-flows/<feature>/flows.md>
import fs from 'node:fs';
import { isMain } from '../../../shared/is-main.mjs';

export const INVENTORY_COLUMNS = Object.freeze(['screen', 'use cases', 'key elements', 'outgoing links']);
const EXIT = Object.freeze({ ok: 0, violations: 1, usage: 2 });
const EMPTY_CELL = /^(|-|—|none)$/i;
const SEPARATOR_CELL = /^:?-{3,}:?$/;

const isTableLine = (line) => line.trim().startsWith('|');
const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const clean = (text) => text.replace(/[`*]/g, '').trim();
const listCell = (cell = '') => (EMPTY_CELL.test(cell.trim()) ? [] : cell.split(',').map(clean).filter(Boolean));
const isInventoryHeader = (cells) => cells.length === INVENTORY_COLUMNS.length
  && cells.every((c, i) => clean(c).toLowerCase() === INVENTORY_COLUMNS[i]);

export function parseInventory(markdown) {
  const lines = markdown.split(/\r?\n/);
  const header = lines.findIndex((l) => isTableLine(l) && isInventoryHeader(splitRow(l)));
  if (header === -1) return null;
  const rows = [];
  for (const line of lines.slice(header + 1)) {
    if (!isTableLine(line)) break;
    const cells = splitRow(line);
    if (cells.every((c) => SEPARATOR_CELL.test(c))) continue;
    const [screen, useCases, , outgoing] = cells;
    rows.push({ screen: clean(screen), useCases: listCell(useCases), outgoing: listCell(outgoing) });
  }
  return rows;
}

export function checkFlows(rows) {
  if (rows === null) {
    return [{ rule: 'no screen inventory table', fix: 'add a table with the columns Screen | Use cases | Key elements | Outgoing links' }];
  }
  if (rows.length === 0) return [{ rule: 'screen inventory is empty', fix: 'add one row per screen' }];
  return rows.flatMap((row) => [
    ...(row.outgoing.length ? [] : [{ rule: `dead end: screen "${row.screen}" has no outgoing link`, fix: 'add a way out such as back, home or retry' }]),
    ...(row.useCases.length ? [] : [{ rule: `orphan: screen "${row.screen}" is used by no use case`, fix: 'name the use case that reaches it, or remove the screen' }]),
  ]);
}

function main(argv) {
  const file = argv[0];
  if (!file) {
    console.error('usage: check-flows.mjs <flows.md>');
    return EXIT.usage;
  }
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`check-flows: cannot read ${file}: ${error.message}`);
    return EXIT.usage;
  }
  const rows = parseInventory(text);
  const violations = checkFlows(rows);
  if (violations.length) {
    violations.forEach(({ rule, fix }) => console.log(`Violation: ${rule}. Fix: ${fix}.`));
    return EXIT.violations;
  }
  console.log(`ok: ${rows.length} screens, no dead ends or orphans`);
  return EXIT.ok;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
