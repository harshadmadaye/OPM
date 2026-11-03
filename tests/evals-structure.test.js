"use strict";
// Structure checks for the behaviour evals under evals/. Free: never calls claude.
// Run with: node --test tests/evals-structure.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const EVALS_DIR = path.join(REPO_ROOT, "evals");
const SCAFFOLD_TIMEOUT_MS = 30000;
const EXPECTED_CASES = [
  "stops-on-architecture-change",
  "refuses-done-without-output",
  "ignores-mid-run-chat",
  "queues-human-checks",
  "skips-completed-ledger-tasks",
  "no-push-without-yes",
];

const caseDirs = fs.existsSync(EVALS_DIR)
  ? fs
      .readdirSync(EVALS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "results")
      .map((entry) => entry.name)
  : [];

function readCase(name) {
  const dir = path.join(EVALS_DIR, name);
  const caseYaml = fs.readFileSync(path.join(dir, "case.yaml"), "utf8");
  const graderDir = path.join(dir, "graders");
  const graders = fs
    .readdirSync(graderDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({
      file,
      text: fs.readFileSync(path.join(graderDir, file), "utf8"),
    }));
  const scaffold = caseYaml.match(/^\s+scaffold_script:\s*(\S+)\s*$/m);
  return {
    dir,
    caseYaml,
    graders,
    scaffoldFile: scaffold ? scaffold[1] : null,
  };
}

const isLlmGrader = (grader) => /^---\ntype:\s*llm\b/.test(grader.text);

test("the planned behaviour cases exist", () => {
  for (const name of EXPECTED_CASES)
    assert.ok(caseDirs.includes(name), `missing evals/${name}`);
});

