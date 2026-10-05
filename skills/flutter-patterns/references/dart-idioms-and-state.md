## Null safety and Dart idioms

```dart
// Avoid `!`; use `?.`, `??`, guards, or pattern matching
final name = user?.name ?? 'Guest';

String describe(User? user) => switch (user) {
  User(:final name, :final email) => '$name <$email>',
  null => 'Guest',
};

// `late` only when initialisation is guaranteed before first read (initState)
late final AnimationController _controller;
```

- `final` and `const` by default: rule `dart/coding-style.md` (Immutability).
- `firstWhereOrNull` (package:collection) instead of `firstWhere` with a throwing `orElse`.
- Exhaustive `switch` expressions over `if` chains for sealed types and enums.
- Records for lightweight multi-value returns: `(int count, double total) summarise(...)`.

## Immutability

### Sealed classes for state

The sealed `Loading` / `Loaded` / `Failed` hierarchy with an exhaustive `switch` is rule `dart/coding-style.md` (Sealed Types), with its example.

The compiler enforces every branch; adding a state variant breaks every incomplete switch at
build time, which is exactly what you want.

### freezed for data classes

```dart
@freezed
class User with _$User {
  const factory User({
    required String id,
    required String name,
    @Default(false) bool isAdmin,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

final updated = user.copyWith(name: 'New name');   // never mutate, always copy
```

Use freezed for models that cross a boundary (JSON, Firestore documents, state objects with
several fields). Use a plain `const` class with `final` fields for two- or three-field values,
and records for ad-hoc tuples. Run `dart run build_runner build --delete-conflicting-outputs`
after model changes; whether generated files are committed is rule `dart/coding-style.md` (Architecture).

## State management

The choice table is in SKILL.md; these are the worked examples.

### Riverpod

```dart
@riverpod
Future<List<Product>> products(Ref ref) async {
  final repo = ref.watch(productRepositoryProvider);
  return repo.fetchAll();
}

@riverpod
class Cart extends _$Cart {
  @override
  List<CartItem> build() => const [];

  void add(Product product) {
    final existing = state.firstWhereOrNull((i) => i.productId == product.id);
    state = existing == null
        ? [...state, CartItem(productId: product.id, quantity: 1)]
        : [for (final i in state) i.productId == product.id ? i.copyWith(quantity: i.quantity + 1) : i];
  }
}

@riverpod
int cartCount(Ref ref) => ref.watch(cartProvider).length;   // derived, cached
```

`ref.watch` in build, `ref.read` in callbacks, `ref.listen` for one-shot reactions (snackbars,
navigation). Derived providers replace manual selectors.

### Cubit

```dart
class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this._auth) : super(const AuthState.initial());
  final AuthService _auth;

  Future<void> signIn(String email, String password) async {
    emit(const AuthState.loading());
    try {
      emit(AuthState.authenticated(await _auth.signIn(email, password)));
    } on AuthException catch (e) {
      emit(AuthState.error(e.message));
    }
  }
}
```

