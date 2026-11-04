// Drives Playwright: screenshots per viewport, console errors, overflow, optional axe-core.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { browsersPath } from './install.mjs';

export const VIEWPORTS = Object.freeze([{ width: 375, height: 812 }, { width: 1280, height: 800 }]);
export const OVERFLOW_PROBE_WIDTH = 320;
const OVERFLOW_PROBE_HEIGHT = 640;
const NAV_TIMEOUT_MS = 30000;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

export const viewportLabel = ({ width, height }) => `${width}x${height}`;

export async function loadPlaywright(selection) {
  if (selection.source === 'project') {
    const mod = await import(pathToFileURL(selection.modulePath).href);
    return mod.default ?? mod;
  }
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath(selection.toolsDir);
  const mod = await import(pathToFileURL(path.join(selection.toolsDir, 'node_modules', 'playwright', 'index.js')).href);
  return mod.default ?? mod;
}

export function axeSourceFor(selection, cwd) {
  const file = selection.source === 'project'
    ? resolveOrNull(createRequire(path.join(cwd, 'package.json')), 'axe-core/axe.min.js')
    : path.join(selection.toolsDir, 'node_modules', 'axe-core', 'axe.min.js');
  return file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function resolveOrNull(projectRequire, request) {
  try {
    return projectRequire.resolve(request);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return null;
    throw error;
  }
}

const hasOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

async function runAxe(page, axeSource) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (tags) => {
    const result = await window.axe.run(document, { runOnly: tags });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
  }, AXE_TAGS);
}

async function captureViewport(browser, { url, outDir, viewport, axeSource }) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
    const screenshot = path.join(outDir, `${viewportLabel(viewport)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      viewport: viewportLabel(viewport),
      screenshot,
      consoleErrors,
      horizontalOverflow: await hasOverflow(page),
      axe: axeSource ? await runAxe(page, axeSource) : 'unavailable',
    };
  } finally {
    await page.close();
  }
}

async function probeOverflow(browser, url) {
  const page = await browser.newPage({ viewport: { width: OVERFLOW_PROBE_WIDTH, height: OVERFLOW_PROBE_HEIGHT } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
    return await hasOverflow(page);
  } finally {
    await page.close();
  }
}

export async function capture({ playwright, url, outDir, axeSource }) {
  const browser = await playwright.chromium.launch();
  try {
    const results = [];
    for (const viewport of VIEWPORTS) results.push(await captureViewport(browser, { url, outDir, viewport, axeSource }));
    return { results, probe: await probeOverflow(browser, url) };
  } finally {
    await browser.close();
  }
}
