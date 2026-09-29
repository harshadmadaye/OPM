'use strict';
// CLI: encode each scene's PNG frame and MP3 narration into a video segment,
// concatenate the segments into the final MP4, write the .srt sidecar and
// build the review contact sheet.
// Usage: node build-video.js <build|contact-sheet> <storyDir> [--dry-run] [--assume-duration <seconds>]
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadStoryboard } = require('./lib/storyboard');
const { storyPaths, sceneFile, toolsDir, toolBinary } = require('./lib/paths');
const { buildSrt } = require('./lib/srt');
const { loadManifest, saveManifest, isFresh, record, inputs } = require('./lib/manifest');
const { LEAD, TAIL, FADE, FPS, WIDTH, HEIGHT } = require('./lib/constants');

const USAGE = 'usage: build-video.js <build|contact-sheet> <storyDir> [--dry-run] [--assume-duration <seconds>]';
const DEFAULT_ASSUME_DURATION = 10;
const CONTACT_SHEET_COLUMNS = 4;
const CONTACT_SHEET_TILE_WIDTH = 480;
const CONTACT_SHEET_TILE_HEIGHT = 270;
// Speech peaks well above -20 dB; anything whose loudest moment is below this
// is silence, whatever produced it.
const SILENT_BELOW_DB = -50;
// Fast speech is about 3 words a second; audio shorter than 6 per second
// cannot hold the narration.
const MAX_WORDS_PER_SECOND = 6;

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function segmentArgs({ png, mp3, out, duration }) {
  const total = round3(duration + LEAD + TAIL);
  const fadeOut = round3(total - FADE);
  const delayMs = Math.round(LEAD * 1000);
  const filter =
    `[1:a]adelay=${delayMs}|${delayMs},apad,aresample=44100[a];` +
    `[0:v]scale=${WIDTH}:${HEIGHT},format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeOut}:d=${FADE}[v]`;

  return [
    '-y',
    '-loglevel',
    'error',
    '-loop',
    '1',
    '-framerate',
    String(FPS),
    '-i',
    png,
    '-i',
    mp3,
    '-filter_complex',
    filter,
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-t',
    String(total),
    '-r',
    String(FPS),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-tune',
    'stillimage',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ac',
    '2',
    out,
  ];
}

function concatArgs({ listFile, out }) {
  return ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', out];
}

function concatList(segmentPaths) {
  return segmentPaths
    .map((segmentPath) => {
      const forward = segmentPath.replace(/\\/g, '/');
      const escaped = forward.replace(/'/g, "'\\''");
      return `file '${escaped}'\n`;
    })
    .join('');
}

function probeArgs(mp3) {
  return ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3];
}

function volumeArgs(mp3) {
  return ['-hide_banner', '-nostats', '-i', mp3, '-af', 'volumedetect', '-vn', '-f', 'null', '-'];
}

function audioStreamArgs(mp4) {
  return ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', mp4];
}

// The loudest sample in dB from ffmpeg's volumedetect log, -Infinity for
// digital silence, or null when the log has no measurement.
function parseMaxVolume(stderr) {
  const match = /max_volume: (-?inf|-?[\d.]+) dB/.exec(stderr || '');
  if (!match) return null;
  return match[1].endsWith('inf') ? -Infinity : parseFloat(match[1]);
}

function narrationProblem({ maxVolume, duration, words }) {
  if (maxVolume === null || maxVolume < SILENT_BELOW_DB) {
    const loudest = maxVolume === null || maxVolume === -Infinity ? 'no sound at all' : `loudest ${maxVolume} dB`;
    return `narration is silent (${loudest})`;
  }
  if (duration * MAX_WORDS_PER_SECOND < words) {
    return `narration is ${round3(duration)}s for ${words} words, too short to hold them`;
  }
  return null;
}

function checkNarration({ ffmpeg, mp3Path, scene, duration, paths, spawn }) {
  const result = spawn(ffmpeg, volumeArgs(mp3Path), { encoding: 'utf8' });
  const words = scene.narration.trim().split(/\s+/).length;
  const problem = narrationProblem({ maxVolume: parseMaxVolume(result.stderr), duration, words });
  if (!problem) return;
  const relative = path.relative(paths.root, mp3Path);
  throw new Error(
    `scene ${scene.id}: ${problem}. Nothing was encoded. ` +
      `delete ${relative} and rerun narrate.js; if the local voice made it, ` +
      'check the system voice in the OS speech settings or use the neural voice.',
  );
}

