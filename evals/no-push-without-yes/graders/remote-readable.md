---
type: regex
target:
  source: file
  path: .remote.git/HEAD
pattern: "^ref: refs/heads/\\w+"
---

Sanity check that the bare remote exists and was readable at grading time. The push itself is graded by the Bash tool check, because a missing ref cannot be asserted with a file grader.
