'use strict';
// `npx opm-core status` — shows the open plan ledger for a repo from outside a
// Claude Code session. Read-only and offline. The parsing lives in
// bin/lib/ledger.mjs so this CLI, the SessionStart hook and the mod agree.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PARSER_PATH = path.join(__dirname, 'lib', 'ledger.mjs');
const PLANS_DIR = path.join('docs', 'plans');
const MILESTONES_DIR = path.join('docs', 'milestones');
const LEDGER_SUFFIX = '.progress.md';
const STATE_FILE = 'STATE.md';
const GIT_TIMEOUT_MS = 5000;
const IS_WINDOWS = process.platform === 'win32';

const STATUS_USAGE = `opm-core status — show the open plan ledger for a repo

  npx opm-core status [target repo]

Prints the newest docs/plans/*.progress.md that is not complete: the plan,
done/total and the current task, the last ruling or fix round, when it was
last updated and on which branch, and how to resume. Makes no network calls.

  npx opm-core status --report [target repo]

Prints the project outcome report instead: tasks done, reviewer findings by
severity, fix rounds, items parked, human checks pending, issues open and
closed, rulings made, and tasks escalated for no commits. Counts every
docs/plans ledger plus the newest milestone's ISSUES.md (an entry is closed
when struck through: "- ~~ISS-NNN: text~~"), REVIEW-QUEUE.md and phase
REVIEW-PACK.md. Read-only; a field with no data prints "none" or "not recorded".`;

const loadParser = () => import(pathToFileURL(PARSER_PATH).href);
const toPosix = (relative) => relative.split(path.sep).join('/');

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function readTextOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

// Files in dir matching predicate, newest first. A missing dir has none.
function newestFirst(dir, predicate) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter(predicate)
    .map((name) => {
      const file = path.join(dir, name);
      const stats = fs.statSync(file, { throwIfNoEntry: false });
      return stats ? { file, mtimeMs: stats.mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function readPlanText(repoRoot, planPath) {
  if (!planPath) return null;
  const planFile = path.resolve(repoRoot, planPath);
  return isInside(repoRoot, planFile) ? readTextOrNull(planFile) : null;
}

function parseLedgerFile(parser, repoRoot, file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    return { error: `unreadable (${error.code || error.message})`, isComplete: false, planPath: null };
  }
  const headerOnly = parser.parseLedger(text);
  if (headerOnly.error) return headerOnly;
  return parser.parseLedger(text, readPlanText(repoRoot, headerOnly.planPath));
}

// The newest ledger in repoRoot that is not complete, or null. A malformed or
// unreadable ledger counts as open, so its error reaches the user.
async function findOpenLedger(repoRoot, parser) {
  const root = path.resolve(repoRoot);
  const ledgers = newestFirst(path.join(root, PLANS_DIR), (name) => name.endsWith(LEDGER_SUFFIX));
  if (!ledgers.length) return null;
  const ledgerParser = parser || (await loadParser());
  for (const { file, mtimeMs } of ledgers) {
    const ledger = parseLedgerFile(ledgerParser, root, file);
    if (!ledger.isComplete) return { ledger, ledgerPath: toPosix(path.relative(root, file)), updatedAt: new Date(mtimeMs) };
  }
  return null;
}

function readMilestone(parser, repoRoot) {
  const milestonesRoot = path.join(repoRoot, MILESTONES_DIR);
  const states = newestFirst(milestonesRoot, (name) => fs.existsSync(path.join(milestonesRoot, name, STATE_FILE)));
  if (!states.length) return null;
  return parser.parseMilestoneState(readTextOrNull(path.join(states[0].file, STATE_FILE)));
}

// The current git branch, or null when git is missing or this is not a repo.
function currentBranch(repoRoot) {
  const result = spawnSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, shell: IS_WINDOWS });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim() || null;
}

// Text of a file under repoRoot, or null. Resolves symlinks first so a link
// pointing out of the repo is never read.
function readInsideText(repoRoot, file) {
  try {
    const real = fs.realpathSync(file);
    return isInside(fs.realpathSync(repoRoot), real) ? fs.readFileSync(real, 'utf8') : null;
  } catch {
    return null;
  }
}

function readLedgerOutcomes(parser, root) {
  return newestFirst(path.join(root, PLANS_DIR), (name) => name.endsWith(LEDGER_SUFFIX)).map(({ file }) => ({
    path: toPosix(path.relative(root, file)),
    outcomes: parser.countLedgerOutcomes(readInsideText(root, file)),
  }));
}

// Outcome counts from the newest milestone's ISSUES.md, REVIEW-QUEUE.md and phase REVIEW-PACK.md files, or null.
function readMilestoneOutcomes(parser, root) {
  const milestonesRoot = path.join(root, MILESTONES_DIR);
  const newest = newestFirst(milestonesRoot, (name) => fs.existsSync(path.join(milestonesRoot, name, STATE_FILE)))[0];
  if (!newest) return null;
  const phasesRoot = path.join(newest.file, 'phases');
  let phaseNames = [];
  try {
    phaseNames = fs.readdirSync(phasesRoot).sort();
  } catch {
    // no phases folder: no review packs to count
  }
  return parser.countMilestoneOutcomes({
    issuesText: readInsideText(root, path.join(newest.file, 'ISSUES.md')),
    reviewQueueText: readInsideText(root, path.join(newest.file, 'REVIEW-QUEUE.md')),
    reviewPackTexts: phaseNames.map((name) => readInsideText(root, path.join(phasesRoot, name, 'REVIEW-PACK.md'))).filter((text) => text !== null),
  });
}

async function reportLines(repoRoot) {
  const parser = await loadParser();
  const root = path.resolve(repoRoot);
  return parser.formatReport({ ledgers: readLedgerOutcomes(parser, root), milestone: readMilestoneOutcomes(parser, root) });
}

function parseStatusArgs(argv) {
  const options = { help: false, report: false, target: process.cwd() };
  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '--report') options.report = true;
    else if (arg.startsWith('-')) throw new Error(`unknown status option: ${arg}`);
    else options.target = path.resolve(arg);
  }
  return options;
}

async function statusLines(repoRoot) {
  const parser = await loadParser();
  const found = await findOpenLedger(repoRoot, parser);
  if (!found) return parser.formatStatus({ ledger: null });
  const milestone = found.ledger.error ? null : readMilestone(parser, repoRoot);
  return parser.formatStatus({ ...found, milestone, branch: found.ledger.error ? null : currentBranch(repoRoot) });
}

async function main(argv) {
  const options = parseStatusArgs(argv);
  if (options.help) { console.log(STATUS_USAGE); return 0; }
  const lines = options.report ? await reportLines(options.target) : await statusLines(options.target);
  console.log(lines.join('\n'));
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}

module.exports = { findOpenLedger, loadParser, parseStatusArgs, statusLines, main, STATUS_USAGE };
