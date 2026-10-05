## Performance: measure first

Default: do not memoise. Add `useMemo`, `useCallback`, or `React.memo` only when the React
profiler shows a component re-rendering often with unchanged props and a measurable cost.
If the project ships React Compiler, manual memoisation is noise.

When measurement says yes:

- `React.memo` a leaf that is expensive and receives stable props. Hoist default non-primitive
  props (`const EMPTY: Item[] = []`) so the memo is not defeated by fresh identities.
- `useMemo` for expensive derivations or objects passed to memoised children; never for `x + 1`.
- `useCallback` with functional updaters so the callback needs no dependencies.
- `startTransition` / `useDeferredValue` to keep typing responsive while expensive UI updates.
- Do not subscribe to store state that is only read inside a callback; read it on call instead.

Bundle and load:

- Import directly (`@/components/Button`), not from barrel files, unless Next.js
  `optimizePackageImports` covers the package.
- `next/dynamic` for heavy client-only components; `next/script` with `afterInteractive` or
  `lazyOnload` for third-party scripts.
- Keep dynamic import paths statically analysable: no template strings in `import()`.

Rendering:

- Animate wrappers with transforms, not layout properties.
- Inline a tiny script for pre-hydration values (theme) to avoid flicker; use
  `suppressHydrationWarning` only on the single leaf that legitimately differs.

## Accessibility baseline

- Semantic elements first (`<button>`, `<a>`, `<nav>`, `<main>`); `role` is a fallback.
- Every interactive element is keyboard reachable and has a visible focus state.
- Inputs have labels (`<label htmlFor>` or `aria-label`).
- Manage focus on route change and on modal open/close.
- Run `axe` in component tests.

