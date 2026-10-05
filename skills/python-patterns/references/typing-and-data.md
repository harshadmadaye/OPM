## Typing

Annotated signatures and a type checker in CI are rule `python/coding-style.md` (Standards). Use built-in generics and the union operator.

```python
from collections.abc import Iterable, Iterator, Callable, Sequence
from typing import Protocol, TypeVar, TypeAlias, Self

def first(items: Sequence[T]) -> T | None:
    return items[0] if items else None

JSON: TypeAlias = dict[str, "JSON"] | list["JSON"] | str | int | float | bool | None

class Renderable(Protocol):
    def render(self) -> str: ...

def render_all(items: Iterable[Renderable]) -> str:
    return "\n".join(item.render() for item in items)
```

- Prefer `collections.abc` types (`Iterable`, `Mapping`, `Sequence`) for parameters and concrete types (`list`, `dict`) for return values.
- `Protocol` for structural typing instead of abstract base classes when callers just need a shape.
- `Self` for fluent methods; `Literal[...]` for closed string sets; `TypedDict` for dict-shaped external payloads you do not control.
- Prefer the strict mode (`pyright` strict or `mypy --strict`). Untyped third-party libraries get a `py.typed` stub or a narrow `cast` at the import boundary, not `Any` spreading through the codebase.

## Data at the boundaries

Two tools, two jobs:

- **`dataclass`** for internal data you construct yourself. Frozen unless mutation is the point; `slots=True` when you create many.
- **`pydantic.BaseModel`** at system boundaries: request bodies, config files, API responses, message payloads. It validates and coerces once, on the way in, then the rest of the code trusts the types.

```python
from dataclasses import dataclass, field
from datetime import datetime, UTC
from pydantic import BaseModel, Field, field_validator

@dataclass(frozen=True, slots=True)
class Money:
    amount_minor: int
    currency: str

    def add(self, other: "Money") -> "Money":
        if other.currency != self.currency:
            raise ValueError(f"currency mismatch: {self.currency} vs {other.currency}")
        return Money(self.amount_minor + other.amount_minor, self.currency)

class CreateOrder(BaseModel):
    customer_id: str = Field(min_length=1)
    items: list[str] = Field(min_length=1)
    note: str | None = None

    @field_validator("items")
    @classmethod
    def no_duplicates(cls, items: list[str]) -> list[str]:
        if len(set(items)) != len(items):
            raise ValueError("duplicate items")
        return items

class Settings(BaseModel):
    database_url: str
    log_level: str = "INFO"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
```

Parse external input into a model at the edge (`CreateOrder.model_validate(payload)`); raise a
clear error there. Never pass raw `dict[str, Any]` deeper than the boundary. `NamedTuple` remains
fine for tiny immutable records like coordinates.

