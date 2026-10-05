---
name: flutter-patterns
description: Provides production Flutter and Dart 3 patterns covering widget composition, state management choice (Riverpod, BLoC, plain ChangeNotifier), immutability with freezed and records, sealed-class state, async and streams, Firebase usage (Auth, Firestore, Functions), navigation, and widget/integration testing. Use when writing, reviewing, or architecting Flutter apps or Dart packages.
---

# Flutter Patterns

Small const widgets, immutable state modelled with sealed types, side effects in a thin layer
above the UI, and tests at the widget boundary. Dart 3 features (records, patterns, sealed
classes) are assumed.

Always-true conventions (formatting, null safety, sealed types, errors, architecture, mobile
security, test tooling) live in OPM's rules `dart/coding-style.md` and `dart/testing.md`
(`.claude/rules/opm/dart/` once installed, `rules/dart/` in the plugin). This skill keeps the
patterns and worked examples.

## When to use

- Starting a Flutter feature and choosing how to structure widgets and state.
- Reviewing Dart for null safety, immutability, async correctness, or rebuild scope.
- Integrating Firebase services in a Flutter app.
- Writing widget, unit, or integration tests.

## State management

One approach per app: rule `dart/coding-style.md` (Architecture).

| Situation | Choice |
|---|---|
| Local, ephemeral UI state (a toggle, a text field, an animation) | `StatefulWidget` + `setState` |
| App or feature state, most new apps | Riverpod (code-generated providers) |
| Teams that want explicit event -> state transitions and event logs | BLoC / Cubit |
| Tiny app or package with no dependency budget | `ChangeNotifier` + `ListenableBuilder` |

## References

- Read references/dart-idioms-and-state.md when handling nulls, modelling state or data classes (sealed, freezed, records), or writing Riverpod or Cubit code.
- Read references/widgets-and-navigation.md when composing widgets, scoping rebuilds, or setting up `go_router`.
- Read references/async-firebase-and-errors.md when writing async or stream code, using Firebase, or wiring error handling.
- Read references/testing.md when writing unit, widget, golden, or integration tests.

## Anti-patterns

- `user!.name` where `user?.name ?? default` was possible.
- Widget-returning private methods instead of widget classes.
- `setState` for anything read outside the widget.
- `context` used after an `await` without a `mounted` check.
- Firestore queries or `FirebaseAuth.instance` calls inside `build`.
- A `Column` inside `SingleChildScrollView` for a long list.
- Catching `Exception` in the UI and showing `e.toString()`.
- Tests that pump the whole app to check one widget.

## Review checklist

- [ ] `dart analyze` clean; `flutter test` green.
- [ ] State is sealed/immutable; updates create new objects.
- [ ] Rebuild scope is minimal; `const` used where possible.
- [ ] Every `await` in a widget is followed by a `mounted` guard before using `context`.
- [ ] Firebase is behind repositories with `withConverter`; rules cover every access.
- [ ] Subscriptions and controllers are disposed.
- [ ] New behaviour has a widget or unit test that fails without it.

## Related skills

- `opm:tdd-workflow` - `flutter test` RED/GREEN cycle.
- `opm:verification-before-completion` (full gate) - `dart analyze` and `flutter test` as the release gate.

<!-- Adapted from affaan-m/ecc (MIT) -->
