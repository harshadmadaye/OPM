'use strict';
// CLI: narrate every stale scene's script to MP3, using Microsoft's neural
// voices through edge-tts (narrate.py) or an offline OS voice (lib/local-voice.js).
// Usage: node narrate.js <storyDir> --engine neural|local [--dry-run]
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { loadStoryboard } = require('./lib/storyboard');
const { storyPaths, sceneFile, toolsDir, toolBinary, venvPython } = require('./lib/paths');
const { loadManifest, saveManifest, isFresh, record, inputs } = require('./lib/manifest');
const { DEFAULT_VOICE, DEFAULT_RATE } = require('./lib/constants');
const { localVoicePlan, toMp3Args } = require('./lib/local-voice');

const USAGE = 'usage: narrate.js <storyDir> --engine neural|local [--dry-run]';
const NARRATE_PY = path.join(__dirname, 'narrate.py');

function cleanText(text) {
  return text.replace(/A\.I\./g, 'AI');
}

function staleScenes(storyboard, paths, manifest, engine, exists = fs.existsSync) {
  return storyboard.scenes.filter((scene) => {
    const key = `audio:${scene.id}`;
    const hash = inputs.audio(scene, storyboard, engine);
    const outputPath = sceneFile(paths.audio, scene.id, 'mp3');
    return !isFresh(manifest, key, hash, outputPath, exists);
  });
}

