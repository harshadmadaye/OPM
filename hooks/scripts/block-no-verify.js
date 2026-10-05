'use strict';
// OPM PreToolUse hook (matcher: Bash).
// Denies git commands that bypass commit/push hooks: --no-verify (and -n on
// commit), -c core.hooksPath=<anything>, git config writes to core.hooksPath,
// and HUSKY=0 style env bypasses. Only real invocations count: git must sit in
// command position, and heredoc bodies, echo/printf arguments and quoted
// strings that merely mention these words pass. The rules live in
// hooks/lib/bypass-rules.mjs, shared with the mod; when the mod is running
// (OPM_MOD_ACTIVE=1, set by hooks/mod/register.mjs) it runs them in process
// and this script steps aside. See docs/threat-model.md.
// Everything else is allowed silently. Never throws; exits 0 on internal error.

if (process.env.OPM_HOOKS_DISABLED === '1' || process.env.OPM_MOD_ACTIVE === '1') process.exit(0);
process.on('uncaughtException', () => process.exit(0));

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;

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

function deny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(output) + '\n');
}

readStdin(async (raw) => {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    const command = input && input.tool_input && input.tool_input.command;
    if (typeof command !== 'string' || !command.includes('git')) return;
    const { findBypass, bypassDenial } = await import('../lib/bypass-rules.mjs');
    const reason = findBypass(command);
    if (reason) deny(bypassDenial(reason));
  } catch {
    // Malformed input or internal error: never block the user.
  }
});

// Adapted from affaan-m/ecc (MIT)
