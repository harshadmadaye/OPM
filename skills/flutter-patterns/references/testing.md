## Testing

```dart
// Unit: pure logic and notifiers, with fakes
test('cart total sums price times quantity', () {
  final cart = Cart()..add(product(price: 250))..add(product(price: 250));
  expect(cart.total, 500);
});

// Widget: render with overrides, assert on what the user sees
testWidgets('shows item count badge', (tester) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [cartProvider.overrideWith(() => FakeCart(count: 3))],
    child: const MaterialApp(home: CartBadge()),
  ));
  expect(find.text('3'), findsOneWidget);
});

// Golden: visual regression for design-system widgets
await expectLater(find.byType(PrimaryButton), matchesGoldenFile('primary_button.png'));

// Integration (integration_test/app_test.dart): a real flow on a device or emulator
testWidgets('sign in and reach home', (tester) async {
  await tester.pumpWidget(const App());
  await tester.enterText(find.byKey(const Key('email')), 'user@example.com');
  await tester.tap(find.text('Sign in'));
  await tester.pumpAndSettle();
  expect(find.text('Home'), findsOneWidget);
});
```

- Fakes over mocks for repositories: rule `dart/testing.md` (What to Test).
- `pumpAndSettle` for animations; plain `pump` with a duration when something never settles
  (an infinite spinner).
- Find by `Key`, semantics label, or visible text; not by widget type when the type is generic.
- Firebase-backed flows run against the emulator suite in `integration_test`, never production.
- Commands: `flutter test`, `flutter test --coverage`, `flutter test integration_test`,
  `flutter test --update-goldens`.