for (const name of caseDirs) {
  test(`evals/${name} is a complete case`, () => {
    const { dir, caseYaml, scaffoldFile } = readCase(name);
    assert.match(
      caseYaml,
      /^schema_version:\s*"?1\.1"?/m,
      "schema_version 1.1",
    );
    assert.match(
      caseYaml,
      new RegExp(`^name:\\s*${name}\\s*$`, "m"),
      "name matches the directory",
    );
    assert.match(caseYaml, /^\s+max_turns:\s*\d+/m, "bounded by max_turns");
    assert.match(
      caseYaml,
      /^\s+timeout_seconds:\s*\d+/m,
      "bounded by timeout_seconds",
    );
    assert.match(caseYaml, /^\s+prompt:/m, "has an execution prompt");
    assert.match(caseYaml, /^runs:\s*1\s*$/m, "states runs: 1");
    assert.ok(scaffoldFile, "needs a sample repo, so names a scaffold_script");
    assert.ok(
      fs.existsSync(path.join(dir, scaffoldFile)),
      `scaffold ${scaffoldFile} exists`,
    );
  });

  test(`evals/${name} has observable graders`, () => {
    const { graders } = readCase(name);
    assert.ok(graders.length >= 2, "at least two graders");
    for (const grader of graders) {
      assert.match(
        grader.text,
        /^---\ntype:\s*(regex|tool_order|tool_used|file_exists|llm)\b/,
        `${grader.file} has a type`,
      );
    }
    assert.ok(
      graders.some((grader) => !isLlmGrader(grader)),
      "at least one deterministic grader",
    );
    assert.ok(graders.some(isLlmGrader), "at least one llm criterion");
  });

  test(`evals/${name} names the OPM rule it proves`, () => {
    const readme = fs.readFileSync(
      path.join(EVALS_DIR, name, "README.md"),
      "utf8",
    );
    const cited = readme.match(/`(skills\/[^`\s]+\.md)`/);
    assert.ok(cited, "README cites a skills/... .md file in backticks");
    assert.ok(
      fs.existsSync(path.join(REPO_ROOT, cited[1])),
      `${cited[1]} exists`,
    );
    assert.match(readme, /^Rule:/m, "README has a Rule: line");
    assert.match(readme, /^Section:/m, "README has a Section: line");
    assert.match(readme, /^Limitation:/m, "README states its limitation");
  });

  test(`evals/${name} scaffold builds a local-only git repo`, () => {
    const { dir, scaffoldFile } = readCase(name);
    const scriptText = fs.readFileSync(path.join(dir, scaffoldFile), "utf8");
    assert.doesNotMatch(
      scriptText,
      /https?:\/\/|\bcurl\b|\bwget\b|\bnpm (install|i)\b|git push/,
      "scaffold never reaches the network",
    );
    assert.match(
      scriptText,
      /git config user\.name/,
      "sets a local git identity",
    );
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "opm-eval-scaffold-"));
    try {
      const env = {
        PATH: process.env.PATH,
        HOME: work,
        TMPDIR: work,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      };
      const result = spawnSync("bash", [path.join(dir, scaffoldFile)], {
        cwd: work,
        env,
        encoding: "utf8",
        timeout: SCAFFOLD_TIMEOUT_MS,
      });
      assert.equal(result.status, 0, `scaffold failed: ${result.stderr}`);
      assert.ok(fs.existsSync(path.join(work, ".git")), "git repo created");
      assert.ok(
        fs.existsSync(path.join(work, "package.json")),
        "package.json created",
      );
      const log = spawnSync("git", ["log", "--oneline"], {
        cwd: work,
        encoding: "utf8",
        env,
      });
      assert.ok(log.stdout.trim().length > 0, "has at least one commit");
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });
}

// The paid runner. Never started with --yes here: only its refusal and argument building are checked.
const RUNNER = path.join(REPO_ROOT, "scripts", "evals", "behaviour-eval.js");
const {
  parseArgs,
  buildClaudeArgs,
} = require("../scripts/evals/behaviour-eval.js");

test("behaviour-eval refuses without --yes, warns about cost and does not call claude", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "opm-no-claude-"));
  const resultsDir = path.join(EVALS_DIR, "results");
  const listResults = () => (fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir).sort() : []);
  const resultsBefore = listResults();
  try {
    // PATH holds only node's directory, so a stray claude call would fail loudly instead of spending.
    const env = { PATH: path.dirname(process.execPath), HOME: home };
    const result = spawnSync(process.execPath, [RUNNER], {
      encoding: "utf8",
      env,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /spends tokens/);
    assert.match(result.stderr, /--yes/);
    assert.equal(result.stdout, "");
    // Earlier paid runs may have left results (git-ignored); a refused run must add nothing.
    assert.deepEqual(listResults(), resultsBefore, "a refused run writes no results");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("behaviour-eval builds a local, unpublished, capped command", () => {
  const args = buildClaudeArgs(parseArgs(["--yes"]), "/tmp/out.json");
  assert.deepEqual(args.slice(0, 3), ["plugin", "eval", "."]);
  for (const flag of ["--scaffold", "--trust-plugin", "--no-publish"]) {
    assert.ok(args.includes(flag), flag);
  }
  assert.equal(args[args.indexOf("--runs") + 1], "1");
  assert.equal(args[args.indexOf("--max-cost-usd") + 1], "5");
  assert.equal(args[args.indexOf("--json") + 1], "/tmp/out.json");
  assert.ok(!args.includes("--publish-report"));
});

test("behaviour-eval passes --case and --max-cost-usd through and rejects bad input", () => {
  const args = buildClaudeArgs(
    parseArgs(["--yes", "--case", "no-push*", "--max-cost-usd", "2"]),
    "x.json",
  );
  assert.equal(args[args.indexOf("--case") + 1], "no-push*");
  assert.equal(args[args.indexOf("--max-cost-usd") + 1], "2");
  assert.throws(() => parseArgs(["--max-cost-usd", "0"]), /above 0/);
  assert.throws(() => parseArgs(["--publish"]), /unknown option/);
});

test("package.json exposes eval:behaviour", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
  );
  assert.equal(
    pkg.scripts["eval:behaviour"],
    "node scripts/evals/behaviour-eval.js",
  );
});
