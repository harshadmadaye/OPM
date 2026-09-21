'use strict';
// CLI: screenshot each slide HTML file into a 1920x1080 PNG with a headless
// Chromium-family browser. Usage: node render-frames.js <storyDir> [--dry-run]
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { storyPaths, sceneFile, findBrowser } = require('./lib/paths');
const { readPngSize } = require('./lib/png');
const { loadManifest, saveManifest, isFresh, record, inputs } = require('./lib/manifest');
const { WIDTH, HEIGHT } = require('./lib/constants');

const SCENE_FILE_RE = /^scene-(\d\d)\.html$/;
const DEFAULT_TIMEOUT_MS = 40000;
const DEFAULT_SETTLE_MS = 1000;
const DEFAULT_POLL_MS = 500;
const EXIT_WAIT_MS = 2000;
const REMOVE_ATTEMPTS = 5;
const REMOVE_RETRY_DELAY_MS = 100;

function chromeArgs({ userDataDir, pngPath, htmlPath }) {
  return [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1920,1080',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    `--screenshot=${pngPath}`,
    pathToFileURL(htmlPath).href,
  ];
}

function listSlides(dir) {
  return fs
    .readdirSync(dir)
    .map((name) => name.match(SCENE_FILE_RE))
    .filter(Boolean)
    .map((match) => ({ id: match[1], htmlPath: path.join(dir, match[0]) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pngReady(pngPath) {
  if (!fs.existsSync(pngPath)) return false;
  return fs.statSync(pngPath).size > 0;
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    child.once('exit', finish);
  });
}

// Chrome is known not to release its profile directory the instant it exits,
// especially on Windows, so give it a bounded wait plus a few short retries
// before giving up on the remove.
async function removeProfileDir(userDataDir) {
  for (let attempt = 1; attempt <= REMOVE_ATTEMPTS; attempt += 1) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === REMOVE_ATTEMPTS) throw err;
      await sleep(REMOVE_RETRY_DELAY_MS);
    }
  }
}

async function cleanup(child, userDataDir) {
  const exited = waitForExit(child, EXIT_WAIT_MS);
  if (!child.killed) child.kill();
  await exited;
  await removeProfileDir(userDataDir);
}

function renderFrame({
  browser,
  htmlPath,
  pngPath,
  userDataDir,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  settleMs = DEFAULT_SETTLE_MS,
  pollMs = DEFAULT_POLL_MS,
  spawn = childProcess.spawn,
}) {
  const basename = path.basename(htmlPath);
  fs.rmSync(pngPath, { force: true });

  return new Promise((resolve, reject) => {
    const child = spawn(browser, chromeArgs({ userDataDir, pngPath, htmlPath }), { stdio: 'ignore' });
    let settled = false;

    const fail = async (err) => {
      if (settled) return;
      settled = true;
      await cleanup(child, userDataDir);
      reject(err);
    };

    child.on('error', (err) => {
      fail(new Error(`${basename}: cannot start browser: ${err.message}`));
    });

    const deadline = Date.now() + timeoutMs;

    const poll = async () => {
      while (!settled) {
        if (pngReady(pngPath)) break;
        if (Date.now() >= deadline) {
          fail(new Error(`${basename}: no frame after ${timeoutMs} ms`));
          return;
        }
        await sleep(pollMs);
      }
      if (settled) return;

      await sleep(settleMs);
      if (settled) return;

      settled = true;
      await cleanup(child, userDataDir);

      let size;
      try {
        size = readPngSize(fs.readFileSync(pngPath));
      } catch (err) {
        reject(new Error(`${basename}: ${err.message}`));
        return;
      }
      if (size.width !== WIDTH || size.height !== HEIGHT) {
        reject(new Error(`${basename}: frame is ${size.width}x${size.height}, expected ${WIDTH}x${HEIGHT}`));
        return;
      }
      resolve(size);
    };

    poll();
  });
}

function dryRun(storyDir, log) {
  const paths = storyPaths(storyDir);
  const slides = listSlides(paths.slides);
  slides.forEach(({ id, htmlPath }) => {
    const userDataDir = path.join(os.tmpdir(), `opm-story-chrome-${process.pid}-${id}`);
    const pngPath = sceneFile(paths.frames, id, 'png');
    const args = chromeArgs({ userDataDir, pngPath, htmlPath });
    log(JSON.stringify({ scene: id, args }));
  });
}

async function renderAll(storyDir, { log = console.log } = {}) {
  const paths = storyPaths(storyDir);
  const browser = findBrowser({});
  if (!browser) {
    throw new Error('no Chromium-family browser found. Looked for Chrome, Chromium, Edge and Brave; set CHROME_PATH to override.');
  }

  const slides = listSlides(paths.slides);
  const css = fs.readFileSync(paths.css, 'utf8');
  fs.mkdirSync(paths.frames, { recursive: true });

  let manifest = loadManifest(paths.manifest);

  for (const { id, htmlPath } of slides) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const pngPath = sceneFile(paths.frames, id, 'png');
    const key = `frame:${id}`;
    const hash = inputs.frame(html, css);

    if (isFresh(manifest, key, hash, pngPath, fs.existsSync)) {
      log(`fresh scene-${id}.png`);
      continue;
    }

    const userDataDir = path.join(os.tmpdir(), `opm-story-chrome-${process.pid}-${id}`);
    await renderFrame({ browser, htmlPath, pngPath, userDataDir });
    manifest = record(manifest, key, hash);
    saveManifest(paths.manifest, manifest);
    log(`rendered scene-${id}.png`);
  }
}

async function run(argv) {
  const storyDir = argv.find((arg) => !arg.startsWith('--'));
  const dry = argv.includes('--dry-run');
  if (!storyDir) {
    process.stderr.write('error: usage: render-frames.js <storyDir> [--dry-run]\n');
    process.exitCode = 1;
    return;
  }

  try {
    if (dry) {
      dryRun(storyDir, (line) => process.stdout.write(`${line}\n`));
    } else {
      await renderAll(storyDir, { log: (line) => process.stdout.write(`${line}\n`) });
    }
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = { chromeArgs, listSlides, renderFrame, renderAll, run };
