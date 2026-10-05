## Widget composition

**Extract to classes, not methods.** A `_buildHeader()` method rebuilds with its parent and
cannot be `const`; a `_Header` widget can be skipped by the framework.

```dart
class _Header extends StatelessWidget {
  const _Header(this.title);
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(16),
    child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
  );
}
```

**Push rebuilds to the leaves.** The widget that watches state should be as small as possible.

```dart
class CounterPage extends StatelessWidget {
  const CounterPage({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Column(children: [
      ExpensiveHeader(),   // const: never rebuilt
      _CounterText(),      // only this watches the provider
      ExpensiveFooter(),
    ]),
  );
}

class _CounterText extends ConsumerWidget {
  const _CounterText();
  @override
  Widget build(BuildContext context, WidgetRef ref) => Text('${ref.watch(counterProvider)}');
}
```

- `const` constructors and `const` child trees wherever the values are compile-time constants.
- Widgets take data and callbacks; they do not fetch, persist, or navigate on their own.
- Keep `build` free of side effects and heavy work; compute in the state layer.
- Use `Theme.of(context)` tokens, not hardcoded colours and sizes.
- `ListView.builder` / `SliverList` for anything longer than a screen; never a `Column` of
  hundreds of children.

## Navigation

Use `go_router` with a `refreshListenable` bound to the auth stream so redirects re-evaluate
when auth changes. Typed routes (`go_router_builder`) remove string paths from widgets. Keep
route definitions in one file; widgets call `context.go`/`context.push` with route objects.

