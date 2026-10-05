## Server / Client boundaries (Next.js App Router)

```tsx
// Server Component: default, async, ships no JS for itself
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();
  return <ProductView product={product} action={<AddToCart productId={product.id} />} />;
}

// Client Component: opt in
"use client";
export function AddToCart({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button disabled={pending} onClick={() => startTransition(() => addToCart(productId))}>
      {pending ? "Adding..." : "Add to cart"}
    </button>
  );
}
```

Rules at the boundary:

- Server -> Client: pass serialisable props or `children`. Never a function, class instance, or Date without serialising.
- Client -> Server: call Server Actions from `<form action>` or event handlers.
- Client Components cannot import Server Components: see rule `react/patterns.md` (Server / Client Boundary).
- Push `"use client"` as far down the tree as possible so layouts and data-heavy parents stay on the server.
- Pass Client Components only the fields they render; project at the query layer.
- No mutable module-level state on the server: it is shared across requests.

Server Actions are public endpoints; the checks they need are rule `react/patterns.md` (Security). Example:

```ts
"use server";
export async function deleteItem(formData: FormData) {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  const id = String(formData.get("id"));
  const item = await db.item.findUnique({ where: { id } });
  if (item?.ownerId !== session.user.id) throw new Error("Forbidden");
  await db.item.delete({ where: { id } });
}
```

## Data fetching

| Need | Use |
|---|---|
| Per-request data in the App Router | `await` in a Server Component |
| Client cache, mutations, invalidation | TanStack Query |
| Lightweight client cache | SWR |
| Real-time | SSE, WebSocket, or the library's subscription API |
| Fire-and-forget on interaction | `fetch` inside the handler |

Do not fetch application data with `useEffect` + `fetch`: races, no cache, no dedupe, no retry,
no Suspense. Two components that need the same data should share one request; a query library
does that for free.

Avoid waterfalls on the server:

```ts
// Sequential: three round trips
const user = await getUser(id);
const posts = await getPosts(id);

// Parallel
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);

// Or split into sibling Server Components; React renders them concurrently
```

Check cheap synchronous conditions before awaiting; move an `await` into the branch that needs
it. Wrap per-request loaders in `React.cache()` so three components asking for the same user
produce one query.

## Suspense and error boundaries

```tsx
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<UserSkeleton />}>
    <UserDetail id={id} />
  </Suspense>
</ErrorBoundary>
```

- Boundary placement: rule `react/patterns.md` (Server / Client Boundary). Reserve space
  in the fallback to avoid layout shift.
- Error boundaries catch render errors, not event-handler or async errors; handle those locally.
- `react-error-boundary` gives a hook-friendly wrapper around the class API.

## Forms

React 19 actions for new code:

```tsx
"use client";
import { useActionState } from "react";

export function UserForm() {
  const [state, formAction, pending] = useActionState(updateUser, { error: null as string | null });
  return (
    <form action={formAction}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required />
      <button type="submit" disabled={pending}>Save</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

Server-side schema validation and the controlled / uncontrolled / form-library choice are rule
`react/patterns.md` (Security; Lists, Forms, Composition).
`useOptimistic` gives instant feedback for mutations that almost always succeed.

