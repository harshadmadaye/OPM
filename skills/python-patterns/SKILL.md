---
name: python-patterns
description: Provides idiomatic modern Python (3.11+) patterns covering type hints, dataclasses and pydantic at boundaries, pathlib, context managers, generators, async basics, explicit error handling, and a uv/ruff/pytest project layout. Use when writing, reviewing, or refactoring Python code or setting up a Python project.
---

# Python Patterns

Readable, explicit, typed. These patterns target Python 3.11 or newer with `uv` for
environments, `ruff` for lint and format, and `pytest` for tests.

Always-true conventions (PEP 8, annotations, immutability, specific exceptions, config and
secrets, FastAPI) live in OPM's rules `python/coding-style.md` and `python/testing.md`
(`.claude/rules/opm/python/` once installed, `rules/python/` in the plugin). This skill keeps
the patterns and worked examples.

## When to use

- Writing new Python modules, packages, scripts, or services.
- Reviewing Python diffs for idiom, typing, and error handling.
- Setting up or modernising a Python project's tooling.

## Core principles

- **Readability over cleverness.** Names say what things hold; comprehension over a three-line loop, a function over a three-clause comprehension.
- **Explicit over implicit.** No import-time side effects, no hidden global configuration.
- **EAFP where the exception is the normal control flow** (`try: d[key] except KeyError`), LBYL where a check is cheaper and clearer (`if path.exists()` before a destructive operation).
- **Immutability by default**: rule `python/coding-style.md` (Immutability).

## Decision rules

- **`dataclass`** for internal data you construct yourself; **`pydantic.BaseModel`** at system boundaries. Never pass raw `dict[str, Any]` deeper than the boundary.
- `pathlib` everywhere, always `encoding="utf-8"`.
- Anything that acquires must release, and `with` is how Python says so.
- `asyncio` for I/O-bound concurrency, a thread pool for blocking libraries, processes for CPU-bound work.

## References

- Read references/typing-and-data.md when annotating code or modelling data (dataclass, pydantic, Protocol).
- Read references/files-iteration-async.md when touching files, writing context managers or generators, or writing async code.
- Read references/errors-and-logging.md when designing exceptions, logging, or config, or reviewing for anti-patterns.
- Read references/project-and-testing.md when setting up a project (uv, ruff, pyright, pytest) or writing tests.

## Review checklist

- [ ] Every public function is annotated; `Any` appears only at a justified boundary.
- [ ] External input is validated into a model at the edge.
- [ ] Files, sockets, locks, and transactions are opened with `with`.
- [ ] No bare `except`; exceptions are chained; errors are logged once.
- [ ] `pathlib` and `encoding="utf-8"` for all file access.
- [ ] Async code has no blocking calls and bounds its concurrency.
- [ ] `ruff check`, `ruff format --check`, `pyright`, and `pytest` all pass.

## Related skills

- `opm:tdd-workflow` - pytest RED/GREEN cycle with `uv run pytest`.
- `opm:verification-loop` - the uv/ruff/pytest gate sequence.

<!-- Adapted from affaan-m/ecc (MIT) -->
