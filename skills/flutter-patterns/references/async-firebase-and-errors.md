## Async and streams

```dart
// Concurrent futures with record destructuring
final (users, orders) = await (userRepo.fetchAll(), orderRepo.recent()).wait;

// Always guard BuildContext after an await
Future<void> _submit() async {
  setState(() => _busy = true);
  try {
    await _service.save(_draft);
    if (!mounted) return;
    context.go('/done');
  } on ServiceException catch (e) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
  } finally {
    if (mounted) setState(() => _busy = false);
  }
}

// Streams: expose from the repository, consume declaratively
Stream<List<Message>> watchThread(String id) => _source.watch(id).map(Message.listFrom);

StreamBuilder<List<Message>>(
  stream: repo.watchThread(threadId),
  builder: (context, snapshot) => switch (snapshot) {
    AsyncSnapshot(connectionState: ConnectionState.waiting) => const Loader(),
    AsyncSnapshot(:final error?) => ErrorView(message: '$error'),
    AsyncSnapshot(:final data?) => MessageList(messages: data),
    _ => const SizedBox.shrink(),
  },
)
```

- Never store a `StreamSubscription` without cancelling it in `dispose`; prefer `StreamBuilder`
  or a provider that manages the lifecycle.
- Wrap external failures in typed exceptions at the repository layer; the UI never catches
  `FirebaseException` directly.
- Cancel or debounce user-driven async work (search-as-you-type) so stale results cannot
  overwrite fresh ones.

## Firebase usage patterns

Keep Firebase behind repository interfaces so widgets and state classes depend on your types,
not on the SDK, and tests can substitute fakes.

```dart
abstract interface class NotesRepository {
  Stream<List<Note>> watchAll(String uid);
  Future<void> upsert(Note note);
}

class FirestoreNotesRepository implements NotesRepository {
  FirestoreNotesRepository(this._db);
  final FirebaseFirestore _db;

  CollectionReference<Note> _notes(String uid) => _db
      .collection('users').doc(uid).collection('notes')
      .withConverter<Note>(
        fromFirestore: (snap, _) => Note.fromJson({...snap.data()!, 'id': snap.id}),
        toFirestore: (note, _) => note.toJson()..remove('id'),
      );

  @override
  Stream<List<Note>> watchAll(String uid) => _notes(uid)
      .orderBy('updatedAt', descending: true)
      .snapshots()
      .map((s) => s.docs.map((d) => d.data()).toList());

  @override
  Future<void> upsert(Note note) => _notes(note.ownerId).doc(note.id).set(note, SetOptions(merge: true));
}
```

- **Auth**: expose `authStateChanges()` as a provider; derive a sealed `AuthStatus` from it and
  drive router redirects from that, not from widgets checking `currentUser` directly.
- **Firestore**: always `withConverter`; model documents with freezed; keep per-user data under
  `users/{uid}/...` so security rules stay simple; paginate with `limit` + `startAfterDocument`;
  never query unbounded collections into memory.
- **Security rules are the real authorisation layer.** Client checks are UX, not security. Test
  rules with the emulator.
- **Cloud Functions**: call via `FirebaseFunctions.instance.httpsCallable('name')`, wrap the
  result in a typed model, and map `FirebaseFunctionsException` codes to your own exceptions.
- **Emulators** for local development and integration tests: `firebase emulators:start`, then
  `useAuthEmulator`, `useFirestoreEmulator` behind a `kDebugMode` or `--dart-define` flag.
- **Crashlytics**: hook `FlutterError.onError` and `PlatformDispatcher.instance.onError` in
  `main()`; record handled exceptions from the repository layer with context.

## Error handling

```dart
void main() {
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    crashReporter.recordFlutterError(details);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    crashReporter.record(error, stack, fatal: true);
    return true;
  };
  runApp(const ProviderScope(child: App()));
}
```

- Repository layer converts SDK exceptions into a small app exception hierarchy.
- State layer turns exceptions into `Failed` states; the UI renders them.
- Replace the red `ErrorWidget` in release builds with `ErrorWidget.builder`.

