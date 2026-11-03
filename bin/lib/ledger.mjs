// Shared OPM ledger parser: pure functions, no I/O and no Node APIs, so the
// npx CLI, the SessionStart hook and the in-process mod give the same answer.
// Callers read the files and pass their text in.

const LEDGER_HEADER = /^# OPM ledger - plan: (\S.*)$/;
const TASK_LINE = /^Task (\d+): (.+)$/;
const TASK_PREFIX = /^Task\b/;
const TASK_COMPLETE = /^complete\b/;
const FIX_ROUND = /fix round (\d+)\/(\d+)/i;
const RULING = /Ruling:\s*(.+)$/;
const MODE_TOTAL = /^Mode: .*\((\d+) tasks?\)/;
const PLAN_TASK_HEADING = /^### Task (\d+)[:.]?\s*(.*)$/;
const MILESTONE_PHASE = /^Phase: (\d+) of (\d+)/m;
const MILESTONE_PLAN = /^Plan: (\d+) of (\d+)/m;
const MILESTONE_STATUS = /^Status: (.+)$/m;
const MAX_LINE_IN_ERROR = 80;
const RESUME_HINT = 'next: ask Claude to resume the plan';
const EMPTY_STATE = 'no open ledger in this repo';

const toLines = (text) => text.replace(/\r\n?/g, '\n').split('\n');
const pad2 = (n) => String(n).padStart(2, '0');

function emptyResult(error) {
  return { planPath: null, tasksDone: 0, tasksTotal: null, currentTask: null, fixRound: null, lastRuling: null, isComplete: false, error };
}

function badLine(index, line) {
  return `line ${index + 1}: unexpected "${line.slice(0, MAX_LINE_IN_ERROR)}"`;
}

// Maps task number to title from "### Task N: title" headings in the plan.
function planTasks(planText) {
  if (typeof planText !== 'string') return null;
  const titles = new Map();
  for (const line of toLines(planText)) {
    const match = line.match(PLAN_TASK_HEADING);
    if (match && !titles.has(Number(match[1]))) titles.set(Number(match[1]), match[2].trim() || null);
  }
  return titles.size ? titles : null;
}

function scanBody(lines) {
  const done = new Set();
  let fixRound = null;
  let lastRuling = null;
  let modeTotal = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const task = line.match(TASK_LINE);
    if (TASK_PREFIX.test(line) && !task) return { error: badLine(i, line) };
    if (task && TASK_COMPLETE.test(task[2])) done.add(Number(task[1]));
    const round = line.match(FIX_ROUND);
    if (round) fixRound = { task: task ? Number(task[1]) : null, round: Number(round[1]), max: Number(round[2]) };
    const ruling = line.match(RULING);
    if (ruling) lastRuling = ruling[1].trim();
    const mode = line.match(MODE_TOTAL);
    if (mode) modeTotal = Number(mode[1]);
  }
  return { done, fixRound, lastRuling, modeTotal, error: null };
}

function firstOpenTask(done, total) {
  let number = 1;
  while (done.has(number)) number++;
  return total !== null && number > total ? null : number;
}

// parseLedger(text, planText?) -> ledger summary; never throws.
export function parseLedger(text, planText) {
  if (typeof text !== 'string' || !text.trim()) return emptyResult('empty ledger');
  const lines = toLines(text.replace(/^﻿/, ''));
  const header = lines[0].trim().match(LEDGER_HEADER);
  if (!header) return emptyResult(badLine(0, lines[0].trim()));
  const body = scanBody(lines);
  if (body.error) return { ...emptyResult(body.error), planPath: header[1].trim() };

  const titles = planTasks(planText);
  const tasksTotal = titles ? titles.size : body.modeTotal;
  const tasksDone = body.done.size;
  const isComplete = tasksTotal !== null && firstOpenTask(body.done, tasksTotal) === null;
  const number = isComplete ? null : firstOpenTask(body.done, null);
  const currentTask = number === null ? null : { number, title: (titles && titles.get(number)) || null };
  return { planPath: header[1].trim(), tasksDone, tasksTotal, currentTask, fixRound: body.fixRound, lastRuling: body.lastRuling, isComplete, error: null };
}

// parseMilestoneState(text) -> { phase, phaseTotal, plan, planTotal, status } | null
export function parseMilestoneState(text) {
  if (typeof text !== 'string') return null;
  const normalized = text.replace(/\r\n?/g, '\n');
  const phase = normalized.match(MILESTONE_PHASE);
  if (!phase) return null;
  const plan = normalized.match(MILESTONE_PLAN);
  const status = normalized.match(MILESTONE_STATUS);
  return {
    phase: Number(phase[1]),
    phaseTotal: Number(phase[2]),
    plan: plan ? Number(plan[1]) : null,
    planTotal: plan ? Number(plan[2]) : null,
    status: status ? status[1].trim() : null,
  };
}

