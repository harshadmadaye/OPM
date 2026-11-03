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
