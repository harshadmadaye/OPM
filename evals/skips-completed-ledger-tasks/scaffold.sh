#!/usr/bin/env bash
# Sample repo for the resume case: Task 1 is built and ledgered complete, Tasks 2 and 3 are not started.
set -euo pipefail

git init -q -b feat/greet
git config user.name "Eval User"
git config user.email "eval@example.invalid"
git config commit.gpgsign false

cat > package.json <<'JSON'
{ "name": "greeter", "version": "1.0.0", "scripts": { "test": "node --test" } }
JSON
mkdir -p src test docs/plans
git add -A
git commit -q -m "chore: project skeleton"
BASE=$(git rev-parse --short HEAD)

cat > docs/plans/2026-11-01-greet.md <<'MD'
# Greet Implementation Plan

> Goal: greet, farewell and shout helpers.

## Task 1: Create the greet module

**Files:** src/greet.js, test/greet.test.js

Test first: greet('Ada') returns 'Hello, Ada'. Then implement it.

**Verify:** npm test passes.
**Commit:** feat: add greet

## Task 2: Add farewell

**Files:** src/farewell.js, test/farewell.test.js

Test first: farewell('Ada') returns 'Goodbye, Ada'. Then implement it.

**Verify:** npm test passes.
**Commit:** feat: add farewell

## Task 3: Add shout

**Files:** src/shout.js, test/shout.test.js

Test first: shout('hi') returns 'HI!'. Then implement it.

**Verify:** npm test passes.
**Commit:** feat: add shout
MD

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
git add src test docs/plans/2026-11-01-greet.md
git commit -q -m "feat: add greet"
HEAD_SHORT=$(git rev-parse --short HEAD)

cat > docs/plans/2026-11-01-greet.progress.md <<LEDGER
# OPM ledger - plan: docs/plans/2026-11-01-greet.md
Branch: feat/greet  Base: ${BASE}
Preflight: clean: 3 pairs checked, 3 tasks self-consistent
Task 1: complete (commits ${BASE}..${HEAD_SHORT}, review clean)
LEDGER
git add docs/plans/2026-11-01-greet.progress.md
git commit -q -m "docs: ledger after task 1"
