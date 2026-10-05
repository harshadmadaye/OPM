'use strict';
// Token budget linter checks. Run with: node --test tests/token-budget.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'token-budget.js');
const budget = require(SCRIPT);

const USING_OPM_BODY = '# Using OPM\n\nFind and invoke skills first.';
const EXTRA_BODY_BYTES = 2000;

function writeFile(root, rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function skillText(name, description, body, eol = '\n') {
  return ['---', `name: ${name}`, `description: ${description}`, '---', '', body, ''].join(eol);
}

function makeFixture({ usingOpmBody = USING_OPM_BODY, crlf = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opm-token-budget-'));
  const eol = crlf ? '\r\n' : '\n';
  writeFile(root, 'skills/using-opm/SKILL.md', skillText('using-opm', 'Start here.', usingOpmBody, eol));
  writeFile(root, 'skills/alpha/SKILL.md', skillText('alpha', 'Alpha skill.', 'a'.repeat(100), eol));
  writeFile(root, 'skills/big/SKILL.md', skillText('big', 'Big skill.', 'b'.repeat(5000), eol));
  writeFile(root, 'agents/reviewer.md', skillText('reviewer', 'Reviews code.', 'Agent body.', eol));
  writeFile(root, 'rules/common/style.md', 'x'.repeat(40));
  writeFile(root, 'rules/common/git.md', 'y'.repeat(41));
  return root;
}

test('measure sums names and descriptions, the injected session text and rules files', () => {
  const report = budget.measure(makeFixture());
  const skillBytes = ['using-opm', 'Start here.', 'alpha', 'Alpha skill.', 'big', 'Big skill.']
    .reduce((sum, s) => sum + Buffer.byteLength(s), 0);
  assert.equal(report.plugin.skillDescriptions, skillBytes);
  assert.equal(report.plugin.agentDescriptions, Buffer.byteLength('reviewer') + Buffer.byteLength('Reviews code.'));
  assert.equal(report.plugin.sessionStart, Buffer.byteLength(budget.sessionStartText(USING_OPM_BODY)));
  const total = report.plugin.skillDescriptions + report.plugin.agentDescriptions + report.plugin.sessionStart;
  assert.equal(report.plugin.totalBytes, total);
  assert.equal(report.plugin.totalTokens, Math.ceil(total / budget.BYTES_PER_TOKEN));
  assert.equal(report.rulesCommon.totalBytes, 81);
  assert.equal(report.rulesCommon.totalTokens, 21);
  const git = report.rulesCommon.files.find((f) => f.path.endsWith('git.md'));
  assert.deepEqual({ bytes: git.bytes, tokens: git.tokens }, { bytes: 41, tokens: 11 });
  assert.deepEqual(report.skills.map((s) => s.name), ['big', 'alpha', 'using-opm']);
});

test('CRLF frontmatter measures the same as LF', () => {
  const lf = budget.measure(makeFixture());
  const crlf = budget.measure(makeFixture({ crlf: true }));
  assert.equal(crlf.plugin.skillDescriptions, lf.plugin.skillDescriptions);
  assert.equal(crlf.plugin.agentDescriptions, lf.plugin.agentDescriptions);
  assert.ok(!budget.sessionStartText(budget.stripFrontmatter('---\r\nname: x\r\n---\r\nBody')).includes('name: x'));
});

test('the session preamble matches what the SessionStart hook injects', () => {
  const output = execFileSync('node', [path.join(ROOT, 'hooks', 'scripts', 'session-start.js')], {
    input: '{}', env: { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT, OPM_HOOKS_DISABLED: '' },
  }).toString();
  const injected = JSON.parse(output).hookSpecificOutput.additionalContext;
  const usingOpm = fs.readFileSync(path.join(ROOT, 'skills', 'using-opm', 'SKILL.md'), 'utf8');
  assert.equal(budget.sessionStartText(budget.stripFrontmatter(usingOpm)), injected);
});

test('a using-opm body 2,000 bytes larger than the ceiling allows fails naming the plugin ceiling', () => {
  const base = budget.measure(makeFixture());
  const ceilings = { plugin: base.plugin.totalTokens, rulesCommon: base.rulesCommon.totalTokens };
  assert.equal(budget.check(base, ceilings).isOk, true);
  const grown = budget.measure(makeFixture({ usingOpmBody: USING_OPM_BODY + 'z'.repeat(EXTRA_BODY_BYTES) }));
  const result = budget.check(grown, ceilings);
  assert.equal(result.isOk, false);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /plugin always-on ceiling/);
});

test('rules/common over its ceiling fails', () => {
  const report = budget.measure(makeFixture());
  const result = budget.check(report, { plugin: report.plugin.totalTokens, rulesCommon: 1 });
  assert.equal(result.isOk, false);
  assert.match(result.failures[0], /rules\/common ceiling/);
});

test('a skill over the soft cap is a warning, never a failure', () => {
  const report = budget.measure(makeFixture());
  const big = report.skills.find((s) => s.name === 'big');
  assert.equal(big.isOverSoftCap, true);
  const result = budget.check(report, { plugin: Infinity, rulesCommon: Infinity });
  assert.equal(result.isOk, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /big/);
});

const ENFORCED_SKILL = 'executing-plans';
const GROWN_SKILL_BYTES = 4800;
const CORE_SKILL_BYTES = 4000;
const REFERENCE_BYTES = 3000;

function writeSkillOfSize(root, name, totalBytes) {
  const empty = skillText(name, 'Split skill.', '');
  writeFile(root, `skills/${name}/SKILL.md`, skillText(name, 'Split skill.', 'e'.repeat(totalBytes - Buffer.byteLength(empty))));
}

test('the soft cap is 1,200 tokens and is enforced for the four split skills', () => {
  assert.equal(budget.SKILL_SOFT_CAP_TOKENS, 1200);
  assert.deepEqual(budget.ENFORCED_SOFT_CAP_SKILLS,
    ['executing-plans', 'react-patterns', 'python-patterns', 'flutter-patterns']);
});

test('an enforced skill grown past 4,800 bytes fails check(), naming the skill', () => {
  const root = makeFixture();
  writeSkillOfSize(root, ENFORCED_SKILL, GROWN_SKILL_BYTES + 1);
  const result = budget.check(budget.measure(root), { plugin: Infinity, rulesCommon: Infinity });
  assert.equal(result.isOk, false);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /executing-plans.*soft cap of 1200/);
  assert.ok(!result.warnings.some((w) => w.includes(ENFORCED_SKILL)));
});