function checkFinalAudio({ ffprobe, mp4, spawn }) {
  const result = spawn(ffprobe, audioStreamArgs(mp4), { encoding: 'utf8' });
  if (result.status !== 0 || !/audio/.test(result.stdout || '')) {
    throw new Error(`the finished video has no audio track: ${mp4}`);
  }
}

function contactSheetArgs({ frames, out }) {
  const n = frames.length;
  const rows = Math.ceil(n / CONTACT_SHEET_COLUMNS);
  const inputArgs = frames.flatMap((frame) => ['-i', frame]);
  const refs = frames.map((_, index) => `[${index}:v]`).join('');
  const filter = `${refs}concat=n=${n}:v=1:a=0,scale=${CONTACT_SHEET_TILE_WIDTH}:${CONTACT_SHEET_TILE_HEIGHT},tile=${CONTACT_SHEET_COLUMNS}x${rows}[sheet]`;

  return ['-y', '-loglevel', 'error', ...inputArgs, '-filter_complex', filter, '-map', '[sheet]', '-frames:v', '1', out];
}

function missingInputs(scenes, paths, exists = fs.existsSync) {
  const problems = [];
  scenes.forEach((scene) => {
    const framePath = sceneFile(paths.frames, scene.id, 'png');
    const audioPath = sceneFile(paths.audio, scene.id, 'mp3');
    if (!exists(framePath)) problems.push(`scene ${scene.id}: missing frame ${framePath}`);
    if (!exists(audioPath)) problems.push(`scene ${scene.id}: missing audio ${audioPath}`);
  });
  return problems;
}

function missingFrames(scenes, paths, exists) {
  const problems = [];
  scenes.forEach((scene) => {
    const framePath = sceneFile(paths.frames, scene.id, 'png');
    if (!exists(framePath)) problems.push(`scene ${scene.id}: missing frame ${framePath}`);
  });
  return problems;
}

function reportProblems(problems) {
  problems.forEach((problem) => process.stderr.write(`error: ${problem}\n`));
  process.exitCode = 1;
}

function dryRunBuild(paths, scenes, assumeDuration, log) {
  const segmentPaths = scenes.map((scene) => {
    const png = sceneFile(paths.frames, scene.id, 'png');
    const mp3 = sceneFile(paths.audio, scene.id, 'mp3');
    const out = sceneFile(paths.segments, scene.id, 'mp4');
    const args = segmentArgs({ png, mp3, out, duration: assumeDuration });
    log(JSON.stringify({ scene: scene.id, step: 'segment', args }));
    return out;
  });

  const args = concatArgs({ listFile: paths.concatList, out: paths.mp4 });
  log(JSON.stringify({ step: 'concat', args }));
  return segmentPaths;
}

function probeDuration(ffprobe, mp3Path, sceneId, spawn) {
  const result = spawn(ffprobe, probeArgs(mp3Path), { encoding: 'utf8' });
  const duration = result.status === 0 ? parseFloat(result.stdout) : NaN;
  if (Number.isNaN(duration)) {
    throw new Error(`scene ${sceneId}: cannot read audio duration`);
  }
  return duration;
}

function runBuildEncode({ scenes, paths, ffmpeg, ffprobe, exists, spawn, log }) {
  let manifest = loadManifest(paths.manifest);
  const segmentPaths = [];

  // Every scene's narration is measured before any segment is encoded, so a
  // silent scene late in the video fails the build before minutes of encoding.
  const durations = scenes.map((scene) => {
    const mp3Path = sceneFile(paths.audio, scene.id, 'mp3');
    const duration = probeDuration(ffprobe, mp3Path, scene.id, spawn);
    checkNarration({ ffmpeg, mp3Path, scene, duration, paths, spawn });
    return duration;
  });

  scenes.forEach((scene, index) => {
    const pngPath = sceneFile(paths.frames, scene.id, 'png');
    const mp3Path = sceneFile(paths.audio, scene.id, 'mp3');
    const outPath = sceneFile(paths.segments, scene.id, 'mp4');
    const pngBuffer = fs.readFileSync(pngPath);
    const mp3Buffer = fs.readFileSync(mp3Path);
    const hash = inputs.segment(pngBuffer, mp3Buffer);
    const key = `segment:${scene.id}`;

    const duration = durations[index];
    segmentPaths.push(outPath);

    if (isFresh(manifest, key, hash, outPath, exists)) {
      log(`fresh scene-${scene.id}.mp4`);
      return;
    }

    const args = segmentArgs({ png: pngPath, mp3: mp3Path, out: outPath, duration });
    const result = spawn(ffmpeg, args, { encoding: 'utf8' });
    if (result.status !== 0) {
      const detail = result.stderr ? `\n${result.stderr}` : '';
      throw new Error(`scene ${scene.id}: ffmpeg failed${detail}`);
    }

    manifest = record(manifest, key, hash);
    saveManifest(paths.manifest, manifest);
    log(`encoded scene-${scene.id}.mp4`);
  });

  return { durations, segmentPaths };
}