function formatTime(updatedAt) {
  if (updatedAt === undefined || updatedAt === null) return null;
  if (typeof updatedAt === 'string') return updatedAt;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function currentTaskText(task) {
  if (!task) return 'all tasks done';
  return task.title ? `Task ${task.number} ${task.title}` : `Task ${task.number}`;
}

function eventLine(ledger) {
  const round = ledger.fixRound;
  const roundIsOpen = round && round.task !== null && ledger.currentTask && ledger.currentTask.number === round.task;
  if (roundIsOpen) return `fix round ${round.round}/${round.max} on Task ${round.task}`;
  return ledger.lastRuling ? `last ruling: ${ledger.lastRuling}` : null;
}

function updatedLine({ milestone, branch, updatedAt }) {
  const time = formatTime(updatedAt);
  let line = time ? `updated ${time}` : '';
  if (branch) line += `${line ? ' ' : ''}on ${branch}`;
  if (milestone) {
    const plan = milestone.plan === null ? '' : `, plan ${milestone.plan}/${milestone.planTotal}`;
    const status = milestone.status ? ` (${milestone.status})` : '';
    line += `${line ? '; ' : ''}milestone phase ${milestone.phase}/${milestone.phaseTotal}${plan}${status}`;
  }
  return line || null;
}

// formatStatus({ ledger, ledgerPath?, milestone?, branch?, updatedAt? }) -> at most 5 lines.
export function formatStatus({ ledger, ledgerPath, milestone, branch, updatedAt } = {}) {
  if (!ledger) return [EMPTY_STATE];
  if (ledger.error) {
    const name = ledgerPath || ledger.planPath;
    return [name ? `malformed ledger ${name}: ${ledger.error}` : `malformed ledger: ${ledger.error}`];
  }
  const total = ledger.tasksTotal === null ? '?' : ledger.tasksTotal;
  const lines = [
    ledgerPath ? `plan: ${ledger.planPath} (ledger ${ledgerPath})` : `plan: ${ledger.planPath}`,
    `progress: ${ledger.tasksDone}/${total}, current: ${currentTaskText(ledger.currentTask)}`,
    eventLine(ledger),
    updatedLine({ milestone, branch, updatedAt }),
    RESUME_HINT,
  ];
  return lines.filter(Boolean);
}

// formatResumeLine({ ledger, ledgerPath? }) -> one line for an open ledger, else null.
export function formatResumeLine({ ledger, ledgerPath } = {}) {
  if (!ledger || ledger.error || ledger.isComplete) return null;
  const total = ledger.tasksTotal === null ? '?' : ledger.tasksTotal;
  const where = ledgerPath || ledger.planPath;
  return `OPM: open ledger ${where}, ${ledger.tasksDone} of ${total} tasks done, next ${currentTaskText(ledger.currentTask)}. Ask Claude to resume the plan with opm:executing-plans.`;
}

// ---- Outcome counts (project report). Pure: callers pass file text in. ----

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const FINDING_LINE = /^Finding: (CRITICAL|HIGH|MEDIUM|LOW) (fixed|parked|dismissed)\b/;
const PARKED_LINE = /^Task \d+: parked\b/;
const ESCALATED_LINE = /^Task (\d+): escalated\b/;
const RULING_ANYWHERE = /(^|\s)Ruling:/;
// An ISSUES.md entry is closed when its line is struck through: "- ~~ISS-NNN: text~~".
const ISSUE_ENTRY = /^- (~~)?ISS-\d+/;
const FINDINGS_ROW = /^\|\s*(CRITICAL|HIGH|MEDIUM|LOW)\s*\|(.*)\|\s*$/;
const QUEUE_ID = /^RQ-\d+$/;

const emptySeverityCounts = () => Object.fromEntries(SEVERITIES.map((s) => [s, { found: 0, fixed: 0, parked: 0, dismissed: 0 }]));
const leadingCount = (cell) => {
  const match = (cell || '').trim().match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
};
const tableCells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

// countLedgerOutcomes(text) -> { tasksDone, fixRounds, parked, rulings, escalated: number[], findings | null }
// findings is null when the ledger has no `Finding:` lines ("not recorded").
export function countLedgerOutcomes(text) {
  const counts = { tasksDone: 0, fixRounds: 0, parked: 0, rulings: 0, escalated: [], findings: null };
  if (typeof text !== 'string') return counts;
  const done = new Set();
  const findings = emptySeverityCounts();
  let findingLines = 0;
  for (const raw of toLines(text)) {
    const line = raw.trim();
    const task = line.match(TASK_LINE);
    if (task && TASK_COMPLETE.test(task[2])) done.add(Number(task[1]));
    if (FIX_ROUND.test(line)) counts.fixRounds++;
    if (PARKED_LINE.test(line)) counts.parked++;
    if (RULING_ANYWHERE.test(line)) counts.rulings++;
    const escalated = line.match(ESCALATED_LINE);
    if (escalated) counts.escalated.push(Number(escalated[1]));
    const finding = line.match(FINDING_LINE);
    if (finding) {
      findings[finding[1]].found++;
      findings[finding[1]][finding[2]]++;
      findingLines++;
    }
  }
  return { ...counts, tasksDone: done.size, findings: findingLines ? findings : null };
}

function countIssues(issuesText) {
  let issuesOpen = 0;
  let issuesClosed = 0;
  for (const line of typeof issuesText === 'string' ? toLines(issuesText) : []) {
    const match = line.match(ISSUE_ENTRY);
    if (!match) continue;
    if (match[1]) issuesClosed++;
    else issuesOpen++;
  }
  return { issuesOpen, issuesClosed };
}

function countPendingChecks(reviewQueueText) {
  if (typeof reviewQueueText !== 'string') return 0;
  let statusColumn = -1;
  let pending = 0;
  for (const line of toLines(reviewQueueText)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = tableCells(line);
    if (cells[0] === 'ID') statusColumn = cells.indexOf('Status');
    else if (QUEUE_ID.test(cells[0]) && statusColumn >= 0 && cells[statusColumn] === 'pending') pending++;
  }
  return pending;
}

function sumPackFindings(reviewPackTexts) {
  const findings = emptySeverityCounts();
  let rows = 0;
  for (const text of Array.isArray(reviewPackTexts) ? reviewPackTexts : []) {
    if (typeof text !== 'string') continue;
    for (const line of toLines(text)) {
      const row = line.trim().match(FINDINGS_ROW);
      if (!row) continue;
      const [found, fixed, parked, dismissed] = tableCells(`|${row[2]}|`).map(leadingCount);
      const target = findings[row[1]];
      target.found += found;
      target.fixed += fixed;
      target.parked += parked;
      target.dismissed += dismissed;
      rows++;
    }
  }
  return rows ? findings : null;
}

const OUTCOMES = ['fixed', 'parked', 'dismissed'];
const countOrNone = (n) => (n ? String(n) : 'none');

function mergeSeverityCounts(...sources) {
  const present = sources.filter(Boolean);
  if (!present.length) return null;
  const merged = emptySeverityCounts();
  for (const source of present) {
    for (const severity of SEVERITIES) for (const key of ['found', ...OUTCOMES]) merged[severity][key] += source[severity][key];
  }
  return merged;
}

function severityText(severity, counts) {
  if (!counts.found) return `${severity} none`;
  const parts = OUTCOMES.filter((key) => counts[key]).map((key) => `${counts[key]} ${key}`);
  return `${severity} ${counts.found}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

// formatReport({ ledgers: [{ path, outcomes }], milestone }) -> eight lines, one per outcome field.
// outcomes come from countLedgerOutcomes, milestone from countMilestoneOutcomes (or null).
export function formatReport({ ledgers = [], milestone = null } = {}) {
  const sum = (key) => ledgers.reduce((total, ledger) => total + ledger.outcomes[key], 0);
  // Ledger `Finding:` lines and REVIEW-PACK tables can describe the same findings, so use the
  // ledgers when any has Finding lines and fall back to the packs only when none do.
  const ledgerFindings = mergeSeverityCounts(...ledgers.map((ledger) => ledger.outcomes.findings));
  const findings = ledgerFindings || mergeSeverityCounts(milestone && milestone.findings);
  const escalated = ledgers.flatMap(({ path, outcomes }) => outcomes.escalated.map((task) => `Task ${task} (${path})`));
  const issuesOpen = milestone ? milestone.issuesOpen : 0;
  const issuesClosed = milestone ? milestone.issuesClosed : 0;
  const tasksDone = sum('tasksDone');
  return [
    tasksDone ? `tasks done: ${tasksDone} (across ${ledgers.length} ledger${ledgers.length === 1 ? '' : 's'})` : 'tasks done: none',
    `reviewer findings: ${findings ? SEVERITIES.map((s) => severityText(s, findings[s])).join(', ') : 'not recorded'}`,
    `fix rounds: ${countOrNone(sum('fixRounds'))}`,
    `items parked: ${countOrNone(sum('parked'))}`,
    `human checks pending: ${countOrNone(milestone ? milestone.humanChecksPending : 0)}`,
    issuesOpen + issuesClosed ? `issues: ${issuesOpen} open, ${issuesClosed} closed` : 'issues: none',
    `rulings made: ${countOrNone(sum('rulings'))}`,
    `escalated (no commits): ${escalated.length ? escalated.join(', ') : 'none'}`,
  ];
}

// countMilestoneOutcomes({ issuesText, reviewQueueText, reviewPackTexts }) ->
// { issuesOpen, issuesClosed, humanChecksPending, findings | null }. Missing inputs give zeros or null.
export function countMilestoneOutcomes({ issuesText, reviewQueueText, reviewPackTexts } = {}) {
  return { ...countIssues(issuesText), humanChecksPending: countPendingChecks(reviewQueueText), findings: sumPackFindings(reviewPackTexts) };
}
