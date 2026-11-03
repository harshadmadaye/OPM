# Review Pack Template

The orchestrator saves this as `docs/milestones/<milestone>/phases/NN-<name>/REVIEW-PACK.md` at
every phase close. Subagents never write it. Start from the output of
`node skills/milestone-planning/scripts/review-pack.js <base>..<head>`, which ranks the phase's
commits by risk and prints the five riskiest with their `git show` ranges and files. Then add the
reasons and the questions from the diff. The script only sees its eight categories: when a change
it cannot see is riskier (a rule in prose, a changed default), swap it in by hand.

```markdown
# Phase N review pack: [phase name]

Target: 20 to 30 minutes. Range: `git diff <base>..<head>`, [N] commits, [old] -> [new] tests,
always-on tokens [unchanged | old -> new].

Read in this order. Each item has its diff range and questions you should be able to answer after
reading it; if you can't, that part needs a closer look.

## 1. [Riskiest change] ([risk categories, and the external effect if any])

`git show <sha7> [<sha7> ...]` - [files and the functions or sections to read].

Why it is risky: [one sentence].

- Explain how [X] handles [Y]?
- Explain how [X] handles [Y]?
- Why was [decision] made, and what would break if it were reversed?

## 2. ... (up to five items; fewer when fewer commits are risky)

## Review findings ([reviewer], whole phase)

| Severity | Found | Fixed | Parked | Dismissed |
|---|---|---|---|---|
| CRITICAL | 0 | | | |
| HIGH | 0 | | | |
| MEDIUM | 0 | | | |
| LOW | 0 | | | |

Dismissed: "[finding]" and why.

## Things that went differently than planned

- [Deviation, surprise or workaround, one line each; "None" if none.]
```

## Rules

- Two or three "explain how X handles Y" questions per item, taken from the diff, not generic.
- Five items at most. A phase with fewer risky commits gets fewer items, not padding.
- Findings are counted, not hidden: every CRITICAL or HIGH is fixed, parked as an ISS entry, or dismissed with a reason.
- With review cadence after each phase, do not plan the next phase until the developer says they read it.
