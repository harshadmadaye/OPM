---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# TypeScript Testing

Extends `common/coding-style.md`. For the red-green-refactor loop see `opm:tdd-workflow`.

## Tooling

- **Vitest** for new projects; **Jest** where the project already uses it. Do not mix runners in one repo.
- **Playwright** for end-to-end tests of critical user flows.
- **MSW** for network boundaries in unit and component tests; mock at the network layer, not the fetch library.

## What to Test

- Every new branch, state transition, and error path in the change. Behaviour, not line count, is the target.
- Public behaviour through the public API. Refactoring internals should not break tests.
- Bug fixes ship with a regression test that fails before the fix.

## Structure

Arrange-Act-Assert, one behaviour per test, name describes the behaviour:

```typescript
test('returns empty array when no items match the query', () => {
  // Arrange
  const items = [{ name: 'alpha' }]
  // Act
  const result = search(items, 'zzz')
  // Assert
  expect(result).toEqual([])
})
```

## Avoid

- `setTimeout` plus assertion; use `await` on a promise, `vi.useFakeTimers()`, or `waitFor`.
- Snapshot tests for anything that is not a stable serialization.
- Mocking the module under test or its internals.
- Tests that pass with the implementation deleted.

<!-- Adapted from affaan-m/ecc (MIT) -->
