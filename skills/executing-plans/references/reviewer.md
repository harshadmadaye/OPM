### 3. Dispatch the reviewer

Every task gets a review: spec compliance AND code quality, both verdicts required. Implementer self-review never replaces it. Never fix findings yourself in the controller session; controller fixes pollute your context and skip review.

Hand the reviewer the task text and the diff. Prefer to have the reviewer run the git commands itself (keeps the diff out of your context); paste the output only when the diff is tiny.

Do not pre-judge for the reviewer. If the prompt you are writing contains "do not flag", "at most Minor", or "the plan chose", stop: you are sparing yourself a review loop. Let the reviewer raise it and rule on it afterwards.

#### Reviewer prompt template

```
Agent (subagent_type: general-purpose, model: <per Model Selection>)
description: "Review Task N (spec + quality)"
prompt: |
  You are reviewing one task's implementation: first whether it matches
  its requirements, then whether it is well-built. This is a task-scoped
  gate, not a merge review. Your review is read-only: do not modify the
  working tree, index, or branches. Do not dispatch subagents.

  ## What was requested
  <task text verbatim>

  ## Global constraints
  <verbatim block>

  ## What the implementer claims
  <implementer's short report>

  ## Diff under review
  Base: <BASE>  Head: <HEAD>
  Run: `git log --oneline <BASE>..<HEAD>`, `git diff --stat <BASE>..<HEAD>`,
  `git diff -U10 <BASE>..<HEAD>`. The diff is your view of the change. Read
  a changed file separately only when a hunk you must judge is cut off,
  and inspect code outside the diff only to check a concrete risk you can
  name (a changed contract's call sites, shared mutable state, lock order).
  Say what you checked.

  ## Do not trust the report
  It is unverified claims about the code, including its rationales ("left
  it per YAGNI"). Judge the code. Do not re-run the suite to confirm the
  report; run a focused test only when reading raises a specific doubt.
  Warnings or noise in the reported test output are findings.

  ## Part 1: Spec compliance
  Missing (skipped or claimed but not implemented), Extra (unrequested,
  over-engineered), Misunderstood (right feature, wrong way). A batched
  brief: every listed file must have its hunk. Requirements you cannot
  verify from this diff alone: report as "Cannot verify", do not go hunting.

  ## Part 2: Code quality
  Separation of concerns; explicit error handling (no swallowed errors);
  DRY without premature abstraction; edge cases; tests verify behavior,
  not mocks; each file has one responsibility; new files not already
  large. Cite file:line for every finding.

  ## Calibration
  Critical: broken, insecure, or data-losing. Important: cannot be trusted
  until fixed (missed requirement, fragile behavior, swallowed errors,
  tests that assert nothing, verbatim duplicated logic). Minor: polish and
  "coverage could be broader". If the task text mandates something this
  rubric calls a defect, report it as Important, labeled plan-mandated.
  Name what was done well before listing issues.

  ## Output (the report is your whole final message, no preamble)
  ### Spec compliance: COMPLIANT | ISSUES (list) | CANNOT VERIFY (list)
  ### Strengths
  ### Issues: Critical / Important / Minor, each with file:line, what,
      why, how to fix
  ### Verdict: Approved | Needs fixes, with 1-2 sentences of reasoning
```

Resolve every "Cannot verify" item yourself; you hold the cross-task context. A confirmed gap enters the fix loop as a finding.
