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

// Snapshots: one $.store key per repo, shared by every session on the
// machine. The on-disk ledger stays the source of truth; this is a cache.
const STATUS_KEY_PREFIX = 'opm.status.';
const DAY_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_MAX_AGE_MS = 14 * DAY_MS;
const SNAPSHOT_MAX_BYTES = 64 * 1024;
const UNKNOWN_SESSION = 'unknown';

// /opm-status --all: rows from the store alone, sized for the chat panel.
const ALL_OPTION = '--all';
const MAX_ALL_ROWS = 25;
const MAX_TITLE_CHARS = 40;
const ELLIPSIS = '...';
const STALE_AFTER_MS = 3 * DAY_MS;
const EMPTY_ALL = 'no open plans recorded on this machine yet';
const NO_CURRENT_TASK = 'no current task';

export const statusCommands = [
  { name: COMMAND_NAME, description: 'Show the open OPM plan ledger; --all lists every project (no model call)', argumentHint: '[--all]', immediate: true },
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

// cyrb53-style 64-bit string hash, as 16 hex digits: the key names the repo
// without holding its path.
function stringHash(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h2) + hex(h1);
}

export const statusKey = (repoPath) => `${STATUS_KEY_PREFIX}${stringHash(repoPath)}`;

const isCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isText = (value) => typeof value === 'string';
const isTextOrNull = (value) => value === null || isText(value);

export function isStatusEntry(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    [value.sessionId, value.repoPath, value.ledgerPath, value.planPath].every(isText) &&
    isTextOrNull(value.branch) &&
    isTextOrNull(value.currentTaskTitle) &&
    isCount(value.tasksDone) &&
    (value.tasksTotal === null || isCount(value.tasksTotal)) &&
    isCount(value.lastSeenAt) &&
    isCount(value.sourceMtimeMs)
  );
}

const isEntryComplete = (entry) => entry.tasksTotal !== null && entry.tasksDone >= entry.tasksTotal;

function currentTaskTitle(task) {
  if (!task) return null;
  return task.title ? `Task ${task.number} ${task.title}` : `Task ${task.number}`;
}

// A SessionStatusEntry for one open ledger.
export function snapshot({ sessionId, repoPath, branch, ledgerPath, ledger, now, sourceMtimeMs }) {
  return {
    sessionId,
    repoPath,
    branch: branch ?? null,
    ledgerPath,
    planPath: ledger.planPath,
    tasksDone: ledger.tasksDone,
    tasksTotal: ledger.tasksTotal,
    currentTaskTitle: currentTaskTitle(ledger.currentTask),
    lastSeenAt: now,
    sourceMtimeMs,
  };
}

const UTF8 = new TextEncoder();
const entrySize = ({ key, value }) => UTF8.encode(key).length + UTF8.encode(JSON.stringify(value)).length;

// The keys to delete from [{ key, value }]: values that are not entries,
// entries older than the age limit or complete, then the oldest until the
// rest fit the byte cap.
export function pruneStatusEntries(entries, now) {
  const isLive = ({ value }) => isStatusEntry(value) && now - value.lastSeenAt <= SNAPSHOT_MAX_AGE_MS && !isEntryComplete(value);
  const kept = entries.filter(isLive);
  const dropped = entries.filter((entry) => !isLive(entry)).map((entry) => entry.key);
  let total = 0;
  for (const entry of [...kept].sort((a, b) => b.value.lastSeenAt - a.value.lastSeenAt)) {
    total += entrySize(entry);
    if (total > SNAPSHOT_MAX_BYTES) dropped.push(entry.key);
  }
  return dropped;
}

const pad2 = (n) => String(n).padStart(2, '0');
const lastPathPart = (path) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

