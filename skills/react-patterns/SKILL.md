---
name: react-patterns
description: Provides idiomatic React 18/19 and Next.js App Router patterns covering hooks discipline, composition, state colocation, server/client boundaries, Suspense and error boundaries, forms, data fetching, list keys, effects hygiene, and measurement-first performance work. Use when writing, reviewing, or refactoring React components, custom hooks, or Next.js routes.
---

# React Patterns

React rewards code that keeps render pure, puts state where it is used, and reaches for
optimisation only after measuring. This skill is the checklist for that.

Always-true conventions (naming, hooks rules, state location, the server/client boundary,
security) live in OPM's rule `react/patterns.md` (`.claude/rules/opm/react/` once installed,
`rules/react/` in the plugin). This skill keeps the patterns and worked examples.

## When to use

- Writing or modifying function components, custom hooks, or component trees.
- Reviewing JSX/TSX diffs.
- Choosing where state should live or how components should compose.
- Working across Server and Client Components in the Next.js App Router.
- Diagnosing slow renders, waterfalls, or oversized bundles.

## Core rules

**Render is a pure function of props and state.** Derive during render; do not store derived values.

```tsx
// Good
function Cart({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return <span>{formatMoney(total)}</span>;
}

// Bad: an extra render, a chance to desync, and hidden data flow
function Cart({ items }: { items: CartItem[] }) {
  const [total, setTotal] = useState(0);
  useEffect(() => setTotal(items.reduce((s, i) => s + i.price * i.qty, 0)), [items]);
  return <span>{formatMoney(total)}</span>;
}
```

**Side effects live in event handlers or `useEffect`, never in the render body.**

**Compose, do not inherit.** `children`, slot props, and compound components cover every case.

**Do not define components inside components.** A new component type on every render remounts
its subtree and loses state.

## References

- Read references/hooks-state-and-lists.md when writing hooks or effects, placing state, composing components, or rendering lists.
- Read references/server-data-and-forms.md when crossing the Server/Client boundary, fetching data, adding Suspense or error boundaries, or building forms.
- Read references/performance-and-a11y.md when optimising renders or bundles, or checking accessibility.

## Review checklist

- [ ] No derived state in `useState` + `useEffect`.
- [ ] Every effect has a reason to exist and a cleanup if it subscribes.
- [ ] Keys are stable ids; conditionals use ternaries where `0` could leak.
- [ ] State lives at the lowest component that needs it.
- [ ] `"use client"` is at the leaves, not the layout.
- [ ] Server Actions authenticate and authorise internally.
- [ ] Independent awaits run in parallel.
- [ ] Memoisation is justified by a profile or removed.
- [ ] Forms validate on the server; errors are announced (`role="alert"`).

## Related skills

- `opm:tdd-workflow` - component behaviour tests with Testing Library before implementation.
- `opm:verification-loop` - build, `tsc --noEmit`, lint, tests before claiming done.

<!-- Adapted from affaan-m/ecc (MIT) -->
