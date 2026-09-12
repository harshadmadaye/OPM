---
paths:
  - "**/*.dart"
---
# Dart / Flutter Coding Style

Extends `common/coding-style.md`. Covers style, architecture, and mobile security.

## Formatting and Naming

- `dart format` on every file; CI runs `dart format --set-exit-if-changed .` and `dart analyze --fatal-infos`.
- Trailing commas on multi-line argument and parameter lists.
- `camelCase` variables and members, `PascalCase` types, `snake_case` files, `_` prefix for private members.
- `package:` imports for cross-feature code; order `dart:`, external packages, internal packages.

## Immutability

- `final` locals, `const` for compile-time values, `const` constructors when all fields are final.
- Immutable state classes with `copyWith()` (hand-written or `freezed`); unmodifiable collections from public APIs.

## Null Safety

- Avoid `!`. Prefer `?.`, `??`, an early-return guard, or a pattern match. Reserve `!` for cases where null is a programming error.
- Avoid `late` unless initialization before first use is guaranteed. Use `required` for mandatory constructor parameters.

```dart
final name = switch (user) {
  User(:final name) => name,
  null => 'Unknown',
};
```

## Sealed Types

Model closed state hierarchies with `sealed` classes and exhaustive `switch` (no wildcard):

```dart
sealed class AsyncState<T> { const AsyncState(); }
final class Loading<T> extends AsyncState<T> { const Loading(); }
final class Success<T> extends AsyncState<T> { const Success(this.data); final T data; }
final class Failure<T> extends AsyncState<T> { const Failure(this.error); final Object error; }

return switch (state) {
  Loading() => const CircularProgressIndicator(),
  Success(:final data) => DataWidget(data),
  Failure(:final error) => ErrorView(error.toString()),
};
```

## Errors and Async

- Name the exception type in `on` clauses; never bare `catch (e)`. Never catch `Error` subtypes.
- Every `Future` is awaited or wrapped in `unawaited(...)`. Do not mark a function `async` if it never awaits.
- `Future.wait` for independent concurrent work. Check `context.mounted` before using `BuildContext` after an `await`.
- Set timeouts on every HTTP client.

```dart
try {
  await fetchUser();
} on NetworkException catch (e) {
  log('Network error: ${e.message}');
} on NotFoundException {
  handleNotFound();
}
```

## Architecture

```
lib/
  domain/        # pure Dart: entities, repository interfaces, use cases
  data/          # datasources, DTOs (fromJson/toJson), repository implementations
  presentation/  # widgets, pages, state management
```

- `domain/` imports neither `package:flutter` nor `data/`. DTOs map to entities at the repository boundary. Presentation calls use cases, not repositories.
- Pick one state-management approach per app (Riverpod, BLoC/Cubit, or `ChangeNotifier` view models) and inject dependencies at the composition root (Riverpod providers or `get_it`).
- Generated files (`.g.dart`, `.freezed.dart`) are either all committed or all gitignored; never hand-edited.

## Security

- No secrets in Dart source. `--dart-define` values are configuration, not secrets; anything in the binary is readable. Server-side secrets stay behind a backend.
- Tokens and PII go in `flutter_secure_storage`, never `SharedPreferences` or plain files. Clear them on logout.
- HTTPS only; block cleartext in `network_security_config.xml` and ATS. Consider certificate pinning for high-value endpoints.
- Parameterized queries for `sqflite`/`drift`. Validate deep links (`Uri.tryParse`, allowlisted host and path) before navigating.
- WebView: `webview_flutter` v4+, JavaScript disabled unless required, `NavigationDelegate` allowlisting hosts.
- Declare only needed permissions; `android:exported="false"` unless a component must be public.
- Release builds: `--obfuscate --split-debug-info=...`; keep the debug-info directory out of version control.
- Never log tokens or passwords (`print`, `debugPrint`).

<!-- Adapted from affaan-m/ecc (MIT) -->
