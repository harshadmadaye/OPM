---
type: regex
target:
  source: file
  path: docs/milestones/m1/REVIEW-QUEUE.md
pattern: "\\|\\s*(passed|failed)\\s*\\|"
match: not_contains
---

No row in REVIEW-QUEUE.md has Status passed or failed; only a person sets those. (If the file is missing the pending-row grader fails the case.)
