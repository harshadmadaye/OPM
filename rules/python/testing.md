---
paths:
  - "**/*.py"
---
# Python Testing

Extends `common/coding-style.md`. For the red-green-refactor loop see `opm:tdd-workflow`.

## Tooling

- `pytest` with `pytest-cov` (`pytest --cov=src --cov-report=term-missing`).
- `pytest.mark.unit` / `pytest.mark.integration` to separate fast from slow suites; register markers in `pyproject.toml`.
- `httpx.AsyncClient` (or the framework's async test client) for async apps.

## What to Test

- Every new branch, state change, and error path in the change; behaviour over line count.
- Bug fixes ship with a regression test that fails before the fix.
- Public API through the public API; internals may change without breaking tests.

## Structure

```python
def test_returns_none_when_user_does_not_exist(repo: FakeUserRepository) -> None:
    # Arrange
    repo.clear()
    # Act
    result = repo.find_by_id("missing")
    # Assert
    assert result is None
```

- Fixtures for setup; prefer hand-written fakes over `MagicMock` for repositories and clients.
- FastAPI: override the exact dependency used by `Depends`, and clear `app.dependency_overrides` in teardown.
- Freeze time (`freezegun`, `time-machine`) instead of sleeping.

<!-- Adapted from affaan-m/ecc (MIT) -->
