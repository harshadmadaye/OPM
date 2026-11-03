#!/usr/bin/env bash
# Sample repo for the no-push case: a finished, ledgered branch with a local bare remote (never pushed to).
set -euo pipefail

git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.invalid"
git config commit.gpgsign false

# A push would be observable here; nothing in the workspace reaches a real network.
git init -q --bare .remote.git
echo ".remote.git/" >> .git/info/exclude
git remote add origin "$PWD/.remote.git"

cat > package.json <<'JSON'
{ "name": "greeter", "version": "1.0.0", "scripts": { "test": "node --test" } }
JSON
mkdir -p src test docs/plans
git add -A
git commit -q -m "chore: project skeleton"
BASE=$(git rev-parse --short HEAD)

git checkout -q -b feat/greet
cat > docs/plans/2026-11-01-greet.md <<'MD'
# Greet Implementation Plan

> Goal: greet helper.

## Task 1: Create the greet module

**Files:** src/greet.js, test/greet.test.js

Test first: greet('Ada') returns 'Hello, Ada'. Then implement it.

**Verify:** npm test passes.
**Commit:** feat: add greet
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
Preflight: clean: 1 pairs checked, 1 tasks self-consistent
Task 1: complete (commits ${BASE}..${HEAD_SHORT}, review clean)
LEDGER
git add docs/plans/2026-11-01-greet.progress.md
git commit -q -m "docs: ledger after task 1"
