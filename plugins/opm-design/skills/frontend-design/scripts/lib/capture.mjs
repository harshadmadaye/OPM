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
export const IDLE_GRACE_MS = 3000;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

export const viewportLabel = ({ width, height }) => `${width}x${height}`;

// Where PLAYWRIGHT_BROWSERS_PATH should point, or null to leave the environment alone.
// A home install always owns its browsers; an OPM_DESIGN_TOOLS folder only fills a gap.
export function browsersPathFor(selection, env = process.env, exists = fs.existsSync) {
  if (selection.source === 'home') return browsersPath(selection.toolsDir);
  if (selection.source !== 'env' || env.PLAYWRIGHT_BROWSERS_PATH) return null;
  const candidate = browsersPath(selection.toolsDir);
  return exists(candidate) ? candidate : null;
}

export async function loadPlaywright(selection) {
  if (selection.source === 'project') {
    return assertChromium(await import(pathToFileURL(selection.modulePath).href), selection.modulePath);
  }
  const browsers = browsersPathFor(selection);
  if (browsers) process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
  const modulePath = path.join(selection.toolsDir, 'node_modules', 'playwright', 'index.js');
  return assertChromium(await import(pathToFileURL(modulePath).href), modulePath);
}

function assertChromium(mod, modulePath) {
  const playwright = mod.default ?? mod;
  if (typeof playwright?.chromium?.launch !== 'function') throw new Error(`${modulePath} does not export chromium; install playwright`);
  return playwright;
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

const HTTP_ERROR_STATUS = 400;

// A null response happens for file:// pages and is allowed.
function assertPageLoaded(response, url) {
  if (response && response.status() >= HTTP_ERROR_STATUS) throw new Error(`${url} answered HTTP ${response.status()}; the page did not render`);
}

// Pages with SSE or long-poll never go network-idle, so wait for load and give idle a short grace.
export async function gotoSettled(page, url) {
  const response = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
  try {
    await page.waitForLoadState('networkidle', { timeout: IDLE_GRACE_MS });
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
  }
  return response;
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
  const page = await browser.newPage({ viewport, bypassCSP: true });
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  try {
    assertPageLoaded(await gotoSettled(page, url), url);
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
  const page = await browser.newPage({ viewport: { width: OVERFLOW_PROBE_WIDTH, height: OVERFLOW_PROBE_HEIGHT }, bypassCSP: true });
  try {
    assertPageLoaded(await gotoSettled(page, url), url);
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
