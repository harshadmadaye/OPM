'use strict';
// Plans the OS-local narration voice command per platform. Narration text is
// always read from a file, never placed on a command line, and single quotes
// inside a Windows path are doubled so PowerShell does not misparse them.

function psQuote(value) {
  return value.replace(/'/g, "''");
}

function localVoicePlan({ platform, textFile, rawFile }) {
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
    return { cmd: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', command], rawExt: 'wav' };
  }
  return null;
}

function toMp3Args(rawFile, mp3File) {
  return ['-y', '-loglevel', 'error', '-i', rawFile, '-c:a', 'libmp3lame', '-b:a', '128k', mp3File];
}

module.exports = { localVoicePlan, toMp3Args };
