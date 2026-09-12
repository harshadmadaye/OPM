---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---
# React Patterns

Extends `typescript/coding-style.md`. Covers style, hooks, component patterns, and React-specific security.

## Files and Naming

- `.tsx` for any file containing JSX; `.ts` for hooks without JSX, types, utilities. Tests mirror the source name.
- Components: `PascalCase` symbol and file. Hooks: `useCamelCase`. Context: `<Domain>Context`, `<Domain>Provider`, `use<Domain>`.
- Handlers inside a component are `handleX`; the prop receiving one is `onX`. Boolean props read as claims: `isLoading`, `hasError`.
- Function components only. Convert legacy class components when touching them for non-trivial changes.

## Component Shape

```tsx
type Props = { user: User; onSelect: (id: string) => void };

export function UserCard({ user, onSelect }: Props) {
  return <button type="button" onClick={() => onSelect(user.id)}>{user.name}</button>;
}
```

- Destructure props in the parameter list. Let JSX infer the return type.
- Multi-line logic lives in a `const` above the `return`, not inline in JSX.
- Fragments over wrapper `div`s; early return for guard clauses.

## State Location

1. One component: `useState` inside it.
2. Parent plus a few children: lift to the nearest common ancestor.
3. Distant branches, low-frequency reads (theme, auth, locale): Context.
4. High-frequency shared updates: external store (Zustand, Jotai, Redux Toolkit).
5. Server data: server-state library (TanStack Query, SWR) or RSC fetch, never `useEffect` + `fetch`.

Never store state that can be derived; compute it during render.

## Hooks

- Hooks only at the top level of a component or another hook, in the same order every render. `react-hooks/rules-of-hooks` is an error; `exhaustive-deps` is never silenced without a comment.
- `useEffect` synchronizes with external systems. It is not for derived state, transforming data, resetting state on prop change (use `key`), or notifying parents (call the callback in the handler).
- Every subscription, interval, listener, or in-flight request cleans up:

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal }).then(handleResponse);
  return () => controller.abort();
}, [url]);
```

- Default to no memoization. Add `useMemo`/`useCallback` only when the value feeds a memoized child, is a dependency of another hook, or is measurably expensive.
- Functional updater when new state depends on old: `setCount((c) => c + 1)`. `useReducer` once transitions depend on previous state or 3+ values move together.
- Never read or write `ref.current` during render.
- Extract a custom hook when the same state+effect sequence appears in 2+ components or needs testing on its own. Do not wrap a single `useState` in a hook.
- React 19: `use()`, `useActionState`, `useOptimistic`, `useTransition`, and `ref` as a plain prop. Prefer these over hand-rolled equivalents when the project targets 19+.

## Server / Client Boundary (Next.js App Router)

- Files are Server Components by default. Add `"use client"` (line 1) only for state, effects, refs, browser APIs, or event handlers.
- A Client Component cannot import a Server Component; pass it as `children`.
- DB clients, secrets, and other server-only modules carry `import "server-only"` so a client import fails the build.
- Place Suspense boundaries near the data they wait on, each with an Error Boundary above it.

## Lists, Forms, Composition

- `key` is stable and unique among siblings; never the index for lists that reorder, insert, or delete.
- Forms: uncontrolled with form actions when there is a clear submit step; controlled when the value drives other UI or live validation; React Hook Form or TanStack Form for complex forms.
- Compose with `children`, render props, and component-type props. Compound components share state via Context.
- `createPortal` for modals, tooltips, and toasts.

## Security

- `dangerouslySetInnerHTML` is a review halt. Render text, use a sanitizing renderer, or `DOMPurify.sanitize` at the same call site with an allowlist config.
- Validate URL schemes before `href`/`src`: allow `http:`, `https:`, `mailto:`; reject `javascript:` and `data:`.
- `target="_blank"` always pairs with `rel="noopener noreferrer"`.
- Server Actions are public endpoints: schema-validate input, authenticate inside the action, authorize per record, rate limit.
- `NEXT_PUBLIC_*` and `VITE_*` values ship to the browser. Never put a secret in one.
- Sessions in httpOnly cookies, not `localStorage`. Render-gating in JSX hides UI; it does not protect data. The API enforces.
- Untrusted JSON is parsed through a schema before being spread into state.

<!-- Adapted from affaan-m/ecc (MIT) -->
