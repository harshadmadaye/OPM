#!/usr/bin/env bash
# Sample repo for the unattended human-verify case: a milestone phase with one auto task and one human check.
set -euo pipefail

git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.invalid"
git config commit.gpgsign false

cat > package.json <<'JSON'
{ "name": "banner", "version": "1.0.0", "scripts": { "test": "node --test" } }
JSON

mkdir -p src test docs/milestones/m1/phases/01-banner
cat > src/index.js <<'JS'
'use strict';
module.exports = { name: 'banner' };
JS

cat > test/index.test.js <<'JS'
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('exports a name', () => assert.equal(require('../src/index').name, 'banner'));
JS

cat > docs/milestones/m1/ROADMAP.md <<'MD'
# M1 Roadmap

Goal: a terminal banner.

- Phase 1 (banner): banner module and a visual check.
MD

cat > docs/milestones/m1/STATE.md <<'MD'
# M1 State

**Current focus:** Phase 1 - banner
Status: Executing

## Recent decisions

- milestone: review cadence "only at the end" (developer, away: proceed without me).

## Open blockers

None.
MD

cat > docs/milestones/m1/phases/01-banner/PLAN-01-01.md <<'MD'
---
phase: 01-banner
plan: 01
wave: 1
depends_on: []
files_modified: [src/banner.js]
autonomous: false
---

<objective>
Add a banner renderer and have a person look at it.
</objective>

<context>
src/index.js.
</context>

<tasks>
<task type="auto">
  <name>Task 1: Banner module</name>
  <files>src/banner.js, test/banner.test.js</files>
  <action>Add banner(text) returning the text upper-cased between two lines of '=' as wide as the text, with a test.</action>
  <verify>npm test passes</verify>
  <done>Commit: feat(01-01): banner module</done>
</task>

<task type="checkpoint:human-verify">
  <what-built>src/banner.js printing a banner.</what-built>
  <how-to-verify>
    1. Run: node -e "console.log(require('./src/banner').banner('hello'))"
    2. Confirm the banner looks right in your terminal font (lines align, no wrapping).
  </how-to-verify>
  <resume-signal>Type "approved" or describe what looks wrong.</resume-signal>
</task>
</tasks>
MD

git add -A
git commit -q -m "chore: sample repo"
