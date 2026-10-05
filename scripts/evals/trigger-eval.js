#!/usr/bin/env node
'use strict';
// Manual skill-trigger eval: sends each fixture prompt to a headless Claude Code session
// and records which OPM skill it invoked. Spends tokens, so it needs --yes and is not
// part of npm test. See docs/evals.md.
//
//   node scripts/evals/trigger-eval.js --yes [--limit N] [--only <sizeClass>]

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'trigger-prompts.json');
const SIZE_CLASSES = ['spike', 'bounded', 'multi-week', 'unattended', 'contested'];
const OPM_PREFIX = 'opm:';
// using-opm is already injected by the SessionStart hook; loading it again is not a routing choice.
const FRONT_DOOR_SKILL = 'opm:using-opm';
const EVAL_MODEL = 'haiku';
// Turn 1 may only reload using-opm (spike run 2), so allow one more turn to see the real pick.
const MAX_TURNS = 2;
const RUN_TIMEOUT_MS = 180000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const COST_WARNING = [
  'trigger-eval spends tokens: one headless claude run per prompt',
  `(${EVAL_MODEL}, about $0.02 each, about $0.70 for all 30).`,
  'Re-run with --yes to start, optionally with --limit N or --only <sizeClass>.',
].join(' ');

// Returns the skill names of every Skill tool_use in stream-json output, in order.
function parseSkillInvocations(streamJsonText) {
  const skills = [];
  const lines = streamJsonText.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`stream-json line ${index + 1} is not valid JSON: ${error.message}`);
    }
    if (event.type !== 'assistant') return;
    const content = event.message && Array.isArray(event.message.content) ? event.message.content : [];
    for (const block of content) {
      if (block.type === 'tool_use' && block.name === 'Skill' && block.input && typeof block.input.skill === 'string') {
        skills.push(block.input.skill);
      }
    }
  });
  return skills;
}

// The first OPM skill that is a routing choice, without the opm: prefix, or null.
function observedSkill(skillNames) {
  const chosen = skillNames.find((name) => name.startsWith(OPM_PREFIX) && name !== FRONT_DOOR_SKILL);
  return chosen ? chosen.slice(OPM_PREFIX.length) : null;
}

function parseArgs(argv) {
  const options = { yes: false, limit: null, only: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--yes') {
      options.yes = true;
    } else if (arg === '--limit') {
      const limit = Number(argv[i + 1]);
      if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit needs a whole number of 1 or more');
      options.limit = limit;
      i += 1;
    } else if (arg === '--only') {
      const sizeClass = argv[i + 1];
      if (!SIZE_CLASSES.includes(sizeClass)) throw new Error(`--only needs one of: ${SIZE_CLASSES.join(', ')}`);
      options.only = sizeClass;
      i += 1;
    } else {
      throw new Error(`unknown option ${arg}`);
    }
  }
  return options;
}

// Adds 1-based fixture ids, then filters by size class and applies the limit.
function selectPrompts(fixture, { only = null, limit = null } = {}) {
  const withIds = fixture.map((entry, index) => ({ id: index + 1, ...entry }));
  const filtered = only ? withIds.filter((entry) => entry.sizeClass === only) : withIds;
  return limit ? filtered.slice(0, limit) : filtered;
}

async function runEval({ prompts, run }) {
  const rows = [];
  for (const entry of prompts) {
    const row = { id: entry.id, sizeClass: entry.sizeClass, expected: entry.expectedSkill, observed: null, hit: false };
    try {
      row.observed = observedSkill(parseSkillInvocations(await run(entry.prompt)));
      row.hit = row.observed === entry.expectedSkill;
    } catch (error) {
      row.error = error.message;
    }
    rows.push(row);
  }
  return rows;
}

function formatReport(rows) {
  const header = ['id', 'size', 'expected', 'observed', 'result'];
  const cells = rows.map((row) => [
    String(row.id),
    row.sizeClass,
    row.expected,
    row.error ? `error: ${row.error}` : row.observed || '(none)',
    row.hit ? 'hit' : 'miss',
  ]);
  const widths = header.map((title, col) => Math.max(title.length, ...cells.map((line) => line[col].length)));
  const format = (line) => line.map((cell, col) => cell.padEnd(widths[col])).join('  ').trimEnd();
  const hits = rows.filter((row) => row.hit).length;
  const percent = rows.length ? Math.round((hits / rows.length) * 100) : 0;
  return [format(header), ...cells.map(format), '', `Hit rate: ${hits}/${rows.length} (${percent}%)`].join('\n');
}

// Runs one prompt headless in a throwaway directory with this checkout loaded as the plugin.
function runHeadless(prompt) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-trigger-eval-'));
  try {
    const result = spawnSync('claude', [
      '-p', prompt,
      '--output-format', 'stream-json', '--verbose',
      '--model', EVAL_MODEL, '--max-turns', String(MAX_TURNS),
      '--setting-sources', 'project,local', '--no-session-persistence',
      '--plugin-dir', REPO_ROOT,
    ], { cwd: workDir, encoding: 'utf8', timeout: RUN_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES });
    if (result.error) throw new Error(`could not run claude: ${result.error.message}`);
    // Hitting the turn limit exits 1 but still prints the events we need.
    if (!result.stdout.trim()) throw new Error(`claude exited ${result.status} with no output: ${result.stderr.trim()}`);
    return result.stdout;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`trigger-eval: ${error.message}`);
    return 1;
  }
  if (!options.yes) {
    console.error(COST_WARNING);
    return 1;
  }
  const prompts = selectPrompts(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')), options);
  const rows = await runEval({ prompts, run: async (prompt) => runHeadless(prompt) });
  console.log(formatReport(rows));
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (error) => { console.error(`trigger-eval failed: ${error.message}`); process.exitCode = 1; },
  );
}

module.exports = { parseSkillInvocations, observedSkill, parseArgs, selectPrompts, runEval, formatReport };
