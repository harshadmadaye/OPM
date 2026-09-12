# Coding Style

## Core Principles

- **KISS**: prefer the simplest solution that actually works. Optimize for clarity over cleverness. No premature optimization.
- **DRY**: extract repeated logic into shared functions only when the repetition is real, not speculative.
- **YAGNI**: do not build features or abstractions before they are needed. Start simple; refactor when the pressure is real.

## Immutability

Prefer immutable data: return new objects instead of mutating inputs in place. Follow the language's idiom where mutation is the norm (Flutter widget state, Python in-place collections); do not fight the framework to avoid it.

## File Organization

- Many small files over few large files. 200-400 lines typical; 800 lines is a soft ceiling for source files.
- Test, generated, and vendored files may exceed the ceiling.
- Organize by feature/domain, not by type. Extract utilities from large modules.

## Error Handling

- Handle errors explicitly at every level. Never silently swallow them.
- User-facing code shows friendly messages; the server or log side records full context.

## Input Validation

- Validate at system boundaries: user input, API responses, file content, external data.
- Use schema-based validation where the stack provides it. Fail fast with a clear message.

## Naming

- Descriptive names that say what a thing holds or does, without needing a comment.
- Booleans read as claims (`isReady`, `hasAccess`). Constants and types follow the language's casing convention.

## Code Smells to Avoid

- Deep nesting (more than 4 levels): use early returns.
- Magic numbers: name meaningful thresholds, delays, and limits.
- Long functions (over ~50 lines): split into focused pieces.
- Hardcoded values: use constants or config.
- Leftover debug statements (`print`, `console.log`, `debugPrint`) in committed code.

<!-- Adapted from affaan-m/ecc (MIT) -->
