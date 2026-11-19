# Redesign contract

A redesign changes how something looks, never what it does.

## 1. Inventory first

Before touching code, list from the current files:

- every link and its target
- every form field with its name, type and validation
- every event handler (click, submit, change, keyboard)
- every `data-testid` and accessibility label
- every route or URL the screen reads

Save the inventory in the task notes. It is the acceptance list.

## 2. Choose one depth

| Depth | Allowed | Not allowed |
|---|---|---|
| **full** | New layout, new components, new hierarchy | Removing inventory items |
| **restyle** | Tokens, type, spacing, colour, radius, icons | Moving elements between sections |
| **polish** | Spacing, alignment, states, small copy fixes | Layout or colour changes |

Say which depth you chose, and never blend depths: a restyle that "also moves the sidebar" is a full
redesign and needs the user's yes.

## 3. Verify against the inventory

After the change, walk the inventory: every item still exists and still works. A missing item
fails the redesign. Never edit or delete a test to make it pass; if a test's selector broke, keep
the `data-testid`.
