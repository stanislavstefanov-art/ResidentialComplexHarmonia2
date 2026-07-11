# Code Quality Standards

Source: `docs/context/standards/code-quality.md` (authoritative; this guide is the machine-readable copy).

## Build Strictness

| Setting | Value | Where |
|---|---|---|
| `TreatWarningsAsErrors` | `true` | `Directory.Build.props:9` |
| `Nullable` | `enable` | `Directory.Build.props:8` |
| `ImplicitUsings` | `enable` | `Directory.Build.props:9` |

## Naming

| Context | Convention |
|---|---|
| Types / methods / public members | PascalCase |
| Locals / parameters | camelCase |
| Async methods | Suffix `Async` |
| Test methods | Underscore_separated behavior description — e.g. `Two_simultaneous_claims_yield_one_winner` |
| Projects | `Harmonia.<Layer>` — `Harmonia.Domain`, `Harmonia.Application`, `Harmonia.Api` |
| Namespaces | `Harmonia.<Layer>.<Capability>` — e.g. `Harmonia.Domain.Reservations` |

Never name a project after a single capability (`Harmonia.Reservations.*`). A second feature (`Maintenance`) adds a sub-namespace in the same layer projects, not new projects.

## SQL

| Avoid | Prefer |
|---|---|
| String interpolation of values into SQL | `SqlParameter` — `src/Harmonia.Api/Adapters/SqlReservationStore.cs` |
| ORM for the atomic claim path | Raw `INSERT`; let the PK constraint decide the race (R1) |

## Type Safety

| Avoid | Prefer |
|---|---|
| String/bool for domain outcomes | Enum or record — `src/Harmonia.Domain/ClaimResult.cs`, `ClaimOutcome.cs` |
| `float`/`double` for money or identifiers | Typed value objects |
| Test-only methods on production types | Fakes in the test assembly — `tests/Harmonia.UnitTests/Fakes.cs` |

## Domain Purity

Slot-state derivation and outcome mapping are pure functions with no I/O — `src/Harmonia.Domain/SlotStateDeriver.cs`, `OutcomeMapper.cs`. Unit-test them directly without fakes.

## Documentation

XML doc on public types and methods explaining the invariant they uphold, particularly on the claim path — `src/Harmonia.Application/Ports.cs`.

## Common Violations

| Pattern | Why it breaks |
|---|---|
| App-level read-then-write on the claim path | Violates R1 — two concurrent reads both see free, both INSERT, one loses but the read already happened. Use atomic INSERT only. |
| Logging `householdRef` or derived PII | Violates R3 — log opaque ids and outcome tokens only |
| Business logic in the API handler | Violates layering — the handler translates only; the use case owns all logic |
