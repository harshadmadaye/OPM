## Error handling

- Specific exceptions only and `raise ... from e` chaining: see rule `python/coding-style.md` (Errors).
- Define a small hierarchy rooted at one application exception; callers catch the root when they
  want "anything ours", the leaf when they can act on it.
- Log with `logger.exception(...)` at the level that handles the error, once. Do not log and re-raise
  at every layer.
- Friendly user messages, full context in logs: rule `common/coding-style.md` (Error Handling).

```python
class AppError(Exception):
    """Base for all errors raised by this application."""

class ConfigError(AppError): ...
class NotFoundError(AppError): ...

def load_user(user_id: str) -> User:
    try:
        row = repo.get(user_id)
    except RepositoryError as e:
        raise AppError(f"could not load user {user_id}") from e
    if row is None:
        raise NotFoundError(f"user not found: {user_id}")
    return User.model_validate(row)
```

## Logging and configuration

- `logging.getLogger(__name__)` per module; configure handlers once at the entry point.
- Lazy formatting: `logger.info("user %s logged in", user_id)`, not an f-string, so the string
  is built only when the level is enabled.
- Load config once at startup, fail fast, no secrets in source: rule `python/coding-style.md`
  (Secrets and Config). Validate it into a `Settings` model.

## Anti-patterns

```python
def add(item, items=[]): ...                 # mutable default; use None and create inside
if type(obj) == list: ...                    # use isinstance
if value == None: ...                        # use `is None`
from os.path import *                        # explicit imports only
except: pass                                 # catch specific, handle or re-raise
print(f"debug {x}")                          # use logging; no print in library code
open(path).read()                            # no context manager, no encoding
results = []; for x in xs: results.append(f(x))   # [f(x) for x in xs]
```