test('an enforced skill within the cap passes even with large references', () => {
  const root = makeFixture();
  writeSkillOfSize(root, ENFORCED_SKILL, CORE_SKILL_BYTES);
  writeFile(root, `skills/${ENFORCED_SKILL}/references/brief.md`, 'r'.repeat(REFERENCE_BYTES));
  writeFile(root, `skills/${ENFORCED_SKILL}/references/review.md`, 'q'.repeat(REFERENCE_BYTES));
  const report = budget.measure(root);
  const skill = report.skills.find((s) => s.name === ENFORCED_SKILL);
  assert.equal(skill.bytes, CORE_SKILL_BYTES);
  assert.equal(skill.referenceBytes, 2 * REFERENCE_BYTES);
  assert.equal(skill.isOverSoftCap, false);
  assert.equal(budget.check(report, { plugin: Infinity, rulesCommon: Infinity }).isOk, true);
  assert.equal(report.skills.find((s) => s.name === 'alpha').referenceBytes, 0);
});

test('the text report lists on-demand reference bytes per skill', () => {
  const root = makeFixture();
  writeSkillOfSize(root, ENFORCED_SKILL, CORE_SKILL_BYTES);
  writeFile(root, `skills/${ENFORCED_SKILL}/references/brief.md`, 'r'.repeat(REFERENCE_BYTES));
  const run = spawnSync('node', [SCRIPT, '--root', root]);
  assert.match(run.stdout.toString(), /executing-plans: 3000 bytes on demand in references\//);
  assert.ok(!run.stdout.toString().includes('alpha: 0 bytes'));
});

test('renderTable carries the method note, both totals and the largest skills', () => {
  const report = budget.measure(makeFixture());
  const table = budget.renderTable(report);
  assert.match(table, /estimated as bytes \/ 4; no tokenizer/);
  assert.ok(table.includes(String(report.plugin.totalTokens)));
  assert.ok(table.includes(String(report.rulesCommon.totalTokens)));
  assert.ok(table.includes('| big |'));
});

test('replaceBlock swaps only the marked block and errors without markers', () => {
  const doc = `# Doc\n\nbefore\n\n${budget.START_MARKER}\nold\n${budget.END_MARKER}\n\nafter\n`;
  const next = budget.replaceBlock(doc, 'new table');
  assert.equal(next, `# Doc\n\nbefore\n\n${budget.START_MARKER}\nnew table\n${budget.END_MARKER}\n\nafter\n`);
  assert.equal(budget.replaceBlock(next, 'new table'), next);
  assert.throws(() => budget.replaceBlock('# no markers', 'x'), /token-budget:start/);
});

test('--write replaces only the marked block in docs/why-opm.md', () => {
  const root = makeFixture();
  writeFile(root, 'docs/why-opm.md', `intro\n${budget.START_MARKER}\nstale\n${budget.END_MARKER}\noutro\n`);
  const run = spawnSync('node', [SCRIPT, '--write', '--root', root]);
  assert.equal(run.status, 0, run.stderr.toString());
  const written = fs.readFileSync(path.join(root, 'docs', 'why-opm.md'), 'utf8');
  assert.ok(written.startsWith(`intro\n${budget.START_MARKER}\n`));
  assert.ok(written.endsWith(`${budget.END_MARKER}\noutro\n`));
  assert.ok(!written.includes('stale'));
  assert.ok(written.includes('no tokenizer'));
});

test('--write without markers exits non-zero with a clear message', () => {
  const root = makeFixture();
  writeFile(root, 'docs/why-opm.md', 'no markers here\n');
  const run = spawnSync('node', [SCRIPT, '--write', '--root', root]);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr.toString(), /token-budget:start/);
});

test('the real repo stays within its token ceilings', () => {
  const result = budget.check(budget.measure(ROOT));
  assert.equal(result.isOk, true, result.failures.join('\n'));
});
