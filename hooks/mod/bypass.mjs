// Hook-bypass and config-protection checks, in process: the mod twin of
// hooks/scripts/block-no-verify.js and config-protection.js, sharing their
// rules from hooks/lib/bypass-rules.mjs. register.mjs sets OPM_MOD_ACTIVE to the
// session id at session start, which makes those scripts step aside for this
// session only, so each check runs once. A Bash command that bypasses git hooks is denied; an edit to an
// existing linter/formatter/typecheck/hook config asks first, and nobody to
// answer means a deny. A failure of either check denies too.
// OPM_HOOKS_DISABLED=1 turns both off; OPM_ALLOW_CONFIG_EDITS=1 the second.
// A drift guard, not a security boundary: see docs/threat-model.md.

import { bypassDenial, configAskReason, configEditKind, configLookup, findBypass } from '../lib/bypass-rules.mjs';

const ALLOW_EDIT = 'Allow edit';
const CANCEL = 'Cancel';

const errorText = (error) => (error && error.message ? error.message : String(error));

const isHooksDisabled = async ($) => (await $.env.get('OPM_HOOKS_DISABLED')) === '1';

// The file facts configEditKind needs, read only as far as configLookup asks.
async function fileFacts($, lookup, filePath) {
  const exists = await $.fs.exists(filePath);
  const content = lookup === 'content' && exists ? await $.fs.read(filePath) : null;
  return { exists, content };
}

async function checkConfigEdit($, e, next) {
  if (await isHooksDisabled($)) return next(e);
  if ((await $.env.get('OPM_ALLOW_CONFIG_EDITS')) === '1') return next(e);
  const lookup = configLookup(e.file_path);
  if (lookup === null) return next(e);
  const kind = configEditKind(e.tool, e, await fileFacts($, lookup, e.file_path));
  if (!kind) return next(e);
  const reason = configAskReason(e.file_path, kind);
  let answer = null;
  try {
    answer = await $.ui.ask(`${reason} Allow this edit?`, [ALLOW_EDIT, CANCEL]);
  } catch (error) {
    $.ui.log(`opm: config question not answered: ${errorText(error)}`, { to: 'debug' });
  }
  if (answer === ALLOW_EDIT) return next(e);
  return { deny: `${reason} Nobody approved this edit, so it did not run; ask the user before trying again.` };
}

const configCheckFailed = (_$, _e, next) => ({
  deny: `OPM config check failed (${next.error.kind}) and denied this edit to be safe. Retry it; if it fails again, ask the user (OPM_ALLOW_CONFIG_EDITS=1 skips the check).`,
});

export function installBypass(on) {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (await isHooksDisabled($)) return next(e);
    const reason = findBypass(e.command);
    return reason ? { deny: bypassDenial(reason) } : next(e);
  }).catch((_$, _e, next) => ({
    deny: `OPM hook-bypass check failed (${next.error.kind}) and denied this command to be safe. Retry it; if it fails again, ask the user.`,
  }));
  on('tool.call', { tool: 'Edit' }, checkConfigEdit).catch(configCheckFailed);
  on('tool.call', { tool: 'Write' }, checkConfigEdit).catch(configCheckFailed);
}
