'use strict';
// Report-ownership checks: the orchestrator is the only writer of report files
// (SUMMARY, STATE.md, PROGRESS.md, the ledger). Subagents return that content as
// text in their final report; no skill or agent may tell them to write it.
// Run with: node --test tests/report-ownership.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCANNED_DIRS = ['skills', 'agents'].map((dir) => path.join(ROOT, dir));
const SCANNED_EXTENSIONS = new Set(['.md', '.js']);
const MILESTONE_SKILL = path.join(ROOT, 'skills', 'milestone-planning', 'references', 'executing-a-phase.md');
const TEMPLATES_DIR = path.join(ROOT, 'skills', 'milestone-planning', 'templates');
const EXECUTING_HEADING = '## Executing a phase';

const SUBAGENT_WORD = /\b(sub-?agents?|executors?|implementers?|the agent)\b/i;
const WRITE_VERB = /\b(write|writes|update|updates|create|creates|append|appends)\b/i;
const REPORT_FILE = /\bSUMMARY\b|\bSTATE\.md\b|\bPROGRESS\.md\b|\bledger\b|\bprogress\.md\b/i;
const OWNER_WORD = /\b(orchestrator|controller)\b/i;
const NEGATION = /\b(never|do not|don't|not)\b/i;
// A line starting with one of these opens a new block, so it never continues a wrapped sentence.
const BLOCK_START = /^\s*($|[-*|#<>]|\d+\.|```)/;

const read = (file) => fs.readFileSync(file, 'utf8');
const relative = (file) => path.relative(ROOT, file);

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return SCANNED_EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

// Join hard-wrapped Markdown lines back into paragraphs, then split into sentences.
function sentences(text) {
  const chunks = [];
  for (const line of text.split('\n')) {
    const continues = chunks.length > 0 && !BLOCK_START.test(line) && chunks[chunks.length - 1] !== '';
    if (continues) chunks[chunks.length - 1] += ` ${line.trim()}`;
    else chunks.push(line.trim());
  }
  return chunks.flatMap((chunk) => chunk.split(/[.!?](?=\s|$)/)).map((s) => s.trim()).filter(Boolean);
}

function tellsSubagentToWriteReport(sentence) {
  if (!SUBAGENT_WORD.test(sentence) || !WRITE_VERB.test(sentence) || !REPORT_FILE.test(sentence)) return false;
  return !OWNER_WORD.test(sentence) && !NEGATION.test(sentence);
}

function section(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return null;
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

test('no skill or agent tells a subagent to write a report file', () => {
  const offenders = SCANNED_DIRS.flatMap(listFiles).flatMap((file) =>
    sentences(read(file))
      .filter(tellsSubagentToWriteReport)
      .map((sentence) => `${relative(file)}: "${sentence}"`),
  );
  assert.deepEqual(offenders, [], `subagents must return report content as text:\n${offenders.join('\n')}`);
});

test('milestone-planning: the subagent returns SUMMARY text and the orchestrator writes the files', () => {
  const executing = section(read(MILESTONE_SKILL), EXECUTING_HEADING);
  assert.ok(executing, `missing "${EXECUTING_HEADING}" section in skills/milestone-planning/references/executing-a-phase.md`);
  assert.match(executing, /return[^.]*SUMMARY|SUMMARY[^.]*return/i, 'the subagent must return the SUMMARY as text');
  assert.match(executing, /orchestrator writes/i, 'the orchestrator must write the report files');
});

test('summary and state templates name the orchestrator as the writer', () => {
  for (const name of ['summary.md', 'state.md']) {
    const template = read(path.join(TEMPLATES_DIR, name));
    assert.match(template, /The orchestrator saves this/, `templates/${name} must say the orchestrator saves it`);
  }
});