function parseArgs(argv) {
  const engineIndex = argv.indexOf('--engine');
  const engine = engineIndex !== -1 ? argv[engineIndex + 1] : null;
  const dryRun = argv.includes('--dry-run');
  const storyDir = argv.find((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--engine');
  return { storyDir, engine, dryRun };
}

function loadPlan(storyDir, engine) {
  const paths = storyPaths(storyDir);
  const board = loadStoryboard(paths.storyboard);
  const manifest = loadManifest(paths.manifest);
  const stale = staleScenes(board, paths, manifest, engine);
  return { paths, board, manifest, stale };
}

function dryRunCommand(storyDir, engine, log) {
  const { board, stale } = loadPlan(storyDir, engine);
  const voice = board.voice || DEFAULT_VOICE;
  const rate = board.rate || DEFAULT_RATE;
  log(JSON.stringify({ engine, voice, rate, scenes: stale.map((scene) => scene.id) }));
}

// Spawns narrate.py and streams its stdout so a `narrated <id>` line is
// recorded to the manifest the instant it arrives: a failure partway through
// still leaves the scenes already produced marked fresh.
function runNeuralProcess({ python, paths, board, ids, spawnFn, log }) {
  return new Promise((resolve, reject) => {
    const args = [NARRATE_PY, paths.storyboard, paths.audio, '--only', ids.join(',')];
    const child = spawnFn(python, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let manifest = loadManifest(paths.manifest);
    let buffer = '';

    child.on('error', (err) => {
      reject(new Error(`cannot start narrate.py: ${err.message}`));
    });

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
        if (!line) continue;
        log(line);
        const match = line.match(/^narrated (\S+)$/);
        if (!match) continue;
        const scene = board.scenes.find((candidate) => candidate.id === match[1]);
        if (!scene) continue;
        manifest = record(manifest, `audio:${scene.id}`, inputs.audio(scene, board, 'neural'));
        saveManifest(paths.manifest, manifest);
      }
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`narrate.py exited with status ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function neuralCommand(storyDir, { log, spawnFn = spawn } = {}) {
  const { paths, board, stale } = loadPlan(storyDir, 'neural');
  const freshCount = board.scenes.length - stale.length;
  if (stale.length === 0) {
    log(`fresh: ${freshCount} scenes`);
    return;
  }

  const python = venvPython(toolsDir(), process.platform);
  if (!fs.existsSync(python)) {
    throw new Error('edge-tts is not installed; run setup.js first');
  }

  fs.mkdirSync(paths.audio, { recursive: true });
  const ids = stale.map((scene) => scene.id);
  await runNeuralProcess({ python, paths, board, ids, spawnFn, log });
  if (freshCount > 0) log(`fresh: ${freshCount} scenes`);
}

function speakScene({ scene, board, paths, ffmpeg, plan, log }) {
  const textFile = path.join(paths.build, `narration-${scene.id}.txt`);
  const rawFile = path.join(paths.build, `narration-${scene.id}`);
  const scenePlan = localVoicePlan({ platform: process.platform, textFile, rawFile });
  const rawPath = `${rawFile}.${scenePlan.rawExt}`;
  const mp3File = sceneFile(paths.audio, scene.id, 'mp3');

  fs.writeFileSync(textFile, cleanText(scene.narration), 'utf8');
  try {
    const voiceResult = spawnSync(scenePlan.cmd, scenePlan.args, { encoding: 'utf8' });
    if (voiceResult.error) {
      if (voiceResult.error.code === 'ENOENT') {
        throw new Error(`${scenePlan.cmd} is not installed`);
      }
      throw new Error(`scene ${scene.id}: ${scenePlan.cmd} failed: ${voiceResult.error.message}`);
    }
    if (voiceResult.status !== 0) {
      const detail = voiceResult.stderr ? `\n${voiceResult.stderr}` : '';
      throw new Error(`scene ${scene.id}: ${scenePlan.cmd} failed${detail}`);
    }

    const mp3Result = spawnSync(ffmpeg, toMp3Args(rawPath, mp3File), { encoding: 'utf8' });
    if (mp3Result.status !== 0) {
      const detail = mp3Result.stderr ? `\n${mp3Result.stderr}` : '';
      throw new Error(`scene ${scene.id}: ffmpeg failed${detail}`);
    }

    log(`narrated ${scene.id}`);
  } finally {
    fs.rmSync(textFile, { force: true });
    fs.rmSync(rawPath, { force: true });
  }
}

function localCommand(storyDir, { log } = {}) {
  const { paths, board, manifest, stale } = loadPlan(storyDir, 'local');
  const freshCount = board.scenes.length - stale.length;
  if (stale.length === 0) {
    log(`fresh: ${freshCount} scenes`);
    return;
  }

  const probePlan = localVoicePlan({ platform: process.platform, textFile: 'probe', rawFile: 'probe' });
  if (!probePlan) {
    throw new Error('no local voice on this platform');
  }

  const tools = toolsDir();
  const ffmpeg = toolBinary(tools, 'ffmpeg');
  if (!ffmpeg) {
    throw new Error('ffmpeg is not installed; run setup.js first');
  }

  fs.mkdirSync(paths.audio, { recursive: true });
  fs.mkdirSync(paths.build, { recursive: true });

  let currentManifest = manifest;
  for (const scene of stale) {
    speakScene({ scene, board, paths, ffmpeg, plan: probePlan, log });
    currentManifest = record(currentManifest, `audio:${scene.id}`, inputs.audio(scene, board, 'local'));
    saveManifest(paths.manifest, currentManifest);
  }
  if (freshCount > 0) log(`fresh: ${freshCount} scenes`);
}

async function run(argv) {
  const { storyDir, engine, dryRun } = parseArgs(argv);
  if (!storyDir) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 1;
    return;
  }
  if (engine !== 'neural' && engine !== 'local') {
    process.stderr.write('error: --engine neural|local is required\n');
    process.exitCode = 1;
    return;
  }

  const log = (line) => process.stdout.write(`${line}\n`);

  try {
    if (dryRun) {
      dryRunCommand(storyDir, engine, log);
    } else if (engine === 'neural') {
      await neuralCommand(storyDir, { log });
    } else {
      localCommand(storyDir, { log });
    }
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = { cleanText, staleScenes, parseArgs, dryRunCommand, neuralCommand, localCommand, run };
