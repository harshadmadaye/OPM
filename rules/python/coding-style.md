---
paths:
  - "**/*.py"
---
# Python Coding Style

Extends `common/coding-style.md`.

## Standards

- PEP 8. Type annotations on every function signature; run `mypy` or `pyright` in CI.
- `ruff` for linting and formatting (`ruff check`, `ruff format`); `ruff` also sorts imports.
- `logging` module, never `print()`, in application code.

## Immutability

```python
from dataclasses import dataclass
from typing import NamedTuple

@dataclass(frozen=True)
class User:
    name: str
    email: str

class Point(NamedTuple):
    x: float
    y: float
```

Return new collections from functions instead of mutating arguments.

## Structure

- `Protocol` for duck-typed interfaces; `dataclass` or Pydantic models for DTOs.
- Context managers (`with`) for resources; generators for lazy iteration.
- Small modules organized by domain, not by type.

## Errors

- Catch specific exceptions; never bare `except:` or `except Exception: pass`.
- Re-raise with context: `raise ServiceError("...") from exc`.
- Log with identifiers (user id, request id) at the level that matches severity.

## Secrets and Config

```python
import os

api_key = os.environ["API_KEY"]  # raises KeyError at startup if missing
```

Load configuration once at startup and fail fast on missing values. Never commit `.env`.

## FastAPI (when used)

- Build the app in `create_app()`; keep routers thin and move logic into services.
- `async def` endpoints use async DB and HTTP clients; no `requests` or sync sessions inside async routes.
- Sessions and auth come from `Depends`; do not create clients inside handlers.
- Separate request, update, and response schemas. Response models never include password hashes or tokens.
- Environment-specific CORS; never wildcard origins with credentials. Rate-limit auth and write endpoints.

Run `bandit -r src/` and `pip-audit` (or `uv run pip-audit`) before releases.

<!-- Adapted from affaan-m/ecc (MIT) -->
