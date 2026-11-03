#!/usr/bin/env node
'use strict';
// Manual behaviour eval: runs the six cases under evals/ through `claude plugin eval`.
// Spends tokens, so it needs --yes and is not part of npm test. Never publishes the report.
//
//   node scripts/evals/behaviour-eval.js --yes [--case <glob>] [--max-cost-usd <usd>]

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RESULTS_DIR = path.join(REPO_ROOT, 'evals', 'results');
const DEFAULT_MAX_COST_USD = 5;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
// Cases edit files and run git/npm in their scratch workspace, so these tools need an operator grant.
const GRANTED_TOOLS = ['Bash', 'Write', 'Edit'];
const COST_WARNING = [
  'behaviour-eval spends tokens: six cases, one run each, each a full headless claude session',
  `plus LLM graders, capped at $${DEFAULT_MAX_COST_USD} by default (--max-cost-usd).`,
  'Re-run with --yes to start, optionally with --case <glob> or --max-cost-usd <usd>.',
].join(' ');

function parseArgs(argv) {
  const options = { yes: false, caseGlob: null, maxCostUsd: DEFAULT_MAX_COST_USD };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--yes') {
      options.yes = true;
    } else if (arg === '--case') {
      if (!argv[i + 1]) throw new Error('--case needs a name glob');
      options.caseGlob = argv[i + 1];
      i += 1;
    } else if (arg === '--max-cost-usd') {
      const cost = Number(argv[i + 1]);
      if (!Number.isFinite(cost) || cost <= 0) throw new Error('--max-cost-usd needs a number above 0');
      options.maxCostUsd = cost;
      i += 1;
    } else {
      throw new Error(`unknown option ${arg}`);
    }
  }
  return options;
}

// The argument array for `claude`, never joined into a shell string.
function buildClaudeArgs(options, resultsPath) {
  const args = [
    'plugin', 'eval', '.',
    '--scaffold', '--trust-plugin', '--runs', '1', '--no-publish',
    '--allow-tools', ...GRANTED_TOOLS,
    '--max-cost-usd', String(options.maxCostUsd),
    '--json', resultsPath,
  ];
  if (options.caseGlob) args.push('--case', options.caseGlob);
  return args;
}

function resultsPathFor(date) {
  return path.join(RESULTS_DIR, `${date.toISOString().slice(0, 10)}.json`);
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`behaviour-eval: ${error.message}`);
    return 1;
  }
  if (!options.yes) {
    console.error(COST_WARNING);
    return 1;
  }
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const resultsPath = resultsPathFor(new Date());
  const result = spawnSync('claude', buildClaudeArgs(options, resultsPath), {
    cwd: REPO_ROOT, stdio: 'inherit', maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.error) {
    console.error(`behaviour-eval: could not run claude: ${result.error.message}`);
    return 1;
  }
  return result.status === null ? 1 : result.status;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { parseArgs, buildClaudeArgs, resultsPathFor, COST_WARNING };
