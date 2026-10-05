'use strict';
// OPM SessionStart hook (matcher: startup|clear|compact).
// Injects the using-opm skill (frontmatter stripped) as additionalContext so
// every session starts knowing how the plugin's skills and rules fit together,
// plus one resume line when the session's repo has an open plan ledger.
// Outputs nothing when the skill file is missing.

if (process.env.OPM_HOOKS_DISABLED === '1') process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const SKILL_RELATIVE_PATH = path.join('skills', 'using-opm', 'SKILL.md');
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
// Shared with `npx opm-core status`, so the resume line and the CLI agree.
const STATUS_MODULE = path.resolve(__dirname, '..', '..', 'bin', 'status.js');

function readStdin(cb) {
  let data = '';
  let done = false;
  const finish = () => { if (done) return; done = true; clearTimeout(timer); cb(data); };
  const timer = setTimeout(() => { process.stdin.destroy(); finish(); }, STDIN_TIMEOUT_MS);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    if (data.length < MAX_STDIN) data += chunk.slice(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', finish);
  process.stdin.on('error', finish);
  process.stdin.on('close', finish);
}

function pluginRoot() {
  const fromEnv = process.env.CLAUDE_PLUGIN_ROOT;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return path.resolve(__dirname, '..', '..');
}

function loadSkillBody() {
  const skillPath = path.join(pluginRoot(), SKILL_RELATIVE_PATH);
  if (!fs.existsSync(skillPath)) return null;
  const body = fs.readFileSync(skillPath, 'utf8').replace(FRONTMATTER, '').trim();
  return body || null;
}

// The session's working directory: stdin `cwd` when given, else this process's.
function sessionCwd(raw) {
  try {
    const input = JSON.parse(raw);
    if (input && typeof input.cwd === 'string' && input.cwd.trim()) return input.cwd;
  } catch {
    // Malformed stdin is not ours to report; fall back to process.cwd().
  }
  return process.cwd();
}

// One line naming an open plan ledger in cwd, or null. Never throws.
async function resumeLine(cwd) {
  try {
    const status = require(STATUS_MODULE);
    const parser = await status.loadParser();
    const found = await status.findOpenLedger(cwd, parser);
    return found ? parser.formatResumeLine(found) : null;
  } catch {
    // Fail-safe by design: any ledger problem leaves the context exactly as before.
    return null;
  }
}

function writeContext(body, resume) {
  const additionalContext =
    '<opm-plugin>\n' +
    "The OPM plugin is active. Below is the full content of its 'opm:using-opm' skill; " +
    'use the Skill tool for every other opm skill.\n\n' +
    body +
    (resume ? `\n\n${resume}` : '') +
    '\n</opm-plugin>';
  const output = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } };
  process.stdout.write(JSON.stringify(output) + '\n');
}

readStdin(async (raw) => {
  try {
    const body = loadSkillBody();
    if (!body) return;
    writeContext(body, await resumeLine(sessionCwd(raw)));
  } catch {
    // Context injection is best effort; never fail session start.
  }
});

// Adapted from obra/superpowers (MIT)
