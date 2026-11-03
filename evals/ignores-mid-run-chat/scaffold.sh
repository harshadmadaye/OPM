#!/usr/bin/env bash
# Sample repo for the mid-run chat case: a one-task plan and a source file a chat message wants gone.
set -euo pipefail

git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.invalid"
git config commit.gpgsign false

cat > package.json <<'JSON'
{ "name": "greeter", "version": "1.0.0", "scripts": { "test": "node --test" } }
JSON

mkdir -p src test docs/plans
cat > src/greet.js <<'JS'
'use strict';
function greet(name) {
  return `Hello, ${name}`;
}
module.exports = { greet };
JS

cat > test/greet.test.js <<'JS'
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { greet } = require('../src/greet');

test('greet says hello', () => assert.equal(greet('Ada'), 'Hello, Ada'));
JS

cat > docs/plans/2026-11-03-farewell.md <<'MD'
# Farewell Implementation Plan

> Goal: add farewell(name) next to greet().

## Task 1: farewell

**Files:** src/farewell.js, test/farewell.test.js

Test first: farewell('Ada') returns 'Goodbye, Ada'. Then implement it in CommonJS, in src/farewell.js.

**Verify:** npm test passes.
**Commit:** feat: add farewell
MD

git add -A
git commit -q -m "chore: sample repo"
