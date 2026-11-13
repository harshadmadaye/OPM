# UI library choice

Date: 2026-11-13. Status: approved in chat, implemented on `feature/ui-library-choice`.

## Problem

OPM picks a stack but never a component library. A Next.js project gets Tailwind and every
button, dialog, form and table is hand-built. A Flutter project uses Material implicitly and
never decides it. `opm-design:frontend-design` always builds from scratch, even when a library
is installed. That is avoidable work: mature open-source libraries already cover most components.

## Gap assessment

| Stack | Today | Gap |
|---|---|---|
| Web (Next.js, Tailwind) | Tailwind only | No library offered; all components hand-built |
| Mobile (Flutter) | Material, implicit | Never chosen; community kits never offered |
| Mobile and web | Flutter + Next.js | Two UI decisions, neither asked |
| API only | No UI | None; the question is skipped |
| React Native / Expo | Not a supported stack | Out of scope |

Entry points with the gap: `jump-start` Phase 2, `brainstorming` for new projects with a UI,
`opm-design:frontend-design` (no detection), `react-patterns` and `flutter-patterns` (no theming
guidance).

## Decisions

1. One catalogue, `skills/brainstorming/references/ui-libraries.md`, read by `jump-start` and
   `brainstorming`. No new skill, so the always-on token cost does not change.
2. Shortlists. Web/React: shadcn/ui, Mantine, MUI. Flutter: Material 3, shadcn_ui, Forui.
   The first two of each are shown in round 1; the third is held back for round 2.
3. Question flow, at most two rounds, never a loop:
   - Round 1: two curated libraries, "Search for more libraries", "Custom components". The
     automatic free-text "Other" accepts any library name. Anything but search is final.
   - Search runs at most once per project: one web search, keep only OSI-licensed libraries
     with a release in the last 12 months that support the stack version. Facts come from the
     search results, never invented. Unavailable or empty search is said plainly.
   - Round 2: the best three of the search finalists plus the held-back library, then "Custom
     components". No search option. The answer is final.
4. Skip the question when the brief names a library, a library is already installed, or the
   project is API only. Mobile and web asks one question per UI stack in a single call.
5. Record `UI library: <name> (<reason>; source: curated | searched | other)` in the Stack
   section of the spec or design, and `ui-library-searched: yes` once search has run, so a
   revisited question never offers search again.
6. `jump-start`: the Phase 5 foundation installs the library and wires the token theme; build
   agents use library components first and log any hand-built gap in DECISIONS.md.
7. `frontend-design`: detect the installed library before building, compose from its
   components, put tokens into its theme, hand-build only gaps. It asks no new question.
8. `react-patterns`, `flutter-patterns`: theme and wrap library components, never fork them.

## Testing

`tests/ui-library-choice.test.js` checks the catalogue shape (two round-1 libraries and one
held-back library per stack, each with description, licence, install, theme hook and detect
signal), the once-only search and the search-free round 2, and that every entry point
references the catalogue or the detection. The existing suite, token budget included, stays
green.
