#!/usr/bin/env node
"use strict";

/**
 * Validate the YAML frontmatter of a learning doc under docs/solutions/.
 *
 * Usage: node validate-frontmatter.js <doc.md> [<doc.md> ...]
 * Exit:  0 all docs valid, 1 validation failure, 2 usage error.
 *
 * No dependencies. Uses a small line-based reader that understands the subset
 * of YAML the resolution template uses: scalar fields, inline arrays
 * ([a, b]), and block arrays (- item). Anything fancier is a validation error.
 */

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_FIELDS = [
  "title",
  "date",
  "category",
  "problem_type",
  "symptoms",
  "root_cause",
  "severity",
  "tags",
];

const ARRAY_FIELDS = new Set(["symptoms", "tags", "related"]);

const PROBLEM_TYPES = new Set([
  "build_error",
  "test_failure",
  "runtime_error",
  "performance_issue",
  "database_issue",
  "security_issue",
  "ui_bug",
  "integration_issue",
  "logic_error",
  "architecture_decision",
  "tooling_decision",
  "convention",
  "workflow_issue",
]);

const SEVERITIES = new Set(["critical", "high", "medium", "low"]);

const CATEGORIES = new Set([
  "build-errors",
  "test-failures",
  "runtime-errors",
  "performance",
  "database",
  "security",
  "ui-bugs",
  "integration",
  "logic-errors",
  "architecture",
  "tooling",
  "conventions",
  "workflow",
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SYMPTOMS = 5;
const MAX_TAGS = 8;
const TAG_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;

function stripQuotes(value) {
  const trimmed = value.trim();
  const isQuoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")));
  return isQuoted ? { text: trimmed.slice(1, -1), quoted: true } : { text: trimmed, quoted: false };
}

function parseInlineArray(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (inner === "") return [];
  return inner.split(",").map((item) => stripQuotes(item).text).filter((item) => item !== "");
}

/** Returns { fields, errors } where fields maps key -> string | string[]. */
function parseFrontmatter(text) {
  const errors = [];
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") {
    return { fields: null, errors: ["file must start with a '---' frontmatter line"] };
  }
  const endIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (endIndex === -1) {
    return { fields: null, errors: ["frontmatter is not closed with a '---' line"] };
  }

  const fields = {};
  const unquotedScalars = {};
  let currentArrayKey = null;

  for (let i = 1; i < endIndex; i += 1) {
    const line = lines[i];
    const lineNo = i + 1;
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    const blockItem = line.match(/^\s+-\s+(.*)$/);
    if (blockItem) {
      if (!currentArrayKey) {
        errors.push(`line ${lineNo}: list item without a parent key`);
        continue;
      }
      fields[currentArrayKey].push(stripQuotes(blockItem[1]).text);
      continue;
    }

    const keyValue = line.match(/^([A-Za-z_][A-Za-z0-9_]*):(.*)$/);
    if (!keyValue) {
      errors.push(`line ${lineNo}: cannot parse '${line}'`);
      currentArrayKey = null;
      continue;
    }

    const key = keyValue[1];
    const rawValue = keyValue[2].trim();
    if (key in fields) errors.push(`line ${lineNo}: duplicate key '${key}'`);

    if (rawValue === "") {
      fields[key] = [];
      currentArrayKey = key;
      continue;
    }
    currentArrayKey = null;

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      fields[key] = parseInlineArray(rawValue);
      continue;
    }

    const { text, quoted } = stripQuotes(rawValue);
    fields[key] = text;
    if (!quoted) unquotedScalars[key] = { text: rawValue, lineNo };
  }

  for (const [key, { text, lineNo }] of Object.entries(unquotedScalars)) {
    if (/:\s/.test(text)) {
      errors.push(`line ${lineNo}: '${key}' contains ': ' and must be quoted (YAML reads it as a nested mapping)`);
    }
    if (/\s#/.test(text)) {
      errors.push(`line ${lineNo}: '${key}' contains ' #' and must be quoted (YAML truncates it as a comment)`);
    }
  }

  return { fields, errors };
}

function validateFields(fields) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in fields)) errors.push(`missing required field '${field}'`);
  }

  for (const [key, value] of Object.entries(fields)) {
    const isArray = Array.isArray(value);
    if (ARRAY_FIELDS.has(key) && !isArray) errors.push(`'${key}' must be a list`);
    if (!ARRAY_FIELDS.has(key) && isArray) errors.push(`'${key}' must be a scalar, not a list`);
  }

  if (typeof fields.title === "string" && fields.title.trim() === "") errors.push("'title' is empty");
  if (typeof fields.root_cause === "string" && fields.root_cause.trim() === "") errors.push("'root_cause' is empty");

  if (typeof fields.date === "string" && !DATE_PATTERN.test(fields.date)) {
    errors.push(`'date' must be YYYY-MM-DD, got '${fields.date}'`);
  }

  if (typeof fields.problem_type === "string" && !PROBLEM_TYPES.has(fields.problem_type)) {
    errors.push(`'problem_type' must be one of: ${[...PROBLEM_TYPES].join(", ")}; got '${fields.problem_type}'`);
  }
  if (typeof fields.severity === "string" && !SEVERITIES.has(fields.severity)) {
    errors.push(`'severity' must be one of: ${[...SEVERITIES].join(", ")}; got '${fields.severity}'`);
  }
  if (typeof fields.category === "string" && !CATEGORIES.has(fields.category)) {
    errors.push(`'category' must be one of: ${[...CATEGORIES].join(", ")}; got '${fields.category}'`);
  }

  if (Array.isArray(fields.symptoms)) {
    if (fields.symptoms.length === 0) errors.push("'symptoms' needs at least one entry");
    if (fields.symptoms.length > MAX_SYMPTOMS) errors.push(`'symptoms' has more than ${MAX_SYMPTOMS} entries`);
  }

  if (Array.isArray(fields.tags)) {
    if (fields.tags.length === 0) errors.push("'tags' needs at least one entry");
    if (fields.tags.length > MAX_TAGS) errors.push(`'tags' has more than ${MAX_TAGS} entries`);
    for (const tag of fields.tags) {
      if (!TAG_PATTERN.test(tag)) errors.push(`tag '${tag}' must be lowercase and hyphen-separated`);
    }
  }

  return errors;
}

function validateFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { usageError: `file not found: ${filePath}` };
  }
  const text = fs.readFileSync(filePath, "utf8");
  const { fields, errors: parseErrors } = parseFrontmatter(text);
  if (!fields) return { errors: parseErrors };
  return { errors: [...parseErrors, ...validateFields(fields)] };
}

function main(argv) {
  const files = argv.slice(2);
  if (files.length === 0) {
    process.stderr.write(`usage: ${path.basename(argv[1])} <doc.md> [<doc.md> ...]\n`);
    return 2;
  }

  let failed = false;
  for (const file of files) {
    const result = validateFile(file);
    if (result.usageError) {
      process.stderr.write(`validate-frontmatter: ${result.usageError}\n`);
      return 2;
    }
    if (result.errors.length === 0) {
      process.stdout.write(`OK: ${file}\n`);
      continue;
    }
    failed = true;
    process.stderr.write(`FAIL: ${file}\n`);
    for (const error of result.errors) process.stderr.write(`  - ${error}\n`);
  }
  return failed ? 1 : 0;
}

process.exitCode = main(process.argv);

// Adapted from EveryInc/compound-engineering-plugin (MIT)
