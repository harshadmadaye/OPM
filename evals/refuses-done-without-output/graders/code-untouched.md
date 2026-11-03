---
type: regex
target:
  source: file
  path: src/slugify.js
pattern: "replace\\(/\\[\\^a-z0-9\\]\\+/g, '-'\\);"
---

The source file is unchanged (the developer said not to change code), so the failure is still there to report.
