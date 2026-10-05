## Hooks discipline

- Top-level calls only, a cleanup for every subscription, functional updaters, and when to extract a custom hook: see rule `react/patterns.md` (Hooks).
- Dependencies are honest: list what the effect reads. If the list is painful, the effect is
  doing too much or the value should be a ref or an event handler.
- Expensive initial state uses the lazy initialiser: `useState(() => parse(bigInput))`.

## Effects hygiene

Most `useEffect` calls in application code are one of these mistakes:

| You wrote an effect to... | Do this instead |
|---|---|
| Compute a value from props/state | Derive during render (or `useMemo` if measured) |
| Respond to a user action | Put the logic in the event handler |
| Fetch application data | Use a server-state library or RSC (see Data fetching) |
| Reset state when a prop changes | Give the component a `key` tied to that prop |
| Notify a parent of state change | Lift the state, or call the parent's callback in the handler |
| Initialise something once per app | Module-scope guard, not an effect |

Legitimate effects synchronise with something outside React: DOM measurement, subscriptions,
third-party widgets, analytics on mount. Use primitive dependencies (`[id, name]`), not fresh
objects (`[{ id, name }]`).

## State location

The five-step decision ladder (component, common ancestor, Context, external store, server-state library) is rule `react/patterns.md` (State Location).

Colocate by default. Most pages need neither context nor a global store. Split contexts so a
change to notifications does not re-render every theme consumer. When subscribing to a store,
select the narrowest value (`useStore(s => s.cart.length > 0)`), not the whole object.

## Composition recipes

```tsx
// Slot via children
<Layout><Header /><Main>{content}</Main></Layout>

// Named slots
<Page header={<Nav />} sidebar={<Filters />}><Results /></Page>

// Compound components sharing state through context
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="profile"><Profile /></Tabs.Panel>
  <Tabs.Panel value="settings"><Settings /></Tabs.Panel>
</Tabs>
```

Render props still work but a hook returning the same shape (`useData(id)`) is usually cleaner.

## Lists and keys

- Stable keys, never the index for lists that reorder: see rule `react/patterns.md` (Lists, Forms, Composition).
- A `key` change deliberately remounts; use it to reset form state when the edited entity changes.
- Render conditionally with a ternary, not `&&`, when the left side can be `0` or `""`:
  `{count > 0 ? <Badge>{count}</Badge> : null}`.
- Virtualise (`@tanstack/react-virtual`, `react-window`) once visible rows exceed roughly fifty
  with non-trivial content; before that, `content-visibility: auto` on rows is often enough.