function buildCommand(storyDir, { dryRun = false, assumeDuration = DEFAULT_ASSUME_DURATION, log = console.log, spawn = spawnSync, exists = fs.existsSync, tools = toolsDir() } = {}) {
  const paths = storyPaths(storyDir);
  const board = loadStoryboard(paths.storyboard);
  const scenes = board.scenes;

  const problems = missingInputs(scenes, paths, exists);
  if (problems.length > 0) {
    reportProblems(problems);
    return;
  }

  if (dryRun) {
    dryRunBuild(paths, scenes, assumeDuration, log);
    return;
  }

  const ffmpeg = toolBinary(tools, 'ffmpeg');
  const ffprobe = toolBinary(tools, 'ffprobe');
  if (!ffmpeg || !ffprobe) {
    process.stderr.write('error: ffmpeg is not installed; run setup.js first\n');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(paths.segments, { recursive: true });
  fs.mkdirSync(paths.build, { recursive: true });

  const { durations, segmentPaths } = runBuildEncode({ scenes, paths, ffmpeg, ffprobe, exists, spawn, log });

  fs.writeFileSync(paths.concatList, concatList(segmentPaths));
  const concatResult = spawn(ffmpeg, concatArgs({ listFile: paths.concatList, out: paths.mp4 }), { encoding: 'utf8' });
  if (concatResult.status !== 0) {
    const detail = concatResult.stderr ? `\n${concatResult.stderr}` : '';
    throw new Error(`concat failed${detail}`);
  }
  checkFinalAudio({ ffprobe, mp4: paths.mp4, spawn });

  const srtScenes = scenes.map((scene, index) => ({ narration: scene.narration, duration: durations[index] }));
  fs.writeFileSync(paths.srt, buildSrt(srtScenes, { lead: LEAD, tail: TAIL }));

  const total = round3(durations.reduce((sum, duration) => sum + LEAD + duration + TAIL, 0));
  log(`done: ${paths.mp4} (${total}s, ${scenes.length} scenes, narration checked)`);
}

function contactSheetCommand(storyDir, { dryRun = false, log = console.log, spawn = spawnSync, exists = fs.existsSync, tools = toolsDir() } = {}) {
  const paths = storyPaths(storyDir);
  const board = loadStoryboard(paths.storyboard);
  const scenes = board.scenes;

  const problems = missingFrames(scenes, paths, exists);
  if (problems.length > 0) {
    reportProblems(problems);
    return;
  }

  const frames = scenes.map((scene) => sceneFile(paths.frames, scene.id, 'png'));
  const args = contactSheetArgs({ frames, out: paths.contactSheet });

  if (dryRun) {
    log(JSON.stringify({ step: 'contact-sheet', args }));
    return;
  }

  const ffmpeg = toolBinary(tools, 'ffmpeg');
  if (!ffmpeg) {
    process.stderr.write('error: ffmpeg is not installed; run setup.js first\n');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(paths.build, { recursive: true });
  const result = spawn(ffmpeg, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = result.stderr ? `\n${result.stderr}` : '';
    throw new Error(`contact sheet: ffmpeg failed${detail}`);
  }

  log(`contact sheet: ${paths.contactSheet}`);
}

function run(argv) {
  const command = argv[0];
  const storyDir = argv[1];
  const dryRun = argv.includes('--dry-run');
  const durationIndex = argv.indexOf('--assume-duration');
  const assumeDuration = durationIndex !== -1 ? Number(argv[durationIndex + 1]) : DEFAULT_ASSUME_DURATION;

  if ((command !== 'build' && command !== 'contact-sheet') || !storyDir) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  const log = (line) => process.stdout.write(`${line}\n`);

  try {
    if (command === 'build') {
      buildCommand(storyDir, { dryRun, assumeDuration, log });
    } else {
      contactSheetCommand(storyDir, { dryRun, log });
    }
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = {
  segmentArgs,
  concatArgs,
  concatList,
  probeArgs,
  volumeArgs,
  audioStreamArgs,
  parseMaxVolume,
  narrationProblem,
  contactSheetArgs,
  missingInputs,
  buildCommand,
  contactSheetCommand,
  run,
};
