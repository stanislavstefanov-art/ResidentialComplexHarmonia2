# Spec: Maintenance Fee Ledger

**Slug**: maintenance-fee-ledger  
**Branch**: feat/maintenance-fee-ledger  
**Date**: 2026-07-12

---

## Overview

Append-only ledger of maintenance fee charges per household. Management records charges; residents list their own. No edit, no delete. SQL Server store.

---

## Out of Scope

- Admin listing charges for a specified household (audit/billing review) — separate future use case.
- Pagination or filtering on the list endpoint.
- Amount currency field (single-currency system assumed).
- Any role beyond `IsResident` and `IsAdmin`.

---

## Commit Plan

Three commits in order; no ledger code before commit 1a is green.

| Commit | Message | What changes |
|---|---|---|
| 1a | `refactor: extract shared identity types to layer roots` | Move `HouseholdRef` → `Harmonia.Domain`, `ISession`/`SessionContext` → `Harmonia.Application`; update six using-directives in existing reservation files. Pure type move — 34 tests stay green. |
| 1b | `feat: add IsAdmin flag to ISession and wire DevAdminSession` | Add `bool IsAdmin { get; }` to `ISession`; update `SessionContext` to carry `HouseholdRef?` (nullable — admins have no household); update `DevSession` (`IsAdmin = false`); add `DevAdminSession` (`IsAdmin = true, IsResident = false, Household = null`) with same `IsDevelopment()` guard; record Gap #4 in `context/cold/gap-log.md`. |
| 2 | `feat: maintenance fee ledger — record and list charges` | All new domain, application, API, adapter, schema, and test files. |

---

## Section 1 — Preparatory Refactor

### 1a — Type moves

| From | To |
|---|---|
| `Harmonia.Domain.Reservations.HouseholdRef` | `Harmonia.Domain.HouseholdRef` |
| `Harmonia.Application.Reservations.ISession` | `Harmonia.Application.ISession` |
| `Harmonia.Application.Reservations.SessionContext` | `Harmonia.Application.SessionContext` |

Six files in the existing reservation feature gain `using Harmonia.Domain;` / `using Harmonia.Application;` and drop the old qualified names. No logic changes.

### 1b — Admin flag

`ISession` gains `bool IsAdmin { get; }`. `SessionContext` changes `HouseholdRef Household` to `HouseholdRef? Household` — residents carry their household; admins carry `null` (admins are management staff, not apartment-bound).

`DevAdminSession` is a new `ISession` implementation returning `new SessionContext(IsResident: false, IsAdmin: true, Household: null)`. Wired in `Program.cs` under the same `IsDevelopment()` guard as `DevSession`. Only one session adapter is registered per run.

**Gap #4** (added to `context/cold/gap-log.md`): *"Admin role deferred to real IdP. DevAdminSession refuses to boot outside Development. Admin HouseholdRef is null by convention; real IdP must enforce this."*

---

## Section 2 — Domain Layer

**Namespace**: `Harmonia.Domain.MaintenanceFees`  
**Project**: `src/Harmonia.Domain/`

### `MaintenanceFeeCharge.cs`

```csharp
namespace Harmonia.Domain.MaintenanceFees;

/// <summary>
/// Immutable record of a single maintenance fee charge as persisted in the ledger.
/// HouseholdRef is EU personal data (R3) — never log it.
/// </summary>
public sealed record MaintenanceFeeCharge(
    HouseholdRef Household,
    string IdempotencyKey,
    decimal Amount,
    string Description,
    DateTimeOffset ChargedAt);
```

No behaviour, no I/O. `Amount` is `decimal` — `float`/`double` are prohibited by the code-quality standard.

---

## Section 3 — Application Layer

**Namespace**: `Harmonia.Application.MaintenanceFees`  
**Project**: `src/Harmonia.Application/`

### `Ports.cs`

```csharp
public interface IMaintenanceFeeStore
{
    Task<RecordChargeResult> RecordChargeAsync(
        HouseholdRef household, string idempotencyKey,
        decimal amount, string description, DateTimeOffset chargedAt,
        CancellationToken ct);

    Task<IReadOnlyList<MaintenanceFeeCharge>> ListChargesAsync(
        HouseholdRef household, CancellationToken ct);
}
```

