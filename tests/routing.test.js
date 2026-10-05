'use strict';
// Routing table checks: the using-opm size table must agree with the trigger fixture.
// Run with: node --test tests/routing.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const USING_OPM = path.join(ROOT, 'skills', 'using-opm', 'SKILL.md');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'trigger-prompts.json');
const SKILLS_DIR = path.join(ROOT, 'skills');

const TABLE_HEADER = ['Size', 'Signal', 'Skill'];
const SIZE_CLASSES = ['spike', 'bounded', 'multi-week', 'unattended', 'contested'];
const FRONT_DOOR_SKILLS = ['tdd-workflow', 'brainstorming', 'milestone-planning', 'jump-start', 'brew-idea'];
const FIXTURE_LENGTH = 30;
const MIN_PROMPTS_PER_CLASS = 4;
const SKILL_REF = /opm:([a-z0-9-]+)/g;

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}

// Returns [{ size, signal, skill }] for the Size | Signal | Skill table, or null when absent.
function parseRoutingTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    if (!line.trim().startsWith('|')) return false;
    const cells = splitRow(line);
    return cells.length === TABLE_HEADER.length && cells.every((cell, i) => cell === TABLE_HEADER[i]);
  });
  if (headerIndex === -1) return null;
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim().startsWith('|')) break;
    const cells = splitRow(line);
    if (isSeparatorRow(cells)) continue;
    const [size, signal, skill] = cells;
    rows.push({ size: size.replace(/[*`]/g, ''), signal, skill });
  }
  return rows;
}

function skillRefs(cell) {
  return [...cell.matchAll(SKILL_REF)].map((match) => match[1]);
}

function loadTable() {
  const rows = parseRoutingTable(fs.readFileSync(USING_OPM, 'utf8'));
  assert.ok(rows, `missing routing table (| ${TABLE_HEADER.join(' | ')} |) in skills/using-opm/SKILL.md`);
  return rows;
}

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

test('fixture has 30 well-formed prompts with at least 4 per size class', () => {
  const fixture = loadFixture();
  assert.equal(fixture.length, FIXTURE_LENGTH);
  for (const entry of fixture) {
    assert.equal(typeof entry.prompt, 'string', 'prompt must be a string');
    assert.ok(entry.prompt.length > 0, 'prompt must not be empty');
    assert.ok(SIZE_CLASSES.includes(entry.sizeClass), `unknown sizeClass ${entry.sizeClass}`);
    assert.ok(FRONT_DOOR_SKILLS.includes(entry.expectedSkill), `unknown expectedSkill ${entry.expectedSkill}`);
  }
  for (const sizeClass of SIZE_CLASSES) {
    const count = fixture.filter((entry) => entry.sizeClass === sizeClass).length;
    assert.ok(count >= MIN_PROMPTS_PER_CLASS, `${sizeClass} has ${count} prompts, need ${MIN_PROMPTS_PER_CLASS}`);
  }
});

test('every fixture size class has exactly one row routing to its expected skill', () => {
  const rows = loadTable();
  const fixture = loadFixture();
  for (const sizeClass of new Set(fixture.map((entry) => entry.sizeClass))) {
    const matches = rows.filter((row) => row.size === sizeClass);
    assert.equal(matches.length, 1, `expected one routing row for ${sizeClass}, found ${matches.length}`);
    const routedTo = skillRefs(matches[0].skill)[0];
    for (const entry of fixture.filter((e) => e.sizeClass === sizeClass)) {
      assert.equal(routedTo, entry.expectedSkill, `"${entry.prompt}" (${sizeClass}) should route to opm:${entry.expectedSkill}`);
    }
  }
});

test('every skill named in the routing table exists under skills/', () => {
  const named = loadTable().flatMap((row) => skillRefs(row.skill));
  assert.ok(named.length > 0, 'routing table names no opm: skills');
  for (const name of named) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')), `routing table names missing skill opm:${name}`);
  }
});
