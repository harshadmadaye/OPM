'use strict';
// Path derivation for the story-video pipeline: tool install locations, browser
// discovery and the per-story directory layout. OS differences are taken as a
// `platform` parameter (default process.platform), never read deep inside.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCENE_ID_PATTERN = /^\d\d$/;

function toolsDir({ env = process.env, homedir = os.homedir() } = {}) {
  if (env.OPM_STORY_TOOLS) return env.OPM_STORY_TOOLS;
  return path.join(homedir, '.opm', 'story-video-tools');
}

function venvPython(tools, platform = process.platform) {
  if (platform === 'win32') {
    return path.win32.join(tools, 'venv', 'Scripts', 'python.exe');
  }
  return path.posix.join(tools, 'venv', 'bin', 'python');
}

function toolBinary(tools, name) {
  if (name !== 'ffmpeg' && name !== 'ffprobe') {
    throw new Error(`unknown tool: ${name}`);
  }
  const pkgDir = path.join(tools, 'node_modules', `${name}-static`);
  if (!fs.existsSync(pkgDir)) return null;
  let exported;
  try {
    exported = require(pkgDir);
  } catch {
    return null;
  }
  return name === 'ffmpeg' ? exported : exported.path;
}

function browserCandidates(platform, env) {
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
  }
  if (platform === 'win32') {
    const programFiles = env.PROGRAMFILES;
    const programFilesX86 = env['PROGRAMFILES(X86)'];
    const localAppData = env.LOCALAPPDATA;
    const roots = [
      [programFiles, ['Google', 'Chrome', 'Application', 'chrome.exe']],
      [programFilesX86, ['Google', 'Chrome', 'Application', 'chrome.exe']],
      [localAppData, ['Google', 'Chrome', 'Application', 'chrome.exe']],
      [localAppData, ['Chromium', 'Application', 'chrome.exe']],
      [programFilesX86, ['Microsoft', 'Edge', 'Application', 'msedge.exe']],
      [programFiles, ['Microsoft', 'Edge', 'Application', 'msedge.exe']],
      [programFiles, ['BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe']],
    ];
    return roots
      .filter(([root]) => root !== undefined)
      .map(([root, parts]) => path.win32.join(root, ...parts));
  }
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'];
}

function defaultWhich(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findBrowser({ platform = process.platform, env = process.env, exists = fs.existsSync, which = defaultWhich } = {}) {
  if (env.CHROME_PATH && exists(env.CHROME_PATH)) return env.CHROME_PATH;

  const candidates = browserCandidates(platform, env);
  if (platform === 'darwin' || platform === 'win32') {
    return candidates.find((candidate) => exists(candidate)) || null;
  }
  for (const name of candidates) {
    const found = which(name);
    if (found) return found;
  }
  return null;
}

function storyPaths(storyDir) {
  const slug = path.basename(storyDir);
  const build = path.join(storyDir, '.build');
  const slides = path.join(storyDir, 'slides');
  return {
    root: storyDir,
    storyboard: path.join(storyDir, 'storyboard.json'),
    slides,
    css: path.join(slides, 'slides.css'),
    frames: path.join(storyDir, 'frames'),
    audio: path.join(storyDir, 'audio'),
    segments: path.join(storyDir, 'segments'),
    build,
    manifest: path.join(build, 'manifest.json'),
    contactSheet: path.join(build, 'contact-sheet.png'),
    concatList: path.join(build, 'concat.txt'),
    gitignore: path.join(storyDir, '.gitignore'),
    mp4: path.join(storyDir, `${slug}.mp4`),
    srt: path.join(storyDir, `${slug}.srt`),
  };
}

// Every writer of scene output goes through here, so the two-digit rule is
// enforced in one place: an id like "../../tmp/x" would otherwise place output
// outside the story directory.
function sceneFile(dir, id, ext) {
  if (typeof id !== 'string' || !SCENE_ID_PATTERN.test(id)) {
    throw new Error(`bad scene id: ${id}`);
  }
  return path.join(dir, `scene-${id}.${ext}`);
}

module.exports = {
  toolsDir,
  venvPython,
  toolBinary,
  browserCandidates,
  findBrowser,
  storyPaths,
  sceneFile,
};
