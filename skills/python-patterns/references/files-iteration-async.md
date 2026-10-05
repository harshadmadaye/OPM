## Paths and files

`pathlib` everywhere; `os.path` string juggling is legacy.

```python
from pathlib import Path

CONFIG_DIR = Path.home() / ".myapp"

def load_config(path: Path = CONFIG_DIR / "config.toml") -> Settings:
    if not path.is_file():
        raise ConfigError(f"config not found: {path}")
    return Settings.model_validate(tomllib.loads(path.read_text(encoding="utf-8")))

for source in Path("data").glob("*.csv"):
    target = source.with_suffix(".parquet")
```

Always pass `encoding="utf-8"` when reading or writing text. Use `Path.resolve()` and check
`is_relative_to()` before writing to a path derived from user input.

## Context managers

Anything that acquires must release, and `with` is how Python says so.

```python
from contextlib import contextmanager
import time

@contextmanager
def timed(label: str) -> Iterator[None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        logger.info("%s took %.3fs", label, time.perf_counter() - start)

class Transaction:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def __enter__(self) -> Self:
        self._conn.begin()
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is None:
            self._conn.commit()
        else:
            self._conn.rollback()
        return False  # never swallow the exception
```

Use `contextlib.ExitStack` when the number of resources is dynamic. Return `False` from `__exit__`
unless suppressing is the whole point.

## Iteration and generators

```python
# Generator: lazy, constant memory
def read_records(path: Path) -> Iterator[Record]:
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            yield Record.parse(line.rstrip("\n"))

total = sum(r.amount for r in read_records(path))       # generator expression, no list

# Comprehension for simple transforms; a named function once it needs two conditions
active_emails = [u.email for u in users if u.is_active]
```

Use `enumerate`, `zip(strict=True)`, `itertools` (`batched`, `groupby`, `chain`) before writing
index arithmetic. Build strings with `"".join(parts)` or an f-string, never `+=` in a loop.

## Async basics

Use `asyncio` for I/O-bound concurrency (HTTP, sockets, database drivers with async support).
Use a thread pool for blocking libraries you cannot change. Use processes for CPU-bound work.

```python
import asyncio
import httpx

async def fetch_json(client: httpx.AsyncClient, url: str) -> JSON:
    response = await client.get(url, timeout=10.0)
    response.raise_for_status()
    return response.json()

async def fetch_all(urls: list[str]) -> list[JSON | BaseException]:
    async with httpx.AsyncClient() as client:
        async with asyncio.TaskGroup() as group:
            tasks = [group.create_task(fetch_json(client, url)) for url in urls]
    return [task.result() for task in tasks]

# Blocking call inside async code
data = await asyncio.to_thread(legacy_blocking_read, path)
```

Rules: never call blocking I/O or `time.sleep` inside a coroutine; bound concurrency with
`asyncio.Semaphore` when fanning out to an external service; prefer `TaskGroup` (3.11+) over
bare `gather` so failures cancel siblings and propagate as an `ExceptionGroup`; pass timeouts explicitly.

