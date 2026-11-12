# Mermaid patterns

## Node shapes (fixed)

| Shape | Meaning |
|---|---|
| `((Start))` | Entry point |
| `[Screen]` | A screen or page |
| `{Decision?}` | A branch, written as a question |
| `([Action])` | A user or system action |
| `[[Sub-flow]]` | A flow drawn in its own diagram |

Keep every diagram to at most 20 nodes. Split anything larger into `[[Sub-flow]]` nodes, each
with its own diagram under its own heading.

## Shared classes

Start every flowchart with these lines so the diagrams look the same:

```mermaid
flowchart TD
  classDef screen fill:#ffffff,stroke:#374151
  classDef action fill:#f3f4f6,stroke:#6b7280
  classDef error fill:#fef2f2,stroke:#b91c1c
  start((Start)) --> cart[Cart]:::screen
  cart --> pay([Pay]):::action
  pay --> ok{Payment accepted?}
  ok -- yes --> done[Confirmation]:::screen
  ok -- no --> failed[Payment failed]:::error
  failed --> cart
```

## State diagram

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> loading: submit
  loading --> success: 2xx
  loading --> error: 4xx or 5xx
  loading --> offline: no network
  error --> idle: retry
  offline --> loading: back online
  success --> [*]
```

Add `empty` when a list or search can return nothing.

## Sequence diagram (only when a backend is called)

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web app
  participant A as API
  U->>W: Tap Pay
  W->>A: POST /api/orders
  A-->>W: 201 {orderId}
  W-->>U: Confirmation screen
```
