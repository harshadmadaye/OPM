## Project layout with uv, ruff, pytest

```
myproject/
  pyproject.toml
  uv.lock
  README.md
  src/
    mypackage/
      __init__.py
      __main__.py          # python -m mypackage
      config.py
      orders/              # organise by feature, not by layer
        __init__.py
        models.py
        service.py
        repository.py
  tests/
    conftest.py
    orders/
      test_service.py
```

```toml
[project]
name = "mypackage"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["pydantic>=2", "httpx>=0.27"]

[dependency-groups]
dev = ["pytest>=8", "pytest-cov", "pytest-asyncio", "ruff", "pyright"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "PTH", "RUF"]

[tool.pyright]
strict = ["src"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q --strict-markers"
asyncio_mode = "auto"
```

Everyday commands:

```bash
uv sync                          # create .venv and install locked deps
uv add httpx                     # add a dependency and update the lock
uv add --group dev pytest-cov    # dev dependency
uv run pytest                    # run tests in the project env
uv run ruff check . --fix && uv run ruff format .
uv run pyright
uv run python -m mypackage
```

The `src/` layout guarantees tests import the installed package, not the working directory.
Ruff replaces black, isort, flake8, and pyupgrade; do not run them alongside it.

## Testing conventions

- One test module per source module, mirrored under `tests/`.
- Fixtures in `conftest.py`; prefer small factory functions over deep fixture graphs.
- `pytest.raises` with `match=` for error paths. `tmp_path` for filesystem tests. `monkeypatch`
  for environment variables.
- Parametrize instead of copy-pasting near-identical tests.
- Mock at boundaries (HTTP, clock, database) using `respx`, `freezegun`, or a fake repository
  class; do not mock your own modules.

