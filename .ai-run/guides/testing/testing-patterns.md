# Testing Patterns

## Two-Tier Model

| Tier | xUnit trait | Scope | DB |
|---|---|---|---|
| Unit | (none) | Domain logic, use cases, HTTP translation — all via fakes | None |
| Rel | `[Trait("Category","Rel")]` | SQL store, real connection, concurrency proof | Real SQL Server 2022 required |

## Unit Tests (27 tests)

All external dependencies replaced by fakes. No network, no DB.

| Fake | File | Purpose |
|---|---|---|
| `FakeSession` | `tests/Harmonia.UnitTests/Fakes.cs` | Returns scripted `SessionContext?` |
| `FakeSlotGrid` | `tests/Harmonia.UnitTests/Fakes.cs` | Returns fixed slot key list |
| `RecordingStore` | `tests/Harmonia.UnitTests/Fakes.cs` | Scripts `ClaimResult`; captures all calls for assertion |

Run: `dotnet test Harmonia.sln --filter "Category!=Rel"`

## Rel-Tier Rules (7 tests)

The Rel tier **never skips and never uses in-memory substitutes**. `SqlServerFixture` throws `InvalidOperationException` at startup if `HARMONIA_SQL_CONNSTR` is unset — `tests/Harmonia.IntegrationTests/SqlServerFixture.cs:19`.

Each test uses a unique slot key (`$"T-{Guid.NewGuid():N}"`) to prevent cross-test interference.

| Test | What it proves |
|---|---|
| `T13` — `Two_simultaneous_claims_yield_one_winner` | Exactly one `Claimed` + one `AlreadyHeldByOther` under race; the R1 proof |
| `T14` — ten parallel iterations | Exactly one row per slot after ×10 concurrent attempts |
| `T18` — dead endpoint | Unreachable store → `Unavailable`; zero rows written on real store |

Run: `dotnet test Harmonia.sln --filter "Category=Rel"` (requires `HARMONIA_SQL_CONNSTR`)

## TDD Iron Law

No production code without a failing test first. Watch each test fail for the right reason before implementing.

| Avoid | Prefer |
|---|---|
| Implementation before test | Write test → RED → implement → GREEN |
| Stubs that return default values | Stubs that throw `NotImplementedException` — gives proper RED in compiled language |
| In-memory substitutes for the Rel tier | Real SQL Server; see `quality-gates.md` Rel gate |

## Log Exclusion Tests

`tests/Harmonia.UnitTests/Api/LogExclusionTests.cs` — verifies `householdRef` value never appears in any log output across all four `ClaimResult` outcome paths. This is the automated R3 (PII) enforcement check.
