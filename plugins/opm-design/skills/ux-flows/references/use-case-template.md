# Use case template

Copy one block per use case into `docs/ux-flows/<feature>/use-cases.md`.

## UC-01: <goal in the user's words>

- **Actors:** <primary actor>; <other actors or systems>
- **Preconditions:** <what is true before it starts>
- **Main flow:**
  1. <actor does>
  2. <system responds>
  3. ...
- **Alternative flows:**
  - 2a. <condition>: <what happens instead>, then return to step <n>
- **Error flows:**
  - 3e. <failure, such as network down or validation fails>: <what the user sees>, <how they recover>
- **Postconditions:** <what is true after success>
- **Open questions:** <anything you were not told>

Number alternative flows after the step they branch from (`2a`) and error flows with `e` (`3e`).
Every error flow says how the user recovers.
