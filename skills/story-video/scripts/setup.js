'use strict';
// CLI: install ffmpeg-static, ffprobe-static and edge-tts into a per-user
// tools folder, and report whether they are ready. Never touches the project.
// Usage: node setup.js [--check]
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { toolsDir, venvPython, toolBinary, findBrowser } = require('./lib/paths');

const PACKAGE_JSON = '{"private":true,"name":"opm-story-video-tools"}\n';

function findPython({ platform = process.platform, which } = {}) {
  const names = platform === 'win32' ? ['python3', 'python', 'py'] : ['python3', 'python'];
  for (const name of names) {
    const found = which(name);
    if (!found) continue;
    return name === 'py' ? { cmd: found, args: ['-3'] } : { cmd: found, args: [] };
  }
  return null;
}

function installPlan({ tools, platform = process.platform, python }) {
  const npmCmd = platform === 'win32' ? 'npm.cmd' : 'npm';
  const plan = [
    { cmd: npmCmd, args: ['install', '--no-audit', '--no-fund', 'ffmpeg-static', 'ffprobe-static'], cwd: tools, shell: platform === 'win32' },
  ];
  if (!python) return plan;
  plan.push({ cmd: python.cmd, args: [...python.args, '-m', 'venv', 'venv'], cwd: tools, shell: false });
  plan.push({ cmd: venvPython(tools, platform), args: ['-m', 'pip', 'install', '--quiet', 'edge-tts'], cwd: tools, shell: false });
  return plan;
}

function hasEdgeTts(tools, platform) {
  const python = venvPython(tools, platform);
  if (!fs.existsSync(python)) return false;
  const venv = path.join(tools, 'venv');
  const siteDirs =
    platform === 'win32'
      ? [path.join(venv, 'Lib', 'site-packages')]
      : fs.existsSync(path.join(venv, 'lib'))
        ? fs.readdirSync(path.join(venv, 'lib')).map((entry) => path.join(venv, 'lib', entry, 'site-packages'))
        : [];
  return siteDirs.some((dir) => fs.existsSync(path.join(dir, 'edge_tts')));
}

function toolReady(tools, name) {
  const binary = toolBinary(tools, name);
  return binary !== null && fs.existsSync(binary);
}

function check({ env = process.env, platform = process.platform } = {}) {
  const tools = toolsDir({ env });
  const python = findPython({ platform, which: (name) => defaultWhich(name, env, platform) });
  return {
    node: process.version,
    toolsDir: tools,
    browser: findBrowser({ platform, env }) || null,
    python: python ? python.cmd : null,
    ffmpeg: toolReady(tools, 'ffmpeg'),
    ffprobe: toolReady(tools, 'ffprobe'),
    edgeTts: hasEdgeTts(tools, platform),
  };
}

function defaultWhich(name, env, platform) {
  const exeName = platform === 'win32' && !name.endsWith('.exe') ? `${name}.exe` : name;
  const dirs = (env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = path.join(dir, exeName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function runStep(step) {
  const result = spawnSync(step.cmd, step.args, { cwd: step.cwd, shell: step.shell, stdio: 'inherit' });
  if (result.error) {
    throw new Error(`${step.cmd} ${step.args.join(' ')} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${step.cmd} ${step.args.join(' ')} failed with exit code ${result.status}`);
  }
}

function install({ env = process.env, platform = process.platform } = {}) {
  const tools = toolsDir({ env });
  fs.mkdirSync(tools, { recursive: true });
  const packageJsonPath = path.join(tools, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(packageJsonPath, PACKAGE_JSON);
  }

  const python = findPython({ platform, which: (name) => defaultWhich(name, env, platform) });
  const plan = installPlan({ tools, platform, python });
  const before = check({ env, platform });

  plan.forEach((step, index) => {
    const isNpmStep = index === 0;
    const isPythonStep = index > 0;
    if (isNpmStep && before.ffmpeg && before.ffprobe) return;
    if (isPythonStep && before.edgeTts) return;
    runStep(step);
  });

  return check({ env, platform });
}

function run(argv) {
  const checkOnly = argv.includes('--check');
  let report;
  try {
    report = checkOnly ? check({}) : install({});
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = { findPython, installPlan, check, install, run };
