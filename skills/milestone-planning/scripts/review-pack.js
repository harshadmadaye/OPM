#!/usr/bin/env node
"use strict";

/**
 * Rank a phase's commits by risk and print a review-pack skeleton.
 *
 * Usage: node review-pack.js <base>..<head> [--max N]
 * Exit:  0 printed (including "no risky commits"), 1 bad input or git failure.
 *
 * No dependencies. Git is called with execFileSync and an argument array, never
 * through a shell. The orchestrator fills in the "Questions:" lines from the diff.
 */

const { execFileSync } = require("node:child_process");

const DEFAULT_MAX = 5;
const SHORT_SHA_LENGTH = 7;
const LOW_RISK_FACTOR = 0.25;
const RANGE_PATTERN = /^[A-Za-z0-9_./~^@{}-]+\.\.\.?[A-Za-z0-9_./~^@{}-]+$/;

/** Each category: a weight, and regexes over changed paths and over added lines. */
const CATEGORIES = [
  {
    name: "auth",
    weight: 3,
    path: /(^|\/)(auth|login|logout|session|oauth|jwt|passw)/i,
    line: /\b(authenticate|authorize|login|logout|jwt|oauth|bcrypt|password)\b/i,
  },
  {
    name: "permissions",
    weight: 3,
    path: /(permission|rbac|acl|polic(y|ies)|\.rules$)/i,
    line: /\b(permission|isAdmin|role|rbac|acl|allow (read|write)|chmod)\b/i,
  },
  {
    name: "data deletion",
    weight: 3,
    path: null,
    line: /\b(DELETE\s+FROM|DROP\s+(TABLE|COLUMN|INDEX|DATABASE)|TRUNCATE|unlink(Sync)?|rmSync|rm\s+-rf?)\b/i,
    onDeletedFile: true,
  },
  {
    name: "migrations",
    weight: 3,
    path: /(^|\/)(migrations?|alembic)\/|\.sql$/i,
    line: /\b(ALTER\s+TABLE|CREATE\s+TABLE|ADD\s+COLUMN)\b/i,
  },
  {
    name: "payments",
    weight: 3,
    path: /(payment|billing|checkout|stripe|invoice|webhook)/i,
    line: /\b(stripe|charge|invoice|paypal|payment_intent|refund)\b/i,
  },
  {
    name: "sync",
    weight: 2,
    path: /(^|\/)(sync|replicat)/i,
    line: /\b(onSnapshot|syncWith|replicate|eventual)\b/i,
  },
  {
    name: "secrets",
    weight: 3,
    path: /(^|\/)\.env|(secret|credential|\.pem$|\.key$)/i,
    line: /\b(api[_-]?key|secret|token|private[_-]?key)\s*[:=]/i,
  },
  {
    name: "external calls",
    weight: 2,
    // Hook scripts run external tools on every user's machine without being asked.
    path: /(^|\/)hooks\/scripts\/[^/]+\.js$/,
    line: /(\bfetch\s*\(|\baxios\b|\bhttps?\.(request|get)\b|\bcurl\s|\b(execFileSync|execSync|spawnSync|spawn)\s*\(|\bgh\s+(api|pr|issue))/i,
  },
];

const TEST_PATH = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$/i;
const DOC_PATH = /\.(md|mdx|txt|rst)$|(^|\/)docs\//i;

/** Prose and test files are scored by path only; their added lines mention risky words as text. */
function isQuietFile(file) {
  return TEST_PATH.test(file) || DOC_PATH.test(file);
}

class UsageError extends Error {}

function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    const detail = String(error.stderr || error.message).trim().split("\n")[0];
    throw new UsageError(`git failed: ${detail}`);
  }
}

