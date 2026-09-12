---
paths:
  - "**/*.dart"
---
# Dart / Flutter Testing

Extends `common/coding-style.md`. For the red-green-refactor loop see `opm:tdd-workflow`.

## Tooling

| Type | Tool | Location | Covers |
|------|------|----------|--------|
| Unit | `dart:test` | `test/unit/` | Domain logic, state managers, repositories |
| Widget | `flutter_test` | `test/widget/` | Widgets with meaningful behaviour |
| Golden | `flutter_test` | `test/golden/` | Design-critical components |
| Integration | `integration_test` | `integration_test/` | Critical flows on a device or emulator |

`mocktail` (no codegen) or `mockito` for mocks; `bloc_test` for BLoC/Cubit; `fake_async` for time.

## What to Test

- Every state transition: loading to success, loading to failure, retry.
- Every new branch and error path in the change. Bug fixes ship with a regression test.
- Behaviour through the public API; prefer hand-written fakes over mocks for repositories.

## Patterns

```dart
test('usersProvider loads users from repository', () async {
  final container = ProviderContainer(
    overrides: [userRepositoryProvider.overrideWithValue(FakeUserRepository())],
  );
  addTearDown(container.dispose);
  expect(await container.read(usersProvider.future), isNotEmpty);
});

testWidgets('disables submit button while form is invalid', (tester) async {
  await tester.pumpWidget(const MaterialApp(home: SignUpForm()));
  await tester.pump();
  final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
  expect(button.onPressed, isNull);
});
```

- Widget tests wrap the subject in `MaterialApp` (and `ProviderScope`/`BlocProvider` overrides as needed).
- `fakeAsync` and `async.elapse(...)` for timers and debounce; never real `sleep`.
- Goldens: `flutter test --update-goldens` only for intentional visual changes; review the image diff.
- Test names describe behaviour: `returns null when user does not exist`.

Run `flutter test --coverage` in CI and inspect the report for untested state transitions.

<!-- Adapted from affaan-m/ecc (MIT) -->
