'use strict';
// Plans the OS-local narration voice command per platform. Narration text is
// always read from a file, never placed on a command line, and single quotes
// inside a Windows path are doubled so PowerShell does not misparse them.

const path = require('node:path');

const DEFAULT_SYSTEM_ROOT = 'C:\\Windows';

function psQuote(value) {
  return value.replace(/'/g, "''");
}

// Never "powershell" alone: the Windows search path checks the current
// directory before System32, so the command is built from SystemRoot.
function powershellPath(env) {
  const systemRoot = env.SystemRoot || env.SYSTEMROOT || DEFAULT_SYSTEM_ROOT;
  return path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

function localVoicePlan({ platform, textFile, rawFile, env = process.env }) {
  if (platform === 'darwin') {
    return { cmd: 'say', args: ['-f', textFile, '-o', `${rawFile}.aiff`], rawExt: 'aiff' };
  }
  if (platform === 'linux') {
    return { cmd: 'espeak-ng', args: ['-f', textFile, '-w', `${rawFile}.wav`], rawExt: 'wav' };
  }
  if (platform === 'win32') {
    const wavPath = psQuote(`${rawFile}.wav`);
    const textPath = psQuote(textFile);
    const command =
      `Add-Type -AssemblyName System.Speech; ` +
      `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
      `$s.SetOutputToWaveFile('${wavPath}'); ` +
      `$s.Speak([System.IO.File]::ReadAllText('${textPath}')); ` +
      `$s.Dispose()`;
    return { cmd: powershellPath(env), args: ['-NoProfile', '-NonInteractive', '-Command', command], rawExt: 'wav' };
  }
  return null;
}

function toMp3Args(rawFile, mp3File) {
  return ['-y', '-loglevel', 'error', '-i', rawFile, '-c:a', 'libmp3lame', '-b:a', '128k', mp3File];
}

module.exports = { localVoicePlan, toMp3Args };
