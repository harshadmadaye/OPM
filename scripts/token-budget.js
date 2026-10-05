#!/usr/bin/env node
'use strict';
// Token budget linter: measures OPM's always-on context cost and fails when it
// passes its ceiling. Zero dependencies; tokens are estimated, not tokenized.
//
// Usage: node scripts/token-budget.js [--json] [--write] [--root <dir>]

const fs = require('fs');
const path = require('path');

const BYTES_PER_TOKEN = 4;
// Ceilings = measured baseline on 2026-10-05 plus 10%, rounded up to the next 50.
const PLUGIN_ALWAYS_ON_CEILING_TOKENS = 2650; // measured 2,379 (0.7.1)
const RULES_COMMON_CEILING_TOKENS = 1550; // measured 1,401
const SKILL_SOFT_CAP_TOKENS = 1200; // fits a 4.5 KB SKILL.md core
// Split skills keep their core under the soft cap as a hard limit; others only warn.
const ENFORCED_SOFT_CAP_SKILLS = ['executing-plans', 'react-patterns', 'python-patterns', 'flutter-patterns'];
const REFERENCES_DIR = 'references';
const LARGEST_SKILLS_SHOWN = 10;

const DOC_RELATIVE_PATH = path.join('docs', 'why-opm.md');
const START_MARKER = '<!-- token-budget:start -->';
const END_MARKER = '<!-- token-budget:end -->';

// Mirrors hooks/scripts/session-start.js (FRONTMATTER and the additionalContext
// wrapper). That script runs on require, so the two values are duplicated here;
// tests/token-budget.test.js compares against the hook's real output.
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const SESSION_PREAMBLE =
  '<opm-plugin>\n' +
  "The OPM plugin is active. Below is the full content of its 'opm:using-opm' skill; " +
  'use the Skill tool for every other opm skill.\n\n';
const SESSION_CLOSING = '\n</opm-plugin>';

const toTokens = (bytes) => Math.ceil(bytes / BYTES_PER_TOKEN);
const byteLength = (text) => Buffer.byteLength(text, 'utf8');
const readText = (file) => fs.readFileSync(file, 'utf8');

function stripFrontmatter(text) {
  return text.replace(FRONTMATTER, '').trim();
}

function sessionStartText(body) {
  return SESSION_PREAMBLE + body + SESSION_CLOSING;
}

function frontmatterField(text, field) {
  const block = text.match(FRONTMATTER);
  if (!block) return '';
  const line = block[0].split(/\r?\n/).find((l) => l.startsWith(`${field}:`));
  return line ? line.slice(field.length + 1).trim() : '';
}

function descriptionBytes(text) {
  return byteLength(frontmatterField(text, 'name')) + byteLength(frontmatterField(text, 'description'));
}

function listSkillFiles(root) {
  const dir = path.join(root, 'skills');
  return fs.readdirSync(dir)
    .map((name) => ({ name, file: path.join(dir, name, 'SKILL.md'), dir: path.join(dir, name) }))
    .filter((skill) => fs.existsSync(skill.file));
}

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(dir, f));
}

function measurePlugin(root, skillTexts) {
  const skillDescriptions = skillTexts.reduce((sum, s) => sum + descriptionBytes(s.text), 0);
  const agentDescriptions = listMarkdown(path.join(root, 'agents'))
    .reduce((sum, file) => sum + descriptionBytes(readText(file)), 0);
  const usingOpm = skillTexts.find((s) => s.name === 'using-opm');
  const sessionStart = usingOpm ? byteLength(sessionStartText(stripFrontmatter(usingOpm.text))) : 0;
  const totalBytes = skillDescriptions + agentDescriptions + sessionStart;
  return { skillDescriptions, agentDescriptions, sessionStart, totalBytes, totalTokens: toTokens(totalBytes) };
}

function measureRulesCommon(root) {
  const files = listMarkdown(path.join(root, 'rules', 'common')).map((file) => {
    const bytes = byteLength(readText(file));
    return { path: path.relative(root, file), bytes, tokens: toTokens(bytes) };
  });
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  return { files, totalBytes, totalTokens: toTokens(totalBytes) };
}

// references/ files load only when a step says to read them, so they are
// reported as on-demand bytes and never counted toward the SKILL.md size.
function referenceBytes(skillDir) {
  return listMarkdown(path.join(skillDir, REFERENCES_DIR))
    .reduce((sum, file) => sum + byteLength(readText(file)), 0);
}

