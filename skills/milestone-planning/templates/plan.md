# Plan Template

Save as `docs/milestones/<milestone>/phases/NN-<name>/PLAN-NN-MM.md`.
Two or three tasks per plan. Every `auto` task has `name`, `files`, `action`, `verify`, `done`.

```markdown
---
phase: NN-<name>
plan: MM
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
[What this plan delivers and why it matters for the milestone. Two or three sentences.]
</objective>

<context>
docs/milestones/<milestone>/STATE.md
[Relevant source files the executor must read first]
[Prior SUMMARY files only if this plan consumes what they built]
[Learnings from docs/solutions/ that constrain this work]
</context>

<tasks>

<task type="auto">
  <name>Task 1: [Action-oriented name]</name>
  <files>[exact/path/one.ext, exact/path/two.ext]</files>
  <action>[What to do, how, what to avoid and why. Name libraries, data shapes, and behaviour.]</action>
  <verify>[Command or observable check that proves it worked]</verify>
  <done>[Acceptance criteria testable without judgement]</done>
</task>

<task type="auto">
  <name>Task 2: [Action-oriented name]</name>
  <files>[exact/path.ext]</files>
  <action>[...]</action>
  <verify>[...]</verify>
  <done>[...]</done>
</task>

<!-- Include at most one checkpoint per plan, at the end. Set autonomous: false if present. -->

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What was built that needs a human eye]</what-built>
  <how-to-verify>
    1. Run: [command]
    2. Visit: [URL or screen]
    3. Check: [specific behaviour]
  </how-to-verify>
  <resume-signal>Reply "approved" or describe what is wrong</resume-signal>
</task>

<task type="checkpoint:decision" gate="blocking">
  <decision>[What needs deciding]</decision>
  <context>[Why it matters now]</context>
  <options>
    <option id="a"><name>[Option A]</name><pros>[...]</pros><cons>[...]</cons></option>
    <option id="b"><name>[Option B]</name><pros>[...]</pros><cons>[...]</cons></option>
  </options>
  <resume-signal>Reply with: a or b</resume-signal>
</task>

</tasks>

<verification>
- [ ] [Full test command] passes
- [ ] [Build / type check] passes
- [ ] [End-to-end behaviour check]
</verification>

<success_criteria>
- All tasks complete and verified
- No new errors or warnings introduced
- [Plan-specific measurable outcome]
</success_criteria>
```

## Wave assignment

1. A plan is eligible for wave N when every `depends_on` id is in a wave below N.
2. Eligible plans share a wave only if their `files_modified` do not overlap.
3. Assign the lowest wave satisfying both. Write it into the frontmatter.

## Specificity check

| Too vague | Executable |
|---|---|
| `<action>Add auth</action>` | `<action>POST /api/login accepting {email,password}; bcrypt compare; on match set httpOnly JWT cookie (jose, 15 min). 401 on mismatch.</action>` |
| `<verify>It works</verify>` | `<verify>curl -X POST localhost:3000/api/login returns 200 with Set-Cookie</verify>` |
| `<done>Auth complete</done>` | `<done>Valid credentials -> 200 + cookie; invalid -> 401</done>` |

<!-- Adapted from gsd-build/get-shit-done (MIT) -->
