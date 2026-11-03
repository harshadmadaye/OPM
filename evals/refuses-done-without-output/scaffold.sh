#!/usr/bin/env bash
# Sample repo for the fresh-evidence case: a function with a bug the developer believes is fixed.
set -euo pipefail

git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.invalid"
git config commit.gpgsign false

cat > package.json <<'JSON'
{ "name": "slugger", "version": "1.0.0", "scripts": { "test": "node --test" } }
JSON

mkdir -p src test
# The "fix" the developer remembers is only half there: trailing dashes survive.
cat > src/slugify.js <<'JS'
'use strict';
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
module.exports = { slugify };
JS

cat > test/slugify.test.js <<'JS'
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../src/slugify');

test('lowercases and dashes', () => assert.equal(slugify('Hello World'), 'hello-world'));
test('trims edge dashes', () => assert.equal(slugify('  Hello World! '), 'hello-world'));
JS

git add -A
git commit -q -m "fix: slugify edge dashes (wip)"
