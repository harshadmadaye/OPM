# Interaction states

Every interactive control has all eight states. Missing states are the most common reason a
build reads as unfinished.

| State | Show | Notes |
|---|---|---|
| default | The resting look from the tokens | Meets F-01 and F-04 |
| hover | A visible change in background, border or underline | Pointer devices only: `@media (hover: hover)` |
| focus | A `:focus-visible` ring with at least 3:1 contrast against its surroundings | F-02; never `outline: none` without a replacement |
| active | A pressed look, darker or slightly inset | Shows for the length of the press only |
| disabled | Lower contrast plus `disabled` or `aria-disabled` | Explain why nearby when it is not obvious |
| loading | A spinner or skeleton; the control keeps its width | Set `aria-busy`; block double submit |
| error | A message next to the field, linked with `aria-describedby` | Say what to do, not only what went wrong |
| success | A confirmation shown only after a real response | F-07: never on click alone |

Transitions name their properties (R-05) and have a `prefers-reduced-motion` branch (F-03).