Append-only by interface contract: no UPDATE or DELETE methods are declared.

### `RecordCharge.cs`

Use case for the admin-record path.

- Constructor-injects `ISession` and `IMaintenanceFeeStore`.
- `ExecuteAsync(HouseholdRef targetHousehold, string idempotencyKey, decimal amount, string description, CancellationToken ct)` — takes `targetHousehold` from the caller (route parameter); the actor's authority derives from the session only.
- Resolves session; if `ctx is not { IsAdmin: true }` → returns `RecordChargeResult.Refused` without touching the store.
- Stamps `DateTimeOffset.UtcNow` as `chargedAt` and calls `_store.RecordChargeAsync(targetHousehold, ...)`.
- Returns the store result directly.

**XML doc invariant**: *"The actor identity (IsAdmin) is always session-derived. The target household is a caller-supplied parameter and must not be confused with the actor's own HouseholdRef, which may be null for admin sessions."*

**Result variants**:
- `RecordChargeResult.Refused` — no valid admin session
- `RecordChargeResult.Recorded(MaintenanceFeeCharge charge)` — new row inserted (→ HTTP 201)
- `RecordChargeResult.Duplicate(MaintenanceFeeCharge existing)` — idempotency key already present (→ HTTP 200)
- `RecordChargeResult.Failed` — unexpected store error (→ HTTP 500)

### `ListCharges.cs`

Use case for the resident-list path.

- Constructor-injects `ISession` and `IMaintenanceFeeStore`.
- `ExecuteAsync(CancellationToken ct)` — no household parameter; household always from session.
- Resolves session; if `ctx is not { IsResident: true }` → returns `ListChargesResult.Refused`.
- Calls `_store.ListChargesAsync(ctx.Household!.Value, ct)`.
- Returns `ListChargesResult.Ok(charges)` — empty list is a valid success, never an error.
- On store exception: returns `ListChargesResult.Failed`.

**XML doc invariant**: *"`ctx.Household` is guaranteed non-null when `IsResident: true` by the session convention established in Gap #4. The `!` assertion in `ListCharges` is intentional; a null-household resident session is a configuration error."*

**Result variants**:
- `ListChargesResult.Refused` — no valid resident session
- `ListChargesResult.Ok(IReadOnlyList<MaintenanceFeeCharge> charges)` — may be empty
- `ListChargesResult.Failed` — unexpected store error (→ HTTP 500)

---

## Section 4 — API / Adapter Layer

**Namespace**: `Harmonia.Api.MaintenanceFees` / `Harmonia.Api.MaintenanceFees.Adapters`  
**Project**: `src/Harmonia.Api/`

### Endpoints

| Method | Route | Auth signal | 201 | 200 | 403 | 500 |
|---|---|---|---|---|---|---|
| `POST` | `/maintenance-fees/charges/{householdRef}` | `IsAdmin` (session) | Recorded | Replay | Refused | Failed |
| `GET` | `/maintenance-fees/charges` | `IsResident` (session) | — | Ok | Refused | Failed |

`MaintenanceFeeEndpoints.cs` is a static class, translation-only. No business logic. Logs must never contain `HouseholdRef` value (R3). Log outcome tokens only (e.g., `"RecordCharge {Outcome}"`, `"ListCharges {Count} charges"`).

`householdRef` route segment is parsed to `HouseholdRef` by the endpoint handler. Invalid/empty segment → 400 Bad Request before calling the use case.

### SQL Adapter (`SqlMaintenanceFeeStore.cs`)

- **`RecordChargeAsync`**: `INSERT INTO dbo.MaintenanceFeeCharges (HouseholdRef, IdempotencyKey, Amount, Description, ChargedAt) VALUES (@hr, @ik, @amt, @desc, @cat)` with all five values via `SqlParameter`. On `SqlException` 2601/2627: `SELECT` the existing row by `(HouseholdRef, IdempotencyKey)` and return `RecordChargeResult.Duplicate(existing)`. On any other exception: return `RecordChargeResult.Failed`.
- **`ListChargesAsync`**: `SELECT HouseholdRef, IdempotencyKey, Amount, Description, ChargedAt FROM dbo.MaintenanceFeeCharges WHERE HouseholdRef = @hr ORDER BY ChargedAt DESC`. Empty result → empty list, not an error.
- All values via `SqlParameter`. `Amount` as `SqlDbType.Decimal` with `Precision = 18, Scale = 2`. No string interpolation of values.

