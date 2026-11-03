# <Level> assessment: <project> <target>

Date: YYYY-MM-DD. Commit: <short sha>. Scope: <whole repo | path | feature>.

## Summary

<Three sentences: overall state, the biggest risk, the cheapest high-value fix.>

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 0 |

## Baseline

| Gate | Result |
|---|---|
| Build | <pass / fail / not configured> |
| Types | <errors count> |
| Lint | <errors / warnings> |
| Tests | <passed / failed / skipped> |
| Coverage | <percent or not configured> |

(Code and Project only; omit for Architecture and Feature.)

## Findings

### Critical fixes

#### F1 <title>

- severity: HIGH
- file: path/to/file.ts:42
- evidence: <what the code does>
- fix: <the change>
- effort: S
- lens: C1 Correctness
- verdict: CONFIRMED

### Quick wins

### Refactors

### Test gaps

### Other

## Since last assessment

(Only when an earlier report for this level exists.)

| Fixed | New | Still open |
|---|---|---|
| F2 (prev F5) | F7 | F1 (prev F1) |

## Run

Lenses: <ids and names>. Agents: <count>. Rejected by the verifier: <count>.
Failed lenses: <none | which and why>. Not read: <paths the lenses skipped>.

## Next steps

- Pick bundles to fix (asked in chat).
- <Suggested follow-up assessment, e.g. `/opm:assess feature checkout`.>