function validateRange(range) {
  if (typeof range !== "string" || !RANGE_PATTERN.test(range)) {
    throw new UsageError(`bad range "${range}": expected <base>..<head>, e.g. abc1234..HEAD`);
  }
  if (range.split(/\.\.\.?/).some((side) => side.startsWith("-"))) {
    throw new UsageError(`bad range "${range}": a side may not start with "-"`);
  }
}

function parseCommit(sha, cwd) {
  const out = git(
    ["show", "--raw", "--patch", "--no-renames", "--format=%x00%s%x00", "--unified=0", "--no-color", sha],
    cwd,
  );
  const [, subject, rest] = out.split("\u0000");
  const files = [];
  const added = [];
  let currentFile = "";
  for (const line of rest.split("\n")) {
    const header = /^\+\+\+ b\/(.+)$/.exec(line);
    if (header) {
      currentFile = header[1];
      continue;
    }
    const status = /^:\d+ \d+ \w+ \w+ ([AMDTUXB])\t(.+)$/.exec(line);
    if (status) {
      files.push({ status: status[1], file: status[2] });
    } else if (line.startsWith("+") && !isQuietFile(currentFile)) {
      added.push(line.slice(1));
    }
  }
  return { sha, subject, files, added };
}

function scoreCommit(commit) {
  const categories = [];
  let score = 0;
  for (const category of CATEGORIES) {
    const pathHit = category.path && commit.files.some(({ file }) => category.path.test(file));
    const deletedHit = category.onDeletedFile && commit.files.some(({ status }) => status === "D");
    const lineHit = commit.added.some((line) => category.line.test(line));
    if (pathHit || deletedHit || lineHit) {
      categories.push(category.name);
      score += category.weight;
    }
  }
  const quietOnly =
    commit.files.length > 0 &&
    commit.files.every(({ file }) => isQuietFile(file));
  return { categories, score: quietOnly ? score * LOW_RISK_FACTOR : score };
}

/** Commits in the range with a risk score above zero, highest first. */
function rank(range, { cwd = process.cwd() } = {}) {
  validateRange(range);
  const shas = git(["rev-list", "--no-merges", range], cwd).split("\n").filter(Boolean);
  return shas
    .map((sha) => {
      const commit = parseCommit(sha, cwd);
      return { ...commit, ...scoreCommit(commit) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function render(range, items, max) {
  const lines = [`# Review pack skeleton: ${range}`, ""];
  if (items.length === 0) {
    lines.push("No risky commits in this range. Nothing to rank; skim `git log --stat` instead.");
    return lines.join("\n");
  }
  const shown = items.slice(0, max);
  lines.push(`Top ${shown.length} of ${items.length} risky commits, riskiest first.`, "");
  shown.forEach((item, index) => {
    lines.push(
      `## ${index + 1}. ${item.subject}`,
      "",
      `\`git show ${item.sha.slice(0, SHORT_SHA_LENGTH)}\``,
      "",
      `files: ${item.files.map(({ file }) => file).join(", ")}`,
      `categories: ${item.categories.join(", ")}`,
      'Questions: <2 or 3 "explain how X handles Y" questions, written by the orchestrator from the diff>',
      "",
    );
  });
  return lines.join("\n");
}

function parseArgs(argv) {
  let range;
  let max = DEFAULT_MAX;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--max") {
      const value = argv[i + 1];
      if (!/^[1-9][0-9]*$/.test(value || "")) {
        throw new UsageError(`--max needs a positive integer, got "${value}"`);
      }
      max = Number(value);
      i += 1;
    } else if (range === undefined) {
      range = argv[i];
    } else {
      throw new UsageError(`unexpected argument "${argv[i]}"`);
    }
  }
  if (range === undefined) {
    throw new UsageError("usage: review-pack.js <base>..<head> [--max N]");
  }
  return { range, max };
}

function main(argv) {
  try {
    const { range, max } = parseArgs(argv);
    process.stdout.write(`${render(range, rank(range), max)}\n`);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`review-pack: ${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { rank, scoreCommit, validateRange, CATEGORIES };