function seenText(at) {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function titleText(title) {
  if (!title) return NO_CURRENT_TASK;
  return title.length > MAX_TITLE_CHARS ? `${title.slice(0, MAX_TITLE_CHARS - ELLIPSIS.length)}${ELLIPSIS}` : title;
}

function allRow(entry, now) {
  const total = entry.tasksTotal === null ? '?' : entry.tasksTotal;
  const stale = now - entry.lastSeenAt > STALE_AFTER_MS ? ' (stale)' : '';
  return `${lastPathPart(entry.repoPath)}: ${lastPathPart(entry.planPath)} ${entry.tasksDone}/${total}, ${titleText(entry.currentTaskTitle)}, seen ${seenText(entry.lastSeenAt)}${stale}`;
}

// The --all lines for live entries: newest first, at most 25 rows, a footer.
export function formatAllStatus(entries, now) {
  if (!entries.length) return [EMPTY_ALL];
  const rows = [...entries].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, MAX_ALL_ROWS).map((entry) => allRow(entry, now));
  return [...rows, `${entries.length} projects, cache only: run /${COMMAND_NAME} in a repo for its live state`];
}

async function allStatusText($) {
  const now = await $.clock.now();
  const entries = await readStatusEntries($);
  const dropped = new Set(pruneStatusEntries(entries, now));
  const live = entries.filter((entry) => !dropped.has(entry.key)).map((entry) => entry.value);
  return formatAllStatus(live, now).join('\n');
}

async function readStatusEntries($) {
  const keys = (await $.store.keys()).filter((key) => key.startsWith(STATUS_KEY_PREFIX));
  const entries = [];
  for (const key of keys) entries.push({ key, value: await $.store.get(key) });
  return entries;
}

async function pruneStore($, now) {
  for (const key of pruneStatusEntries(await readStatusEntries($), now)) await $.store.delete(key);
}

// The newest ledger file's mtime in docs/plans, or null when there is none.
async function ledgerSignature($) {
  if (!(await $.fs.exists(PLANS_DIR))) return null;
  const ledgers = await listLedgers($);
  return ledgers.length ? ledgers[0].mtimeMs : null;
}

// Writes this repo's snapshot when its ledgers changed since the stored one;
// drops it when no open ledger is left.
async function refreshSnapshot($) {
  const repoPath = await $.session.root();
  const key = statusKey(repoPath);
  const signature = await ledgerSignature($);
  const stored = await $.store.get(key);
  if (isStatusEntry(stored) && stored.sourceMtimeMs === signature) return;
  const found = signature === null ? null : await findOpenLedger($);
  if (!found || found.ledger.error) {
    if (stored !== undefined) await $.store.delete(key);
    return;
  }
  const sessionId = await $.session.id().catch(() => UNKNOWN_SESSION);
  const now = await $.clock.now();
  const branch = await currentBranch($);
  const entry = snapshot({ sessionId, repoPath, branch, ledgerPath: found.ledgerPath, ledger: found.ledger, now, sourceMtimeMs: signature });
  await $.store.set(key, entry);
  await pruneStore($, now);
}

async function statusText($) {
  const found = await findOpenLedger($);
  if (!found) return formatStatus({ ledger: null }).join('\n');
  if (found.ledger.error) return formatStatus(found).join('\n');
  const milestone = await readMilestone($);
  const branch = await currentBranch($);
  return formatStatus({ ...found, milestone, branch }).join('\n');
}

// Store errors never reach the user or break a turn: one debug log line.
async function recordSnapshot($) {
  try {
    await refreshSnapshot($);
  } catch (error) {
    $.ui.log(`opm: status could not record the snapshot: ${errorText(error)}`, { to: 'debug' });
  }
}

async function answerStatus($, option) {
  try {
    if (option === ALL_OPTION) {
      await recordSnapshot($);
      return { text: await allStatusText($) };
    }
    const text = await statusText($);
    await recordSnapshot($);
    return { text };
  } catch (error) {
    $.ui.log(`opm: status failed: ${errorText(error)}`, { to: 'debug' });
    return { text: `opm status: ${errorText(error)}` };
  }
}

export function installStatus(on) {
  on('command.run', { command: COMMAND_NAME }, async ($, e) => {
    const option = (e.args ?? '').trim();
    if (option && option !== ALL_OPTION) return { text: `opm: unknown option "${option}"; use ${ALL_OPTION}` };
    return answerStatus($, option);
  });

  // Main-loop turns only: a subagent's ledger edits show on the next one.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) await recordSnapshot($);
    return result;
  });
}
