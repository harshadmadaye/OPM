---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---
# React Testing

Extends `typescript/testing.md`.

## Tooling

- **React Testing Library** with Vitest or Jest for component tests. One component runner per repo.
- **MSW** for every network boundary.
- **Playwright** for real layout, scrolling, drag-and-drop, animation, cross-frame, and full user journeys.

## Principle

Test what the user sees and does, not implementation details. Never assert on internal state, props passed to children, hook call counts, or render counts. A refactor that breaks no tests is the goal.

## Queries

Priority order: `getByRole(role, { name })`, `getByLabelText`, `getByPlaceholderText`, `getByText`, `getByDisplayValue`, then `getByAltText`/`getByTitle`, and `getByTestId` only as an escape hatch. `getBy*` throws, `queryBy*` returns null (assert absence), `findBy*` awaits.

## Interaction and Async

```tsx
const user = userEvent.setup();
render(<UserForm onSubmit={handleSubmit} />);
await user.type(screen.getByLabelText("Email"), "user@example.com");
await user.click(screen.getByRole("button", { name: /save/i }));
expect(await screen.findByText(/saved/i)).toBeInTheDocument();
```

- `userEvent` over `fireEvent`; always `await` it.
- `findBy*` for async appearance; `waitFor` for async side effects. Never `setTimeout` + assert.
- Hooks: `renderHook` and wrap state changes in `act`.

## Setup

Export a `renderWithProviders` from `test-utils.tsx` that wraps the query client, theme, and router once. Run `axe` (`vitest-axe`/`jest-axe`) on components with meaningful markup.

## Avoid

- Component snapshot tests; use visual diffs (Playwright screenshots) for regressions.
- `container.querySelector`; it bypasses accessibility queries.
- Mocking React hooks or child components by default.
- Ignoring `act()` warnings; they indicate real bugs.

<!-- Adapted from affaan-m/ecc (MIT) -->
