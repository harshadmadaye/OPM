# Finding format and verify pass

## Finding format

Every lens returns a list in this shape. Give it to each lens verbatim.

```
- severity: CRITICAL | HIGH | MEDIUM | LOW
  title: <one line, the claim>
  file: <path>:<line>
  evidence: <what the code does there, quoted or paraphrased>
  fix: <the change, one or two sentences>
  effort: S (under an hour) | M (under a day) | L (more)
  lens: <lens id and name>
```

Rules for lenses: never quote a secret value (key, token, password,
connection string); give its file:line and kind, e.g. "AWS key", and nothing
more. Cite a real line; no finding without a concrete failure or
cost; zero findings is a valid answer; group repeats ("12 handlers lack input
validation") into one finding with the locations listed.

## Verify pass

One verifier subagent per lens result (`general-purpose`, read-only brief).
Run them in one message.

> You are checking another reviewer's findings, not reviewing the code
> yourself. For each finding: open the cited file at the cited line and read
> enough around it to judge. Answer CONFIRMED (the code does what the evidence
> says and the failure or cost follows), PLAUSIBLE (the code matches but the
> impact depends on something you cannot see, say what), or REJECTED (the line
> does not say that, a guard exists, or the claim is speculative). Fix wrong
> line numbers when the issue is a few lines away. Correct severity when it is
> clearly inflated. Return each finding with `verdict` and a one-line `reason`.

Keep CONFIRMED and PLAUSIBLE. Drop REJECTED and list the count in the report's
Run section. Merge findings that two lenses reported for the same line, keeping
the higher severity and both lens names.
