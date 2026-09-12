# Summary Template

Save as `docs/milestones/<milestone>/phases/NN-<name>/SUMMARY-NN-MM.md` when a plan completes.
The frontmatter is scanned by future planning; keep it accurate and complete.

```markdown
---
phase: NN-<name>
plan: MM
requires:
  - { phase: [prior phase], provides: [what this plan consumed from it] }
provides:
  - [what this plan built, one bullet per deliverable]
affects: [phases or keywords that will need this context]
key_files: [important files created or modified]
key_decisions:
  - "[decision]: [one-line rationale]"
issues_created: [ISS-NNN]
completed: YYYY-MM-DD
---

# NN-MM: [Plan name]

**[Substantive one-liner describing what shipped, e.g. "Signed-cookie sessions with 15-minute
expiry and protected /app routes". Never "plan complete".]**

## Accomplishments

- [Most important outcome]
- [Second outcome]

## Task commits

1. Task 1: [name] - `abc123f` (feat)
2. Task 2: [name] - `def456a` (test)
3. Metadata - `0123abc` (docs)

## Decisions

- [Decision and rationale, or "None - followed the plan as written"]

## Deviations from plan

[If none: "None."]

### Auto-fixed
- **[Rule 1-3 - category] [what]** - found in Task [N]; fix: [what]; verified by: [how]; commit `[hash]`

### Deferred to ISSUES.md
- ISS-NNN: [one line] (found in Task [N])

## Verification

- Tests: [command] -> [X passed, Y failed, Z skipped]
- Build / types / lint: [PASS or details]

## Next-phase readiness

- [What is now available to later phases]
- [Any concern or blocker for what comes next]
```

## One-liner rule

Good: "Prisma schema with User, Session, Product models and seed script".
Bad: "Database work done", "Phase complete", "Implemented models".

<!-- Adapted from gsd-build/get-shit-done (MIT) -->
