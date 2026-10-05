// OPM's hooks module (Claude Code mods, 2.1.287+). Older Claude Code ignores
// "modules" in hooks.json and keeps running the settings hooks beside it.
//
// The engine allows one unmatched session.start hook per module, so this file
// owns it. The engine's validator never follows $ across an import, so a
// feature cannot take $ in a setup function: each feature exports the slash
// commands it serves as data, this file registers them, and the feature adds
// its own hooks in install(on). A command that fails to register must not
// stop the others.

import { statusCommands, installStatus } from './status.mjs';
import { installBypass } from './bypass.mjs';
import { installGuard } from './guard.mjs';
import { meterCommands, installMeter } from './meter.mjs';

const FEATURE_COMMANDS = [...statusCommands, ...meterCommands];

const errorText = (error) => (error && error.message ? error.message : String(error));

export const register = (on) => {
  on('session.start', async ($, e, next) => {
    // Tells the settings-hook scripts (child processes) that the mod runs the
    // same checks in process, so they exit early instead of firing twice. The
    // value is this session's id, so a nested Claude Code that inherits the
    // variable (another session) keeps running its own checks.
    try {
      await $.env.set('OPM_MOD_ACTIVE', await $.session.id());
    } catch (error) {
      $.ui.log(`opm: could not set OPM_MOD_ACTIVE: ${errorText(error)}`, { to: 'debug' });
    }
    for (const command of FEATURE_COMMANDS) {
      try {
        await $.command.register(command);
      } catch (error) {
        $.ui.log(`opm: could not register /${command.name}: ${errorText(error)}`, { to: 'debug' });
      }
    }
    return next(e);
  });
  installStatus(on);
  installBypass(on);
  installGuard(on);
  installMeter(on);
};
