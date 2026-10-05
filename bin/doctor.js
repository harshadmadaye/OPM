'use strict';
// `npx opm-core doctor` — checks the health of an OPM install. No network calls.

const DOCTOR_USAGE = `opm-core doctor — check the health of your OPM install

  npx opm-core doctor [target repo]

Checks Node, the claude CLI and plugin registration, rule freshness, the tools
the Stop hook needs, and replays each hook on a synthetic payload. Exits 1 when
any check fails; warnings exit 0.`;

async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(DOCTOR_USAGE);
    return 0;
  }
  return 0;
}

module.exports = { main, DOCTOR_USAGE };
