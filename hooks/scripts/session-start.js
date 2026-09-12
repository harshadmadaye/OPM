'use strict';
// OPM SessionStart hook (matcher: startup|clear|compact).
// Injects the using-opm skill (frontmatter stripped) as additionalContext so
// every session starts knowing how the plugin's skills and rules fit together.
// Outputs nothing when the skill file is missing.

if (process.env.OPM_HOOKS_DISABLED === '1') process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const SKILL_RELATIVE_PATH = path.join('skills', 'using-opm', 'SKILL.md');
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

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

readStdin(() => {
  try {
    const body = loadSkillBody();
    if (!body) return;
    const additionalContext =
      '<opm-plugin>\n' +
      "The OPM plugin is active. Below is the full content of its 'opm:using-opm' skill; " +
      'use the Skill tool for every other opm skill.\n\n' +
      body +
      '\n</opm-plugin>';
    const output = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } };
    process.stdout.write(JSON.stringify(output) + '\n');
  } catch {
    // Context injection is best effort; never fail session start.
  }
});

// Adapted from obra/superpowers (MIT)
