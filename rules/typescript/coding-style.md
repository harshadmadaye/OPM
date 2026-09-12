---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# TypeScript Coding Style

Extends `common/coding-style.md`.

## Types

- Add parameter and return types to exported functions, shared utilities, and public class methods. Let TypeScript infer obvious locals.
- Extract repeated inline object shapes into named types.
- `interface` for object shapes that may be extended or implemented; `type` for unions, intersections, tuples, and mapped types.
- Prefer string-literal unions over `enum` unless interop requires an enum.
- No `any` in application code. Use `unknown` for external input and narrow it; use generics when the type depends on the caller.

```typescript
// WRONG
function getErrorMessage(error: any) {
  return error.message
}

// CORRECT
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}
```

## Immutability

```typescript
// WRONG: mutation
function updateUser(user: User, name: string): User {
  user.name = name
  return user
}

// CORRECT: new object
function updateUser(user: Readonly<User>, name: string): User {
  return { ...user, name }
}
```

## Error Handling

- `async/await` with `try/catch`; type the caught value as `unknown` and narrow.
- Rethrow with context and keep the cause: `throw new Error('Load failed', { cause: error })`.
- Never `throw` a string. Never leave an empty `catch`.
- `JSON.parse` on external input always sits inside a `try/catch` or a schema parse.

## Input Validation and Config

Validate at the boundary with a schema library (zod, valibot) and infer the type from the schema:

```typescript
const userSchema = z.object({ email: z.string().email(), age: z.number().int().min(0) })
type UserInput = z.infer<typeof userSchema>
const user = userSchema.parse(input)
```

Read `process.env` once at startup, validate required keys, and export a typed config object. Throw at boot if a required value is missing.

## Async

- Never `array.forEach(async ...)`; use `for...of` or `Promise.all`.
- Independent awaits run in parallel with `Promise.all`.
- Intentional fire-and-forget is marked with `void` and a comment.

## Logging

No `console.log` in production code. Use the project's structured logger.

<!-- Adapted from affaan-m/ecc (MIT) -->