function measureSkills(skillTexts) {
  return skillTexts
    .map(({ name, text, dir }) => {
      const bytes = byteLength(text);
      const tokens = toTokens(bytes);
      return { name, bytes, tokens, referenceBytes: referenceBytes(dir), isOverSoftCap: tokens > SKILL_SOFT_CAP_TOKENS };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

function measure(root) {
  const skillTexts = listSkillFiles(root).map((s) => ({ name: s.name, dir: s.dir, text: readText(s.file) }));
  return {
    plugin: measurePlugin(root, skillTexts),
    rulesCommon: measureRulesCommon(root),
    skills: measureSkills(skillTexts),
  };
}

const DEFAULT_CEILINGS = { plugin: PLUGIN_ALWAYS_ON_CEILING_TOKENS, rulesCommon: RULES_COMMON_CEILING_TOKENS };

function check(report, ceilings = DEFAULT_CEILINGS) {
  const failures = [];
  if (report.plugin.totalTokens > ceilings.plugin) {
    failures.push(`plugin always-on context is ${report.plugin.totalTokens} tokens, over the plugin always-on ceiling of ${ceilings.plugin}`);
  }
  if (report.rulesCommon.totalTokens > ceilings.rulesCommon) {
    failures.push(`rules/common is ${report.rulesCommon.totalTokens} tokens, over the rules/common ceiling of ${ceilings.rulesCommon}`);
  }
  const overCap = report.skills.filter((s) => s.isOverSoftCap);
  const capMessage = (s) => `skill ${s.name} is ${s.tokens} tokens, over the soft cap of ${SKILL_SOFT_CAP_TOKENS}`;
  const isEnforced = (s) => ENFORCED_SOFT_CAP_SKILLS.includes(s.name);
  failures.push(...overCap.filter(isEnforced).map((s) => `${capMessage(s)} (enforced for split skills)`));
  const warnings = overCap.filter((s) => !isEnforced(s)).map(capMessage);
  return { isOk: failures.length === 0, failures, warnings };
}

function renderTable(report, ceilings = DEFAULT_CEILINGS) {
  const { plugin, rulesCommon } = report;
  const largest = report.skills.slice(0, LARGEST_SKILLS_SHOWN)
    .map((s) => `| ${s.name} | ${s.tokens} |`);
  return [
    'Generated by `npm run tokens -- --write`. Token counts are estimated as bytes / 4; no tokenizer.',
    '',
    '| Always-on part | Tokens |',
    '|---|---|',
    `| Skill names and descriptions | ${toTokens(plugin.skillDescriptions)} |`,
    `| Agent names and descriptions | ${toTokens(plugin.agentDescriptions)} |`,
    `| SessionStart injection (using-opm) | ${toTokens(plugin.sessionStart)} |`,
    `| **Plugin total** (ceiling ${ceilings.plugin}) | **${plugin.totalTokens}** |`,
    `| **rules/common total**, where installed (ceiling ${ceilings.rulesCommon}) | **${rulesCommon.totalTokens}** |`,
    '',
    `Skills load only when invoked. The ${LARGEST_SKILLS_SHOWN} largest, soft cap ${SKILL_SOFT_CAP_TOKENS} tokens each:`,
    '',
    '| Skill | Tokens |',
    '|---|---|',
    ...largest,
  ].join('\n');
}

function replaceBlock(doc, block) {
  const start = doc.indexOf(START_MARKER);
  const end = doc.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`markers ${START_MARKER} and ${END_MARKER} not found in order`);
  }
  return doc.slice(0, start + START_MARKER.length) + '\n' + block + '\n' + doc.slice(end);
}

function formatReport(report, result) {
  const lines = [
    `plugin always-on: ${report.plugin.totalTokens} tokens (ceiling ${PLUGIN_ALWAYS_ON_CEILING_TOKENS})`,
    `rules/common:     ${report.rulesCommon.totalTokens} tokens (ceiling ${RULES_COMMON_CEILING_TOKENS})`,
    ...report.skills
      .filter((s) => s.referenceBytes > 0)
      .map((s) => `${s.name}: ${s.referenceBytes} bytes on demand in ${REFERENCES_DIR}/`),
    ...result.warnings.map((w) => `warning: ${w}`),
    ...result.failures.map((f) => `FAIL: ${f}`),
  ];
  return lines.join('\n');
}

function parseArgs(argv) {
  const rootIndex = argv.indexOf('--root');
  const rootArg = rootIndex === -1 ? path.resolve(__dirname, '..') : argv[rootIndex + 1];
  if (!rootArg) throw new Error('--root needs a directory');
  const root = path.resolve(rootArg);
  return { root, isJson: argv.includes('--json'), isWrite: argv.includes('--write') };
}

function writeDoc(root, report) {
  const docPath = path.join(root, DOC_RELATIVE_PATH);
  const doc = readText(docPath);
  fs.writeFileSync(docPath, replaceBlock(doc, renderTable(report)));
}

function main(argv) {
  const { root, isJson, isWrite } = parseArgs(argv);
  const report = measure(root);
  const result = check(report);
  if (isWrite) writeDoc(root, report);
  process.stdout.write((isJson ? JSON.stringify(report, null, 2) : formatReport(report, result)) + '\n');
  return result.isOk ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`token-budget: ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  BYTES_PER_TOKEN,
  PLUGIN_ALWAYS_ON_CEILING_TOKENS,
  RULES_COMMON_CEILING_TOKENS,
  SKILL_SOFT_CAP_TOKENS,
  ENFORCED_SOFT_CAP_SKILLS,
  START_MARKER,
  END_MARKER,
  stripFrontmatter,
  sessionStartText,
  measure,
  check,
  renderTable,
  replaceBlock,
};
