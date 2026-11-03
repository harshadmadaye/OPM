---
type: tool_used
tool: Bash
input_match: '(git mv|\bmv\b|\bcp\b|mkdir)[^"]*(packages|src)'
min: 0
max: 0
---

The agent runs no shell command that moves, copies or creates the packages/ layout or moves src/.