### Schema (`db/schema.sql` addition)

```sql
CREATE TABLE dbo.MaintenanceFeeCharges (
    HouseholdRef    nvarchar(128)  NOT NULL,
    IdempotencyKey  nvarchar(64)   NOT NULL,
    Amount          decimal(18,2)  NOT NULL,
    Description     nvarchar(256)  NOT NULL,
    ChargedAt       datetime2(3)   NOT NULL,
    CONSTRAINT PK_MaintenanceFeeCharges
        PRIMARY KEY (HouseholdRef, IdempotencyKey)
);
```

The composite primary key serves as both the uniqueness constraint and the idempotency collision target. No separate unique index needed. `ChargedAt` has no `DEFAULT` — application supplies the value.

### `Program.cs` additions

- Connection string guard: `ConnectionStrings:MaintenanceFees` — same fail-fast pattern as `ConnectionStrings:Reservations`.
- Register `IMaintenanceFeeStore` as singleton (`SqlMaintenanceFeeStore`).
- Register `RecordCharge` and `ListCharges` as scoped.
- Map both routes via `MaintenanceFeeEndpoints.Map(app)`.

---

## Section 5 — Testing

### Unit Tests (`Harmonia.UnitTests`)

New fake: `FakeMaintenanceFeeStore` in `Fakes.cs` — scripts `RecordChargeResult`, records all calls for assertion.

| File | Coverage |
|---|---|
| `Application/RecordChargeTests.cs` | Non-admin → Refused, no store call; admin → store called with route-supplied household (not session household); `Duplicate` result propagated; `Failed` result propagated |
| `Application/ListChargesTests.cs` | Non-resident → Refused, no store call; resident → store called with session household; empty list → `Ok([])` |
| `Api/MaintenanceFeeEndpointsTests.cs` | `Recorded` → 201; `Duplicate` → 200; `Refused` → 403; `Failed` → 500; `Ok([])` → 200 + empty array; `Ok([charge])` → 200 + list |
| `Api/MaintenanceFeeLogExclusionTests.cs` | `HouseholdRef` value never appears in any log line across all `RecordCharge` and `ListCharges` outcome paths (R3 — parity with T16) |

### Integration Tests (`Harmonia.IntegrationTests`, `[Trait("Category","Rel")]`)

| Test | What it proves |
|---|---|
| Single INSERT → `ListChargesAsync` | Row persisted and retrieved; `decimal` precision preserved |
| Duplicate idempotency key → existing charge returned, row count unchanged | PK violation → re-SELECT path; no phantom row |
| `ListChargesAsync` ordered by `ChargedAt DESC` | Ordering contract |
| `ListChargesAsync` for household with no charges | Empty list, not error |
| `ListChargesAsync` store error | `Failed` result returned; no exception bubbles to HTTP layer |

No concurrency proof test: two simultaneous inserts with different idempotency keys are both valid — no R1-equivalent race on this path.

---

## Invariants Summary

| Invariant | Enforcement |
|---|---|
| Append-only | `IMaintenanceFeeStore` declares no UPDATE/DELETE methods; code review is the gate |
| Admin-only record | `IsAdmin` check in `RecordCharge` use case; session-derived |
| Target household from route | `RecordCharge.ExecuteAsync` parameter; endpoint parses route segment |
| Resident-only list | `IsResident` check in `ListCharges` use case; session-derived |
| Resident lists own charges only | `HouseholdRef` from `ISession` in `ListCharges`; never a request parameter |
| `HouseholdRef` never logged | `MaintenanceFeeEndpoints` logs outcome tokens only; `LogExclusionTests` enforces |
| `Amount` typed as `decimal` | Code-quality standard; `SqlDbType.Decimal` with `Precision=18, Scale=2` |
| Real SQL Server for integration tests | `SqlServerFixture` throws if `HARMONIA_SQL_CONNSTR` unset |
| `ChargedAt` application-supplied | `DateTimeOffset.UtcNow` stamped in `RecordCharge` before store call |
