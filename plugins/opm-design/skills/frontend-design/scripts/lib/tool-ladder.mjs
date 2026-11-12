// Picks how visual QA runs. First available wins: OPM_DESIGN_TOOLS, the project's own
// Playwright, an earlier consented install, a Playwright MCP server, a consented install, manual.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

export const PINNED_VERSIONS = Object.freeze({ playwright: '1.48.2', axeCore: '4.10.2' });
export const DEFAULT_TOOLS_DIR = path.join(os.homedir(), '.opm', 'design-tools');
export const DOWNLOAD_NOTE = 'about 150 MB (Playwright, axe-core and Chromium)';
export const INSTALL_MARKER = '.opm-installed';
const PROJECT_MODULES = Object.freeze(['playwright', '@playwright/test']);
const NOT_FOUND_CODES = new Set(['MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED']);

export function hasInstall(dir, exists = fs.existsSync) {
  return Boolean(dir) && exists(path.join(dir, 'node_modules', 'playwright', 'package.json'));
}

// The home install counts only when the installer finished (marker written after the browser step).
export const hasCompleteInstall = (dir, exists = fs.existsSync) => Boolean(dir) && exists(path.join(dir, INSTALL_MARKER));

export function projectResolver(cwd) {
  const projectRequire = createRequire(path.join(cwd, 'package.json'));
  return (name) => {
    try {
      return projectRequire.resolve(name);
    } catch (error) {
      if (NOT_FOUND_CODES.has(error.code)) return null;
      throw error;
    }
  };
}

export function selectTool({ env = {}, flags = {}, resolveInProject = () => null, exists = fs.existsSync, toolsDir = DEFAULT_TOOLS_DIR }) {
  if (flags.manual) return { mode: 'manual', reason: 'manual mode requested' };
  if (hasInstall(env.OPM_DESIGN_TOOLS, exists)) return { mode: 'playwright', source: 'env', toolsDir: env.OPM_DESIGN_TOOLS };
  for (const name of PROJECT_MODULES) {
    const modulePath = resolveInProject(name);
    if (modulePath) return { mode: 'playwright', source: 'project', modulePath };
  }
  if (hasCompleteInstall(toolsDir, exists)) return { mode: 'playwright', source: 'home', toolsDir };
  if (flags.mcp) return { mode: 'mcp' };
  if (flags.install) return { mode: 'install', toolsDir };
  return { mode: 'needs-consent', toolsDir };
}
