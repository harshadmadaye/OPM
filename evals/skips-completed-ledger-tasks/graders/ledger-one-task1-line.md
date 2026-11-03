---
type: regex
target:
  source: file
  path: docs/plans/2026-11-01-greet.progress.md
pattern: "^Task 1:"
flags: m
match: count:1
---

The ledger still has exactly one Task 1 line (the original "complete"); a re-run would add fix rounds or a second completion.
