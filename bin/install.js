#!/usr/bin/env node
'use strict';
// `npx opm-core@latest` — installs the OPM plugin into Claude Code and copies
// the rules into a repository. Dependency-free, like everything else here.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const MARKETPLACE = 'harshadmadaye/OPM';
const MARKETPLACE_NAME = 'opm';
const PLUGIN_ID = 'opm@opm';
const LANGUAGES = ['typescript', 'react', 'python', 'dart'];

const bold = (s) => `\u001b[1m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const yellow = (s) => `\u001b[33m${s}\u001b[0m`;

function parseArgs(argv) {
  const options = { rules: null, plugin: true, rulesOnly: false, yes: false, target: process.cwd(), help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '-y' || arg === '--yes') options.yes = true;
    else if (arg === '--plugin-only') options.rules = [];
    else if (arg === '--rules-only') { options.rulesOnly = true; options.plugin = false; }
    else if (arg === '--no-plugin') options.plugin = false;
    else if (arg === '--rules') {
      const value = argv[++i];
      if (!value) throw new Error('--rules needs a comma-separated list, for example --rules typescript,react');
      options.rules = value.split(',').map((s) => s.trim()).filter(Boolean);
      const unknown = options.rules.filter((l) => !LANGUAGES.includes(l));
      if (unknown.length) throw new Error(`unknown language: ${unknown.join(', ')}. Available: ${LANGUAGES.join(', ')}`);
    } else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    else options.target = path.resolve(arg);
  }
  return options;
}

const USAGE = `${bold('opm-core')} — install the OPM engineering workflow for Claude Code

  npx opm-core@latest [options] [target repo]

Options
  --rules <langs>   Copy rules without asking. ${LANGUAGES.join(', ')}
  --plugin-only     Install the plugin, skip the rules
  --rules-only      Copy the rules, skip the plugin
  --yes, -y         Take the defaults, ask nothing
  --help, -h        This message

With no options it installs the plugin and asks which rules you want for the
current directory.`;

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: result.status === 0, out: `${result.stdout || ''}${result.stderr || ''}`.trim(), missing: result.error && result.error.code === 'ENOENT' };
}

function claudeVersion() {
  const result = run('claude', ['--version']);
  return result.ok ? result.out.split('\n')[0] : null;
}

// Returns the marketplace source Claude Code currently has for `opm`, or null.
function currentMarketplaceSource(listOutput) {
  const lines = listOutput.split('\n');
  const index = lines.findIndex((l) => l.trim().replace(/^[^\w]*/, '') === MARKETPLACE_NAME);
  if (index === -1) return null;
  const sourceLine = lines.slice(index + 1, index + 3).find((l) => l.includes('Source:'));
  if (!sourceLine) return null;
  const match = sourceLine.match(/\(([^)]+)\)/);
  return match ? match[1] : sourceLine.split('Source:')[1].trim();
}

function installPlugin(log) {
  const version = claudeVersion();
  if (!version) {
    log(yellow('  Claude Code is not on your PATH, so the plugin step was skipped.'));
    log(`  Install it from https://claude.com/claude-code, then run:`);
    log(dim(`    claude plugin marketplace add ${MARKETPLACE}`));
    log(dim(`    claude plugin install ${PLUGIN_ID}`));
    return false;
  }
  log(dim(`  Found ${version}`));

  const list = run('claude', ['plugin', 'marketplace', 'list']);
  const existing = list.ok ? currentMarketplaceSource(list.out) : null;
  if (existing && !existing.includes(MARKETPLACE)) {
    log(`  Replacing the ${MARKETPLACE_NAME} marketplace, which pointed at ${existing}`);
    run('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME]);
  }

  if (!existing || !existing.includes(MARKETPLACE)) {
    const added = run('claude', ['plugin', 'marketplace', 'add', MARKETPLACE]);
    if (!added.ok) {
      log(yellow(`  Could not add the marketplace:\n${added.out}`));
      return false;
    }
  }

  const installed = run('claude', ['plugin', 'install', PLUGIN_ID]);
  if (!installed.ok && !/already installed/i.test(installed.out)) {
    log(yellow(`  Could not install the plugin:\n${installed.out}`));
    return false;
  }
  log(green('  Plugin installed.'));
  return true;
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) count += copyDir(src, dest);
    else { fs.copyFileSync(src, dest); count++; }
  }
  return count;
}

function installRules(target, languages, rulesRoot, log) {
  if (!fs.existsSync(target)) throw new Error(`target is not a directory: ${target}`);
  const dest = path.join(target, '.claude', 'rules', 'opm');
  const wanted = ['common', ...languages];
  let files = 0;
  for (const name of wanted) {
    const from = path.join(rulesRoot, name);
    if (!fs.existsSync(from)) { log(yellow(`  No rules for ${name}, skipped.`)); continue; }
    files += copyDir(from, path.join(dest, name));
  }
  const relative = path.relative(process.cwd(), dest);
  const shown = !relative || relative.startsWith('..') ? dest : relative;
  log(green(`  ${files} rule files copied to ${shown}`));
  return files;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function chooseLanguages(target) {
  const guess = [];
  const has = (f) => fs.existsSync(path.join(target, f));
  if (has('package.json')) {
    guess.push('typescript');
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react || deps.next) guess.push('react');
    } catch { /* an unreadable package.json just means no guess */ }
  }
  if (has('pyproject.toml') || has('requirements.txt')) guess.push('python');
  if (has('pubspec.yaml')) guess.push('dart');

  const suggestion = guess.length ? guess.join(',') : 'none';
  const answer = await ask(`  Which rules for this repo? ${dim(`[${LANGUAGES.join(', ')}]`)}\n  Enter to accept ${bold(suggestion)}, or type a comma-separated list: `);
  if (!answer) return guess;
  if (answer.toLowerCase() === 'none') return [];
  return answer.split(',').map((s) => s.trim()).filter((s) => LANGUAGES.includes(s));
}

async function main(argv) {
  const options = parseArgs(argv);
  const log = console.log;
  if (options.help) { log(USAGE); return 0; }

  const rulesRoot = path.join(__dirname, '..', 'rules');
  log('');
  log(bold('OPM') + dim(' — an opinionated engineering workflow for Claude Code'));
  log('');

  if (options.plugin) {
    log(bold('Plugin'));
    installPlugin(log);
    log('');
  }

  let languages = options.rules;
  if (languages === null) {
    if (options.yes) languages = [];
    else { log(bold('Rules') + dim(` — copied into ${options.target}`)); languages = await chooseLanguages(options.target); }
  }

  if (languages.length || options.rulesOnly) {
    if (!options.rules && !options.rulesOnly) log('');
    else log(bold('Rules'));
    installRules(options.target, languages, rulesRoot, log);
    log('');
  }

  log(bold('Next'));
  log('  Start Claude Code and describe what you want to build.');
  log(dim('  /opm:brainstorming   design it before writing code'));
  log(dim('  /opm:brew-idea       four agents argue the idea out first'));
  log(dim('  /opm:jump-start      a whole new project from one prompt'));
  log('');
  log(dim('  Docs: https://github.com/harshadmadaye/OPM'));
  log('');
  return 0;
}

module.exports = { parseArgs, currentMarketplaceSource, installRules, copyDir, LANGUAGES, USAGE };

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch((error) => { console.error(`error: ${error.message}`); process.exitCode = 1; });
}
