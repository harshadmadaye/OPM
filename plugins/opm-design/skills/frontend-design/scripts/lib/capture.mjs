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
    return assertChromium(await import(pathToFileURL(selection.modulePath).href), selection.modulePath);
  }
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath(selection.toolsDir);
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
    assertPageLoaded(await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS }), url);
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
    assertPageLoaded(await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS }), url);
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
