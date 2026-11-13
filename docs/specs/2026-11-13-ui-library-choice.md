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
2. Search by default instead of recommending a fixed list, so suggestions stay current:
   - Search once per project: one web search, keep only OSI-licensed libraries with a release
     in the last 12 months that support the stack version, rank by fit, maintenance and
     adoption, keep the top three. Facts come from the search results, never invented.
   - Ask once: the top three (first marked Recommended), then "Custom components". The
     automatic free-text "Other" lets the developer name any library. The answer is final;
     there is no second round, so nothing can loop.
3. Fallback lists, used only when search is unavailable or finds fewer than three: Web/React
   shadcn/ui, Mantine, MUI; Flutter Material 3, shadcn_ui, Forui. The gap is said plainly.
4. Skip the question when the brief names a library, a library is already installed, or the
   project is API only. Mobile and web asks one question per UI stack in a single call.
5. Record `UI library: <name> (<reason>; source: search | fallback | developer)` in the Stack
   section of the spec or design, and `ui-library-candidates: <a>, <b>, <c>` after the search,
   so a revisited question reuses them instead of searching again.
6. `jump-start`: the Phase 5 foundation installs the library and wires the token theme; build
   agents use library components first and log any hand-built gap in DECISIONS.md.
7. `frontend-design`: detect the installed library before building, compose from its
   components, put tokens into its theme, hand-build only gaps. It asks no new question.
8. `react-patterns`, `flutter-patterns`: theme and wrap library components, never fork them.

## Testing

`tests/ui-library-choice.test.js` checks the fallback tables (three libraries per stack, each
with description, licence, install, theme hook and detect signal), that search comes first and
runs once, that there is a single question with no search option, and that every entry point
references the catalogue or the detection. The existing suite, token budget included, stays
green.
