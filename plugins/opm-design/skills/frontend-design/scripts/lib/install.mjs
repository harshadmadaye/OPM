// Installs pinned Playwright, axe-core and Chromium into one folder. Called only after the user said yes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PINNED_VERSIONS } from './tool-ladder.mjs';

const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const TO_STDERR = ['ignore', 2, 2];

export const browsersPath = (toolsDir) => path.join(toolsDir, 'browsers');

function runStep(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: TO_STDERR, timeout: INSTALL_TIMEOUT_MS, ...options });
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
}

export function installTools(toolsDir) {
  fs.mkdirSync(toolsDir, { recursive: true });
  runStep('npm', [
    'install', '--prefix', toolsDir, '--no-audit', '--no-fund',
    `playwright@${PINNED_VERSIONS.playwright}`, `axe-core@${PINNED_VERSIONS.axeCore}`,
  ], { shell: process.platform === 'win32' });
  runStep(process.execPath, [path.join(toolsDir, 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium'], {
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath(toolsDir) },
  });
}
