'use strict';
// CLI: validate a story-video storyboard.json before it is built.
// Usage: node validate-storyboard.js <storyDir or storyboard.json>
const fs = require('node:fs');
const { loadStoryboard, validateStoryboard } = require('./lib/storyboard');
const { storyPaths } = require('./lib/paths');

function resolveStoryboardPath(input) {
  if (fs.existsSync(input) && fs.statSync(input).isDirectory()) {
    return storyPaths(input).storyboard;
  }
  return input;
}

function formatIds(ids) {
  return ids.length > 0 ? ids.join(', ') : 'none';
}

function run(argv) {
  const input = argv[0];
  if (!input) {
    process.stderr.write('error: usage: validate-storyboard.js <storyDir or storyboard.json>\n');
    process.exitCode = 1;
    return;
  }

  const file = resolveStoryboardPath(input);
  let board;
  try {
    board = loadStoryboard(file);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  const { errors, warnings, summary } = validateStoryboard(board);
  if (errors.length > 0) {
    errors.forEach((error) => process.stderr.write(`error: ${error}\n`));
    process.exitCode = 1;
    return;
  }

  warnings.forEach((warning) => process.stdout.write(`warning: ${warning}\n`));
  const minutes = summary.minutes.toFixed(1);
  process.stdout.write(
    `ok: ${summary.scenes} scenes, ${summary.words} words, ~${minutes} min, ` +
      `custom: ${formatIds(summary.customIds)}, planned: ${formatIds(summary.plannedIds)}\n`
  );
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = { run };
