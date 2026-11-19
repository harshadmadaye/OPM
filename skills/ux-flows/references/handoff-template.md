# Handoff template

`docs/ux-flows/<feature>/handoff.md` is the input to `opm:writing-plans`. It holds three
sections, shown here with a worked example.

## Screen inventory (copied from flows.md)

| Screen | Use cases | Key elements | Outgoing links |
|---|---|---|---|
| Cart | UC-01 | Line items, Checkout button | Checkout, Home |
| Checkout | UC-01, UC-02 | Address form, Pay button | Confirmation, Payment failed, Cart |
| Payment failed | UC-02 | Error message, Retry button | Checkout |
| Confirmation | UC-01 | Order number, Continue shopping | Home |
| Home | UC-01 | Product grid | Cart |

## Navigation

| From screen | Element | To screen |
|---|---|---|
| Cart | Checkout button | Checkout |
| Checkout | Pay button (2xx) | Confirmation |
| Checkout | Pay button (4xx or 5xx) | Payment failed |
| Payment failed | Retry button | Checkout |
| Confirmation | Continue shopping | Home |

## Endpoints

| Method | Path | Called from | Success | Errors |
|---|---|---|---|---|
| POST | /api/orders | Checkout, Pay button | 201 with orderId | 402 payment declined, 422 invalid address |

## Open questions

- Does a declined card keep the address the user typed?
