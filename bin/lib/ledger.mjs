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
