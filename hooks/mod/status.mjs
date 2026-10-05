// /opm-status: the open plan ledger, answered by code with no model turn.
// Finds the ledger the way bin/status.js does, but through $.fs and
// $.process (a hooks module has no Node APIs), and reuses the shared parser
// and formatter so the CLI, the SessionStart line and the mod agree.

import { parseLedger, parseMilestoneState, formatStatus } from '../../bin/lib/ledger.mjs';

const COMMAND_NAME = 'opm-status';
const PLANS_DIR = 'docs/plans';
const MILESTONES_DIR = 'docs/milestones';
const LEDGER_SUFFIX = '.progress.md';
const STATE_FILE = 'STATE.md';
const GIT_TIMEOUT_MS = 3000;
const UNSAFE_PLAN_PATH = /(^[\\/])|(^[A-Za-z]:)|(^|[\\/])\.\.([\\/]|$)/;

export const statusCommands = [
  { name: COMMAND_NAME, description: 'Show the open OPM plan ledger (no model call)', immediate: true },
];

const errorText = (error) => (error && error.message ? error.message : String(error));

// Ledger files in docs/plans, newest first.
async function listLedgers($) {
  const entries = await $.fs.list(PLANS_DIR);
  return entries
    .filter((entry) => entry.kind === 'file' && entry.name.endsWith(LEDGER_SUFFIX))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((entry) => ({ path: `${PLANS_DIR}/${entry.name}`, mtimeMs: entry.mtimeMs }));
}

// The plan's text, or null when it is missing or points outside the repo.
async function readPlanText($, planPath) {
  if (!planPath || UNSAFE_PLAN_PATH.test(planPath)) return null;
  try {
    return await $.fs.read(planPath);
  } catch {
    return null; // the parser falls back to the ledger's own task count
  }
}

async function readLedger($, path) {
  let text;
  try {
    text = await $.fs.read(path);
  } catch (error) {
    return { error: `unreadable (${errorText(error)})`, isComplete: false, planPath: null };
  }
  const headerOnly = parseLedger(text);
  if (headerOnly.error) return headerOnly;
  return parseLedger(text, await readPlanText($, headerOnly.planPath));
}

// The newest ledger that is not complete, or null. A malformed or unreadable
// ledger counts as open, so its error reaches the user.
async function findOpenLedger($) {
  if (!(await $.fs.exists(PLANS_DIR))) return null;
  let ledgers;
  try {
    ledgers = await listLedgers($);
  } catch (error) {
    throw new Error(`could not list ${PLANS_DIR}: ${errorText(error)}`, { cause: error });
  }
  for (const { path, mtimeMs } of ledgers) {
    const ledger = await readLedger($, path);
    if (!ledger.isComplete) return { ledger, ledgerPath: path, updatedAt: mtimeMs };
  }
  return null;
}

// The newest milestone STATE.md, parsed; null when there is none or it fails.
async function readMilestone($) {
  try {
    if (!(await $.fs.exists(MILESTONES_DIR))) return null;
    const dirs = (await $.fs.list(MILESTONES_DIR)).filter((entry) => entry.kind === 'dir');
    let newest = null;
    for (const dir of dirs) {
      const path = `${MILESTONES_DIR}/${dir.name}/${STATE_FILE}`;
      const stat = await $.fs.stat(path).catch(() => null);
      if (stat && (!newest || stat.mtimeMs > newest.mtimeMs)) newest = { path, mtimeMs: stat.mtimeMs };
    }
    return newest ? parseMilestoneState(await $.fs.read(newest.path)) : null;
  } catch (error) {
    $.ui.log(`opm: status could not read the milestone state: ${errorText(error)}`, { to: 'debug' });
    return null;
  }
}

// The current branch, or null when git is missing or this is not a repo.
async function currentBranch($) {
  try {
    const result = await $.process.run(['git', 'branch', '--show-current'], { timeoutMs: GIT_TIMEOUT_MS });
    return result.exitCode === 0 ? result.stdout.trim() || null : null;
  } catch (error) {
    $.ui.log(`opm: status could not run git: ${errorText(error)}`, { to: 'debug' });
    return null;
  }
}

async function statusText($) {
  const found = await findOpenLedger($);
  if (!found) return formatStatus({ ledger: null }).join('\n');
  if (found.ledger.error) return formatStatus(found).join('\n');
  const milestone = await readMilestone($);
  const branch = await currentBranch($);
  return formatStatus({ ...found, milestone, branch }).join('\n');
}

export function installStatus(on) {
  on('command.run', { command: COMMAND_NAME }, async ($) => {
    try {
      return { text: await statusText($) };
    } catch (error) {
      $.ui.log(`opm: status failed: ${errorText(error)}`, { to: 'debug' });
      return { text: `opm status: ${errorText(error)}` };
    }
  });
}
