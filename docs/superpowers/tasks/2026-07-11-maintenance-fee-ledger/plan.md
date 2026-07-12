# Maintenance Fee Ledger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an append-only maintenance fee ledger: management records charges per household, residents list their own — backed by SQL Server with idempotency-key protection.

**Architecture:** Three commits in order: (1a) pure type-move refactor — `HouseholdRef`, `ISession`, `SessionContext` promoted to layer-root namespaces; (1b) `IsAdmin` flag added to `ISession` + `DevAdminSession` wired; (2) full ledger feature across Domain / Application / API / tests. No ledger code before 1a is green.

**Tech Stack:** .NET 8, ASP.NET Core Minimal API, raw ADO.NET (`Microsoft.Data.SqlClient` 5.2.2), SQL Server 2022, xUnit 2.9.3, no mocking framework (hand-written fakes).

---

## File Map

### Commit 1a — Type-move refactor (no new behaviour)

| Action | File |
|---|---|
| Modify | `src/Harmonia.Domain/HouseholdRef.cs` — namespace `Harmonia.Domain.Reservations` → `Harmonia.Domain` |
| Create | `src/Harmonia.Application/Session.cs` — `ISession`, `SessionContext` extracted here |
| Modify | `src/Harmonia.Application/Ports.cs` — remove `ISession`/`SessionContext`; update using |
| Modify | `src/Harmonia.Domain/SlotStateDeriver.cs` — add `using Harmonia.Domain;` |
| Modify | `src/Harmonia.Application/ReserveSlot.cs` — `using Harmonia.Domain.Reservations;` → `using Harmonia.Domain;` |
| Modify | `src/Harmonia.Application/GetDayAvailability.cs` — same |
| Modify | `src/Harmonia.Api/Adapters/DevSession.cs` — update usings |
| Modify | `src/Harmonia.Api/Adapters/SqlReservationStore.cs` — update using |
| Modify | `src/Harmonia.Api/ReservationEndpoints.cs` — update using |
| Modify | `src/Harmonia.Api/Program.cs` — update using alias |
| Modify | `tests/Harmonia.UnitTests/Fakes.cs` — update usings |
| Modify | `tests/Harmonia.UnitTests/Application/ResidencyGateTests.cs` — update usings |
| Modify | `tests/Harmonia.UnitTests/Application/ReserveSlotTests.cs` — update usings |
| Modify | `tests/Harmonia.UnitTests/Api/ReservationEndpointsTests.cs` — update usings |
| Modify | `tests/Harmonia.IntegrationTests/SqlReservationStoreTests.cs` — update using |

### Commit 1b — Admin flag

| Action | File |
|---|---|
| Modify | `src/Harmonia.Application/Session.cs` — add `IsAdmin`, make `HouseholdRef` nullable |
| Modify | `src/Harmonia.Application/ReserveSlot.cs` — null-safe household access |
| Modify | `src/Harmonia.Application/GetDayAvailability.cs` — same |
| Modify | `src/Harmonia.Api/Adapters/DevSession.cs` — update `SessionContext` construction |
| Create | `src/Harmonia.Api/Adapters/DevAdminSession.cs` |
| Modify | `src/Harmonia.Api/Program.cs` — `Session:IsAdmin` config toggle |
| Modify | `context/cold/gap-log.md` — Gap #4 |
| Modify | `tests/Harmonia.UnitTests/Application/ResidencyGateTests.cs` — named `SessionContext` args |
| Modify | `tests/Harmonia.UnitTests/Application/ReserveSlotTests.cs` — named `SessionContext` args |
| Modify | `tests/Harmonia.UnitTests/Api/ReservationEndpointsTests.cs` — named `SessionContext` args |

### Commit 2 — Ledger feature

| Action | File |
|---|---|
| Create | `src/Harmonia.Domain/MaintenanceFees/MaintenanceFeeCharge.cs` |
| Create | `src/Harmonia.Application/MaintenanceFees/Ports.cs` |
| Create | `src/Harmonia.Application/MaintenanceFees/RecordCharge.cs` |
| Create | `src/Harmonia.Application/MaintenanceFees/ListCharges.cs` |
| Create | `src/Harmonia.Api/Adapters/SqlMaintenanceFeeStore.cs` |
| Create | `src/Harmonia.Api/MaintenanceFees/MaintenanceFeeEndpoints.cs` |
| Modify | `db/schema.sql` — add `dbo.MaintenanceFeeCharges` |
| Modify | `src/Harmonia.Api/Program.cs` — wire ledger services + routes |
| Modify | `tests/Harmonia.UnitTests/Fakes.cs` — add `FakeMaintenanceFeeStore` |
| Create | `tests/Harmonia.UnitTests/Application/RecordChargeTests.cs` |
| Create | `tests/Harmonia.UnitTests/Application/ListChargesTests.cs` |
| Create | `tests/Harmonia.UnitTests/Api/MaintenanceFeeEndpointsTests.cs` |
| Create | `tests/Harmonia.UnitTests/Api/MaintenanceFeeLogExclusionTests.cs` |
| Create | `tests/Harmonia.IntegrationTests/SqlMaintenanceFeeStoreTests.cs` |

---

## Task 1 — Change HouseholdRef namespace

**Test-first:** no — refactor; the existing suite is the test.

**Files:**
- Modify: `src/Harmonia.Domain/HouseholdRef.cs`

- [ ] **Step 1: Change the namespace declaration**

Replace the single line at the top of `src/Harmonia.Domain/HouseholdRef.cs`:

```csharp
namespace Harmonia.Domain;

/// <summary>
/// Opaque reference to the household that holds (or requests) a reservation.
/// EU personal data (R3): must never be written to logs or error messages.
/// </summary>
public readonly record struct HouseholdRef(string Value);
```

---

## Task 2 — Extract ISession and SessionContext to Harmonia.Application

**Test-first:** no — refactor.

**Files:**
- Create: `src/Harmonia.Application/Session.cs`
- Modify: `src/Harmonia.Application/Ports.cs`

- [ ] **Step 1: Create Session.cs**

```csharp
using Harmonia.Domain;

namespace Harmonia.Application;

/// <summary>
/// Resolves the verified upstream session (ADR-0001). Returns null when there is no
/// valid session. The household reference comes ONLY from here — never from a request
/// body, query, or header (R2). The concrete IdP behind this port is an open gap
/// (context/cold/gap-log.md); the build wires a fake adapter. A real adapter should
/// verify the token in auth middleware (Api layer) and let Resolve() read the
/// already-verified scoped result synchronously — keeping this port sync.
/// </summary>
public interface ISession
{
    SessionContext? Resolve();
}

/// <summary>The identity a verified session yields (ADR-0001).</summary>
public sealed record SessionContext(bool IsResident, HouseholdRef HouseholdRef);
```

- [ ] **Step 2: Strip ISession and SessionContext from Ports.cs**

Replace `src/Harmonia.Application/Ports.cs` with (removes the two types, adds `using Harmonia.Domain;`):

```csharp
using Harmonia.Domain;

namespace Harmonia.Application.Reservations;

/// <summary>
/// The reservation store port — the only place SQL lives (architecture.md).
/// <see cref="ClaimSlotAsync"/> is the atomic conditional claim: the store decides the
/// race in one write; callers must never read-then-write around it (R1, ADR-0002).
/// </summary>
public interface IReservationStore
{
    Task<IReadOnlyDictionary<string, HouseholdRef>> GetDayHoldersAsync(
        DateOnly day, CancellationToken ct = default);

    Task<ClaimResult> ClaimSlotAsync(
        DateOnly day, string slotKey, HouseholdRef householdRef, CancellationToken ct = default);
}

/// <summary>
/// The configured slot grid for a day (PA1/G1: grid is data, never hard-coded).
/// v1 ships one slot per day; hourly slots are a config/data change (stack.md).
/// </summary>
public interface ISlotGrid
{
    IReadOnlyList<string> ForDay(DateOnly day);
}
```

---

## Task 3 — Update Domain and Application layer usings

**Test-first:** no — refactor.

**Files:**
- Modify: `src/Harmonia.Domain/SlotStateDeriver.cs`
- Modify: `src/Harmonia.Application/ReserveSlot.cs`
- Modify: `src/Harmonia.Application/GetDayAvailability.cs`

- [ ] **Step 1: SlotStateDeriver.cs — add parent-namespace using**

`SlotStateDeriver` is in `Harmonia.Domain.Reservations`; `HouseholdRef` moved to `Harmonia.Domain`. Add the using at the top:

```csharp
using Harmonia.Domain;

namespace Harmonia.Domain.Reservations;

/// <summary>
/// Pure derivation of a slot's state from its holder and the viewing resident (AC-1).
/// No I/O; the holder comes from the authoritative store read at request time.
/// </summary>
public static class SlotStateDeriver
{
    public static SlotState Derive(HouseholdRef? holder, HouseholdRef me)
        => holder is null ? SlotState.Free
         : holder == me ? SlotState.TakenMine
         : SlotState.TakenOther;
}
```

- [ ] **Step 2: ReserveSlot.cs — swap using**

Replace `using Harmonia.Domain.Reservations;` with `using Harmonia.Domain;` (the namespace declaration and everything else stays the same — `ISession`, `ISlotGrid`, `IReservationStore` are still in `Harmonia.Application.Reservations` which is the file's own namespace):

```csharp
using Harmonia.Domain;

namespace Harmonia.Application.Reservations;
// ... rest of file unchanged
```

- [ ] **Step 3: GetDayAvailability.cs — swap using**

Same change as ReserveSlot.cs:

```csharp
using Harmonia.Domain;

namespace Harmonia.Application.Reservations;
// ... rest of file unchanged
```

---

## Task 4 — Update API layer usings

**Test-first:** no — refactor.

**Files:**
- Modify: `src/Harmonia.Api/Adapters/DevSession.cs`
- Modify: `src/Harmonia.Api/Adapters/SqlReservationStore.cs`
- Modify: `src/Harmonia.Api/ReservationEndpoints.cs`
- Modify: `src/Harmonia.Api/Program.cs`

- [ ] **Step 1: DevSession.cs — update usings**

`ISession` and `SessionContext` are now in `Harmonia.Application`. Replace the whole file:

```csharp
using Harmonia.Application;
using Harmonia.Domain;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// Dev-only stand-in for the identity seam. The concrete IdP behind ISession is an
/// open, human-owned gap (context/cold/gap-log.md, ADR-0001 gate #6): this adapter
/// yields a fixed "verified session" from local config so the slice can run.
/// Swapping it for the real IdP adapter must touch NOTHING in Domain/Application.
/// NEVER derive identity from a request body/query/header here or anywhere (R2).
/// </summary>
public sealed class DevSession(bool isResident, string householdRef) : ISession
{
    public SessionContext? Resolve()
        => new(isResident, new HouseholdRef(householdRef));
}
```

- [ ] **Step 2: SqlReservationStore.cs — swap using**

Change `using Harmonia.Domain.Reservations;` to `using Harmonia.Domain;` at the top. Everything else stays the same.

- [ ] **Step 3: ReservationEndpoints.cs — swap using**

Change `using Harmonia.Domain.Reservations;` to `using Harmonia.Domain;`. The `using Harmonia.Application.Reservations;` line stays (that's for `AvailabilityResult`, `ReserveResult`, etc.).

- [ ] **Step 4: Program.cs — remove alias, add using**

Replace the top of the file. Old:
```csharp
using Harmonia.Api.Reservations;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Reservations;
using ISession = Harmonia.Application.Reservations.ISession;
```

New (alias no longer needed — `ISession` lives in `Harmonia.Application`):
```csharp
using Harmonia.Api.Reservations;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application;
using Harmonia.Application.Reservations;
```

---

## Task 5 — Update test usings, verify build and tests, commit 1a

**Test-first:** no — refactor.

**Files:**
- Modify: `tests/Harmonia.UnitTests/Fakes.cs`
- Modify: `tests/Harmonia.UnitTests/Application/ResidencyGateTests.cs`
- Modify: `tests/Harmonia.UnitTests/Application/ReserveSlotTests.cs`
- Modify: `tests/Harmonia.UnitTests/Api/ReservationEndpointsTests.cs`
- Modify: `tests/Harmonia.IntegrationTests/SqlReservationStoreTests.cs`

- [ ] **Step 1: Fakes.cs — update usings**

Replace the two old using lines:
```csharp
using Harmonia.Application;
using Harmonia.Application.Reservations;
using Harmonia.Domain;
```
(Remove `using Harmonia.Domain.Reservations;`)

- [ ] **Step 2: ResidencyGateTests.cs — update usings**

Replace:
```csharp
using Harmonia.Application.Reservations;
using Harmonia.Domain.Reservations;
```
With:
```csharp
using Harmonia.Application;
using Harmonia.Application.Reservations;
using Harmonia.Domain;
```

- [ ] **Step 3: ReserveSlotTests.cs — update usings**

Same replacement as Step 2.

- [ ] **Step 4: ReservationEndpointsTests.cs — update usings**

Same replacement as Step 2 (also keep `using Harmonia.Api.Reservations;`):
```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Reservations;
using Harmonia.Application;
using Harmonia.Application.Reservations;
using Harmonia.Domain;
```

- [ ] **Step 5: SqlReservationStoreTests.cs — update using**

Change `using Harmonia.Domain.Reservations;` to `using Harmonia.Domain;`.

- [ ] **Step 6: Verify build**

Run: `dotnet build Harmonia.sln`

Expected: `Build succeeded. 0 Error(s).`

- [ ] **Step 7: Verify all 34 tests pass**

Run: `dotnet test Harmonia.sln --filter "Category!=Rel"`

Expected: `Passed! - Failed: 0, Passed: 34`

- [ ] **Step 8: Commit 1a**

```bash
git add src/ tests/ && git commit -m "refactor: extract shared identity types to layer roots

Move HouseholdRef → Harmonia.Domain, ISession/SessionContext →
Harmonia.Application. Pure type moves; all 34 existing tests green."
```

---

## Task 6 — Write admin-flag test, add IsAdmin and nullable HouseholdRef

**Test-first:** yes — write a test that exercises `IsAdmin` on `SessionContext` before the property exists.

**Files:**
- Modify: `src/Harmonia.Application/Session.cs`
- Modify (test first): `tests/Harmonia.UnitTests/Application/ResidencyGateTests.cs`

- [ ] **Step 1: Write the failing test**

Add to `ResidencyGateTests.cs` (inside the class, after existing tests):

```csharp
[Fact]
public void SessionContext_admin_flag_is_false_for_residents()
{
    var ctx = new SessionContext(IsResident: true, IsAdmin: false,
        HouseholdRef: new HouseholdRef("HH-1"));
    Assert.False(ctx.IsAdmin);
    Assert.True(ctx.IsResident);
}

[Fact]
public void SessionContext_admin_flag_is_true_for_admins_with_null_household()
{
    var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
    Assert.True(ctx.IsAdmin);
    Assert.False(ctx.IsResident);
    Assert.Null(ctx.HouseholdRef);
}
```

- [ ] **Step 2: Run to verify compile failure**

Run: `dotnet build Harmonia.sln`

Expected: compiler errors — `SessionContext` does not take 3 arguments / `IsAdmin` does not exist.

- [ ] **Step 3: Update SessionContext in Session.cs**

Replace `src/Harmonia.Application/Session.cs`:

```csharp
using Harmonia.Domain;

namespace Harmonia.Application;

/// <summary>
/// Resolves the verified upstream session (ADR-0001). Returns null when there is no
/// valid session. The household reference comes ONLY from here — never from a request
/// body, query, or header (R2). The concrete IdP behind this port is an open gap
/// (context/cold/gap-log.md); the build wires a fake adapter.
/// </summary>
public interface ISession
{
    SessionContext? Resolve();
}

/// <summary>
/// The identity a verified session yields (ADR-0001).
/// IsAdmin and IsResident are mutually exclusive in the current model.
/// HouseholdRef is null for admin sessions — admins are not apartment-bound.
/// </summary>
public sealed record SessionContext(bool IsResident, bool IsAdmin, HouseholdRef? HouseholdRef);
```

- [ ] **Step 4: Run tests — expect compile errors on old SessionContext call sites**

Run: `dotnet build Harmonia.sln`

Expected: errors in `DevSession.cs`, test files — `SessionContext` now requires 3 args.

---

## Task 7 — Fix all SessionContext call sites for nullable HouseholdRef

**Test-first:** no — fixing broken callers.

**Files:**
- Modify: `src/Harmonia.Api/Adapters/DevSession.cs`
- Modify: `src/Harmonia.Application/ReserveSlot.cs`
- Modify: `src/Harmonia.Application/GetDayAvailability.cs`
- Modify: `tests/Harmonia.UnitTests/Application/ResidencyGateTests.cs`
- Modify: `tests/Harmonia.UnitTests/Application/ReserveSlotTests.cs`
- Modify: `tests/Harmonia.UnitTests/Api/ReservationEndpointsTests.cs`

- [ ] **Step 1: DevSession.cs — add IsAdmin: false**

```csharp
using Harmonia.Application;
using Harmonia.Domain;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// Dev-only resident session stand-in (gap-log.md gap #1, gap #4).
/// IsAdmin is always false here — use DevAdminSession for admin paths.
/// </summary>
public sealed class DevSession(bool isResident, string householdRef) : ISession
{
    public SessionContext? Resolve()
        => new(IsResident: isResident, IsAdmin: false,
               HouseholdRef: new HouseholdRef(householdRef));
}
```

- [ ] **Step 2: ReserveSlot.cs — null-safe household access**

Replace `_store.ClaimSlotAsync(day, slotKey, ctx.HouseholdRef, ct)` line. After the residency gate `IsResident: true` the household is guaranteed non-null by convention. Use pattern binding to keep the compiler happy:

```csharp
public async Task<ReserveResult> ExecuteAsync(DateOnly day, string slotKey, CancellationToken ct = default)
{
    var ctx = _session.Resolve();
    if (ctx is not { IsResident: true } || ctx.HouseholdRef is not { } household)
        return new ReserveResult.Refused();

    if (!_grid.ForDay(day).Contains(slotKey))
        return new ReserveResult.UnknownSlot();

    var result = await _store.ClaimSlotAsync(day, slotKey, household, ct);
    return new ReserveResult.Outcome(OutcomeMapper.Map(result));
}
```

- [ ] **Step 3: GetDayAvailability.cs — null-safe household access**

```csharp
public async Task<AvailabilityResult> ExecuteAsync(DateOnly day, CancellationToken ct = default)
{
    var ctx = _session.Resolve();
    if (ctx is not { IsResident: true } || ctx.HouseholdRef is not { } household)
        return new AvailabilityResult.Refused();

    var slotKeys = _grid.ForDay(day);
    var holders = await _store.GetDayHoldersAsync(day, ct);

    var slots = slotKeys
        .Select(key => new SlotView(
            key,
            SlotStateDeriver.Derive(
                holders.TryGetValue(key, out var holder) ? holder : null,
                household)))
        .ToList();

    return new AvailabilityResult.Ok(day, slots);
}
```

- [ ] **Step 4: ResidencyGateTests.cs — named args for all existing SessionContext calls**

Find: `new SessionContext(false, new HouseholdRef("HH-X"))`
Replace with: `new SessionContext(IsResident: false, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-X"))`

The `NonResidentSessions` theory data becomes:
```csharp
public static TheoryData<SessionContext?> NonResidentSessions => new()
{
    { null },
    { new SessionContext(IsResident: false, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-X")) },
};
```

- [ ] **Step 5: ReserveSlotTests.cs — named args**

Find: `new FakeSession(new SessionContext(true, SessionHousehold))`
Replace with: `new FakeSession(new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: SessionHousehold))`

- [ ] **Step 6: ReservationEndpointsTests.cs — named args**

Find: `new SessionContext(true, new HouseholdRef("HH-ME"))`
Replace with: `new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-ME"))`

- [ ] **Step 7: Verify build and tests**

Run: `dotnet build Harmonia.sln`

Expected: `Build succeeded. 0 Error(s).`

Run: `dotnet test Harmonia.sln --filter "Category!=Rel"`

Expected: `Passed! - Failed: 0, Passed: 36` (34 existing + 2 new SessionContext tests).

---

## Task 8 — Add DevAdminSession, update Program.cs, record Gap #4, commit 1b

**Test-first:** no for DevAdminSession (dev adapter, same pattern as DevSession). New tests from Task 6 already cover the flag.

**Files:**
- Create: `src/Harmonia.Api/Adapters/DevAdminSession.cs`
- Modify: `src/Harmonia.Api/Program.cs`
- Modify: `context/cold/gap-log.md`

- [ ] **Step 1: Create DevAdminSession.cs**

```csharp
using Harmonia.Application;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// Dev-only admin session stand-in (gap-log.md gap #4). Sets IsAdmin=true,
/// IsResident=false, HouseholdRef=null — admins are not apartment-bound.
/// NEVER use outside the Development environment (Program.cs enforces this).
/// </summary>
public sealed class DevAdminSession : ISession
{
    public SessionContext? Resolve()
        => new(IsResident: false, IsAdmin: true, HouseholdRef: null);
}
```

- [ ] **Step 2: Update Program.cs — add Session:IsAdmin config toggle**

Replace the session wiring block (currently just `DevSession`):

```csharp
if (builder.Configuration.GetValue("Session:IsAdmin", false))
{
    builder.Services.AddSingleton<ISession>(new DevAdminSession());
}
else
{
    builder.Services.AddSingleton<ISession>(new DevSession(
        builder.Configuration.GetValue("Session:IsResident", true),
        builder.Configuration.GetValue("Session:HouseholdRef", "HH-DEV-1")!));
}
```

Also add `using Harmonia.Api.Reservations.Adapters;` if not already present (it should already be).

- [ ] **Step 3: Add Gap #4 to gap-log.md**

Append to `context/cold/gap-log.md`:

```markdown
- **description:** Admin role deferred to real IdP. `DevAdminSession` (`IsAdmin=true`, `IsResident=false`,
  `HouseholdRef=null`) stands in under `Session:IsAdmin=true` config; it refuses to boot outside
  `Development` (the existing `IsDevelopment()` guard in `Program.cs` covers both adapters).
  Admin `HouseholdRef` is `null` by convention — real IdP must enforce this. Applies to the
  `POST /maintenance-fees/charges/{householdRef}` endpoint.
  **discovery_event:** maintenance-fee-ledger design, 2026-07-12.
  **refresh_trigger:** before any non-Development deployment.
```

- [ ] **Step 4: Verify build and tests**

Run: `dotnet build Harmonia.sln`

Expected: `Build succeeded. 0 Error(s).`

Run: `dotnet test Harmonia.sln --filter "Category!=Rel"`

Expected: `Passed! - Failed: 0, Passed: 36`

- [ ] **Step 5: Commit 1b**

```bash
git add src/ tests/ context/ && git commit -m "feat: add IsAdmin flag to ISession and wire DevAdminSession

SessionContext gains IsAdmin: bool; HouseholdRef becomes nullable
(null for admin sessions). DevAdminSession dev stand-in added.
Records Gap #4: admin role deferred to real IdP."
```

---

## Task 9 — Add domain record, port interfaces, and result types

**Test-first:** yes — add `FakeMaintenanceFeeStore` to `Fakes.cs` first; it won't compile until `IMaintenanceFeeStore` exists.

**Files:**
- Create: `src/Harmonia.Domain/MaintenanceFees/MaintenanceFeeCharge.cs`
- Create: `src/Harmonia.Application/MaintenanceFees/Ports.cs`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs`

- [ ] **Step 1: Create MaintenanceFeeCharge.cs**

```csharp
using Harmonia.Domain;

namespace Harmonia.Domain.MaintenanceFees;

/// <summary>
/// Immutable record of a single maintenance fee charge as persisted in the ledger.
/// HouseholdRef is EU personal data (R3) — never log its value.
/// </summary>
public sealed record MaintenanceFeeCharge(
    HouseholdRef Household,
    string IdempotencyKey,
    decimal Amount,
    string Description,
    DateTimeOffset ChargedAt);
```

- [ ] **Step 2: Write FakeMaintenanceFeeStore in Fakes.cs (will fail to compile)**

Add to `tests/Harmonia.UnitTests/Fakes.cs`:

```csharp
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain.MaintenanceFees;

// ... (at the bottom of the file, after existing fakes)

public sealed class FakeMaintenanceFeeStore : IMaintenanceFeeStore
{
    public RecordChargeResult NextRecordResult { get; set; } =
        new RecordChargeResult.Recorded(
            new MaintenanceFeeCharge(
                new HouseholdRef("HH-FAKE"), "key", 100m, "desc", DateTimeOffset.UtcNow));

    public List<(HouseholdRef Household, string IdempotencyKey, decimal Amount,
        string Description, DateTimeOffset ChargedAt)> RecordCalls { get; } = [];

    public bool ThrowOnList { get; set; }
    public IReadOnlyList<MaintenanceFeeCharge> NextListResult { get; set; } = [];
    public List<HouseholdRef> ListCalls { get; } = [];

    public Task<RecordChargeResult> RecordChargeAsync(
        HouseholdRef household, string idempotencyKey,
        decimal amount, string description, DateTimeOffset chargedAt,
        CancellationToken ct)
    {
        RecordCalls.Add((household, idempotencyKey, amount, description, chargedAt));
        return Task.FromResult(NextRecordResult);
    }

    public Task<IReadOnlyList<MaintenanceFeeCharge>> ListChargesAsync(
        HouseholdRef household, CancellationToken ct)
    {
        if (ThrowOnList) throw new InvalidOperationException("store error");
        ListCalls.Add(household);
        return Task.FromResult(NextListResult);
    }
}
```

- [ ] **Step 3: Run to verify compile failure**

Run: `dotnet build Harmonia.sln`

Expected: errors — `IMaintenanceFeeStore`, `RecordChargeResult` not found.

- [ ] **Step 4: Create Ports.cs**

```csharp
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Application.MaintenanceFees;

/// <summary>
/// Append-only ledger store port. No UPDATE or DELETE methods are declared by design.
/// ChargedAt is application-supplied — the use case stamps DateTimeOffset.UtcNow.
/// </summary>
public interface IMaintenanceFeeStore
{
    Task<RecordChargeResult> RecordChargeAsync(
        HouseholdRef household, string idempotencyKey,
        decimal amount, string description, DateTimeOffset chargedAt,
        CancellationToken ct);

    Task<IReadOnlyList<MaintenanceFeeCharge>> ListChargesAsync(
        HouseholdRef household, CancellationToken ct);
}

public abstract record RecordChargeResult
{
    private RecordChargeResult() { }

    /// <summary>Actor has no admin session.</summary>
    public sealed record Refused : RecordChargeResult;

    /// <summary>New row inserted. HTTP 201.</summary>
    public sealed record Recorded(MaintenanceFeeCharge Charge) : RecordChargeResult;

    /// <summary>Idempotency key already used — existing charge returned. HTTP 200.</summary>
    public sealed record Duplicate(MaintenanceFeeCharge Existing) : RecordChargeResult;

    /// <summary>Unexpected store error. HTTP 500.</summary>
    public sealed record Failed : RecordChargeResult;
}

public abstract record ListChargesResult
{
    private ListChargesResult() { }

    /// <summary>Actor has no resident session.</summary>
    public sealed record Refused : ListChargesResult;

    /// <summary>Charges for the resident's household. May be empty. HTTP 200.</summary>
    public sealed record Ok(IReadOnlyList<MaintenanceFeeCharge> Charges) : ListChargesResult;

    /// <summary>Unexpected store error. HTTP 500.</summary>
    public sealed record Failed : ListChargesResult;
}
```

- [ ] **Step 5: Verify build**

Run: `dotnet build Harmonia.sln`

Expected: `Build succeeded. 0 Error(s).`

---

## Task 10 — RecordCharge use case (TDD)

**Test-first:** yes.

**Files:**
- Create: `tests/Harmonia.UnitTests/Application/RecordChargeTests.cs`
- Create: `src/Harmonia.Application/MaintenanceFees/RecordCharge.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/Harmonia.UnitTests/Application/RecordChargeTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class RecordChargeTests
{
    private static readonly HouseholdRef Target = new("HH-TARGET");
    private static readonly HouseholdRef AdminHousehold = new("HH-ADMIN");

    private static RecordCharge AdminUseCase(FakeMaintenanceFeeStore store)
        => new(
            new FakeSession(new SessionContext(
                IsResident: false, IsAdmin: true, HouseholdRef: null)),
            store);

    [Fact]
    public async Task Non_admin_session_returns_Refused_without_touching_store()
    {
        var store = new FakeMaintenanceFeeStore();
        var useCase = new RecordCharge(
            new FakeSession(new SessionContext(
                IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"))),
            store);

        var result = await useCase.ExecuteAsync(Target, "key", 100m, "desc", default);

        Assert.IsType<RecordChargeResult.Refused>(result);
        Assert.Empty(store.RecordCalls);
    }

    [Fact]
    public async Task Null_session_returns_Refused_without_touching_store()
    {
        var store = new FakeMaintenanceFeeStore();
        var useCase = new RecordCharge(new FakeSession(null), store);

        var result = await useCase.ExecuteAsync(Target, "key", 100m, "desc", default);

        Assert.IsType<RecordChargeResult.Refused>(result);
        Assert.Empty(store.RecordCalls);
    }

    [Fact]
    public async Task Admin_session_calls_store_with_route_supplied_target_household()
    {
        var store = new FakeMaintenanceFeeStore();
        var useCase = AdminUseCase(store);

        await useCase.ExecuteAsync(Target, "IK-001", 250.00m, "Q3 fee", default);

        var call = Assert.Single(store.RecordCalls);
        Assert.Equal(Target, call.Household);   // target from parameter, NOT session
        Assert.Equal("IK-001", call.IdempotencyKey);
        Assert.Equal(250.00m, call.Amount);
        Assert.Equal("Q3 fee", call.Description);
    }

    [Fact]
    public async Task Duplicate_idempotency_key_propagates_Duplicate_result()
    {
        var existing = new Harmonia.Domain.MaintenanceFees.MaintenanceFeeCharge(
            Target, "IK-DUP", 100m, "desc", DateTimeOffset.UtcNow);
        var store = new FakeMaintenanceFeeStore
        {
            NextRecordResult = new RecordChargeResult.Duplicate(existing)
        };

        var result = await AdminUseCase(store).ExecuteAsync(Target, "IK-DUP", 100m, "desc", default);

        var dup = Assert.IsType<RecordChargeResult.Duplicate>(result);
        Assert.Equal(existing, dup.Existing);
    }

    [Fact]
    public async Task Store_Failed_propagates_to_caller()
    {
        var store = new FakeMaintenanceFeeStore
        {
            NextRecordResult = new RecordChargeResult.Failed()
        };

        var result = await AdminUseCase(store).ExecuteAsync(Target, "key", 100m, "desc", default);

        Assert.IsType<RecordChargeResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Run to verify compile failure**

Run: `dotnet build Harmonia.sln`

Expected: `RecordCharge` not found.

- [ ] **Step 3: Implement RecordCharge**

Create `src/Harmonia.Application/MaintenanceFees/RecordCharge.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Domain;

namespace Harmonia.Application.MaintenanceFees;

/// <summary>
/// Use case: an admin records a maintenance fee charge for a target household.
/// The actor's authority (IsAdmin) is always session-derived (R2).
/// The target household is a caller-supplied parameter — not the actor's own household,
/// which may be null for admin sessions.
/// </summary>
public sealed class RecordCharge(ISession session, IMaintenanceFeeStore store)
{
    private readonly ISession _session = session;
    private readonly IMaintenanceFeeStore _store = store;

    public async Task<RecordChargeResult> ExecuteAsync(
        HouseholdRef targetHousehold, string idempotencyKey,
        decimal amount, string description,
        CancellationToken ct)
    {
        var ctx = _session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordChargeResult.Refused();

        var chargedAt = DateTimeOffset.UtcNow;
        return await _store.RecordChargeAsync(
            targetHousehold, idempotencyKey, amount, description, chargedAt, ct);
    }
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `dotnet test Harmonia.sln --filter "Category!=Rel"`

Expected: all tests pass (36 existing + 5 new RecordCharge tests = 41).

---

## Task 11 — ListCharges use case (TDD)

**Test-first:** yes.

**Files:**
- Create: `tests/Harmonia.UnitTests/Application/ListChargesTests.cs`
- Create: `src/Harmonia.Application/MaintenanceFees/ListCharges.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/Harmonia.UnitTests/Application/ListChargesTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Application;

public class ListChargesTests
{
    private static readonly HouseholdRef ResidentHousehold = new("HH-RESIDENT");

    private static ListCharges ResidentUseCase(FakeMaintenanceFeeStore store)
        => new(
            new FakeSession(new SessionContext(
                IsResident: true, IsAdmin: false, HouseholdRef: ResidentHousehold)),
            store);

    [Fact]
    public async Task Non_resident_session_returns_Refused_without_touching_store()
    {
        var store = new FakeMaintenanceFeeStore();
        var useCase = new ListCharges(
            new FakeSession(new SessionContext(
                IsResident: false, IsAdmin: true, HouseholdRef: null)),
            store);

        var result = await useCase.ExecuteAsync(default);

        Assert.IsType<ListChargesResult.Refused>(result);
        Assert.Empty(store.ListCalls);
    }

    [Fact]
    public async Task Null_session_returns_Refused_without_touching_store()
    {
        var store = new FakeMaintenanceFeeStore();
        var useCase = new ListCharges(new FakeSession(null), store);

        var result = await useCase.ExecuteAsync(default);

        Assert.IsType<ListChargesResult.Refused>(result);
        Assert.Empty(store.ListCalls);
    }

    [Fact]
    public async Task Resident_session_calls_store_with_session_household()
    {
        var store = new FakeMaintenanceFeeStore();

        await ResidentUseCase(store).ExecuteAsync(default);

        var called = Assert.Single(store.ListCalls);
        Assert.Equal(ResidentHousehold, called); // from session, never a parameter
    }

    [Fact]
    public async Task Empty_charge_list_returns_Ok_with_empty_collection()
    {
        var store = new FakeMaintenanceFeeStore { NextListResult = [] };

        var result = await ResidentUseCase(store).ExecuteAsync(default);

        var ok = Assert.IsType<ListChargesResult.Ok>(result);
        Assert.Empty(ok.Charges);
    }

    [Fact]
    public async Task Charges_are_returned_in_Ok()
    {
        var charge = new MaintenanceFeeCharge(
            ResidentHousehold, "IK-1", 100m, "desc", DateTimeOffset.UtcNow);
        var store = new FakeMaintenanceFeeStore { NextListResult = [charge] };

        var result = await ResidentUseCase(store).ExecuteAsync(default);

        var ok = Assert.IsType<ListChargesResult.Ok>(result);
        Assert.Equal(charge, Assert.Single(ok.Charges));
    }

    [Fact]
    public async Task Store_exception_returns_Failed()
    {
        var store = new FakeMaintenanceFeeStore { ThrowOnList = true };

        var result = await ResidentUseCase(store).ExecuteAsync(default);

        Assert.IsType<ListChargesResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Run to verify compile failure**

Run: `dotnet build Harmonia.sln`

Expected: `ListCharges` not found.

- [ ] **Step 3: Implement ListCharges**

Create `src/Harmonia.Application/MaintenanceFees/ListCharges.cs`:

```csharp
using Harmonia.Application;

namespace Harmonia.Application.MaintenanceFees;

/// <summary>
/// Use case: a resident lists their own maintenance fee charges.
/// HouseholdRef always from the verified session (R2) — no route parameter.
/// IsResident: true implies a non-null HouseholdRef by session convention (gap-log gap #4).
/// </summary>
public sealed class ListCharges(ISession session, IMaintenanceFeeStore store)
{
    private readonly ISession _session = session;
    private readonly IMaintenanceFeeStore _store = store;

    public async Task<ListChargesResult> ExecuteAsync(CancellationToken ct)
    {
        var ctx = _session.Resolve();
        if (ctx is not { IsResident: true } || ctx.HouseholdRef is not { } household)
            return new ListChargesResult.Refused();

        try
        {
            var charges = await _store.ListChargesAsync(household, ct);
            return new ListChargesResult.Ok(charges);
        }
        catch (Exception)
        {
            return new ListChargesResult.Failed();
        }
    }
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `dotnet test Harmonia.sln --filter "Category!=Rel"`

Expected: all tests pass (41 existing + 6 new ListCharges tests = 47).

---

## Task 12 — Schema, SQL adapter, integration tests

**Test-first:** yes — write integration tests first; they fail because the table doesn't exist.

**Files:**
- Modify: `db/schema.sql`
- Create: `tests/Harmonia.IntegrationTests/SqlMaintenanceFeeStoreTests.cs`
- Create: `src/Harmonia.Api/Adapters/SqlMaintenanceFeeStore.cs`

- [ ] **Step 1: Write the failing integration tests**

Create `tests/Harmonia.IntegrationTests/SqlMaintenanceFeeStoreTests.cs`:

```csharp
using Harmonia.Api.Adapters;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.IntegrationTests;

[Trait("Category", "Rel")]
public class SqlMaintenanceFeeStoreTests(SqlServerFixture fixture)
    : IClassFixture<SqlServerFixture>
{
    private static readonly HouseholdRef HouseholdA = new("MF-HH-A");
    private static readonly HouseholdRef HouseholdB = new("MF-HH-B");

    private SqlMaintenanceFeeStore Store => new(fixture.ConnectionString);

    private static string FreshKey() => $"IK-{Guid.NewGuid():N}";

    [Fact] // Single INSERT is persisted and retrieved via ListChargesAsync
    public async Task Single_charge_is_persisted_and_listed()
    {
        var key = FreshKey();
        var chargedAt = DateTimeOffset.UtcNow;

        var recordResult = await Store.RecordChargeAsync(
            HouseholdA, key, 150.50m, "Q3 maintenance", chargedAt, default);

        Assert.IsType<RecordChargeResult.Recorded>(recordResult);

        var charges = await Store.ListChargesAsync(HouseholdA, default);
        var charge = charges.FirstOrDefault(c => c.IdempotencyKey == key);
        Assert.NotNull(charge);
        Assert.Equal(HouseholdA, charge.Household);
        Assert.Equal(150.50m, charge.Amount);
        Assert.Equal("Q3 maintenance", charge.Description);
    }

    [Fact] // Duplicate idempotency key returns existing charge, no new row
    public async Task Duplicate_idempotency_key_returns_existing_charge_unchanged()
    {
        var key = FreshKey();
        var chargedAt = DateTimeOffset.UtcNow;

        await Store.RecordChargeAsync(HouseholdA, key, 100m, "original", chargedAt, default);
        var secondResult = await Store.RecordChargeAsync(
            HouseholdA, key, 999m, "different desc", chargedAt.AddMinutes(1), default);

        var dup = Assert.IsType<RecordChargeResult.Duplicate>(secondResult);
        Assert.Equal(key, dup.Existing.IdempotencyKey);
        Assert.Equal(100m, dup.Existing.Amount);       // original amount, not 999
        Assert.Equal("original", dup.Existing.Description);

        // Only one row in the database
        var charges = await Store.ListChargesAsync(HouseholdA, default);
        Assert.Single(charges.Where(c => c.IdempotencyKey == key));
    }

    [Fact] // ListChargesAsync returns empty list for an unknown household
    public async Task List_for_household_with_no_charges_returns_empty()
    {
        var charges = await Store.ListChargesAsync(
            new HouseholdRef($"MF-UNKNOWN-{Guid.NewGuid():N}"), default);

        Assert.Empty(charges);
    }

    [Fact] // ListChargesAsync returns charges ordered by ChargedAt DESC
    public async Task Charges_are_ordered_by_ChargedAt_descending()
    {
        var hh = new HouseholdRef($"MF-ORDER-{Guid.NewGuid():N}");
        var t1 = DateTimeOffset.UtcNow.AddHours(-2);
        var t2 = DateTimeOffset.UtcNow.AddHours(-1);
        var t3 = DateTimeOffset.UtcNow;

        await Store.RecordChargeAsync(hh, FreshKey(), 10m, "first", t1, default);
        await Store.RecordChargeAsync(hh, FreshKey(), 20m, "second", t2, default);
        await Store.RecordChargeAsync(hh, FreshKey(), 30m, "third", t3, default);

        var charges = (await Store.ListChargesAsync(hh, default)).ToList();

        Assert.Equal(3, charges.Count);
        Assert.Equal(30m, charges[0].Amount); // most recent first
        Assert.Equal(20m, charges[1].Amount);
        Assert.Equal(10m, charges[2].Amount);
    }
}
```

- [ ] **Step 2: Run integration tests — expect failure (table missing)**

Run: `dotnet test Harmonia.sln --filter "Category=Rel"` (requires `HARMONIA_SQL_CONNSTR` set)

Expected: `SqlMaintenanceFeeStore` compile error, or SQL errors about missing table.

- [ ] **Step 3: Extend db/schema.sql**

Append after the existing `dbo.Reservations` block:

```sql

-- Maintenance fee ledger (append-only; no UPDATE or DELETE paths).
-- PRIMARY KEY on (HouseholdRef, IdempotencyKey) enforces idempotency.
-- ChargedAt is application-supplied; no DEFAULT — the use case stamps it.
IF OBJECT_ID(N'dbo.MaintenanceFeeCharges', N'U') IS NULL
CREATE TABLE dbo.MaintenanceFeeCharges
(
    HouseholdRef    nvarchar(128)  NOT NULL,
    IdempotencyKey  nvarchar(64)   NOT NULL,
    Amount          decimal(18,2)  NOT NULL,
    Description     nvarchar(256)  NOT NULL,
    ChargedAt       datetime2(3)   NOT NULL,
    CONSTRAINT PK_MaintenanceFeeCharges
        PRIMARY KEY (HouseholdRef, IdempotencyKey)
);
```

- [ ] **Step 4: Create SqlMaintenanceFeeStore.cs**

```csharp
using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Api.Adapters;

/// <summary>
/// SQL Server adapter for IMaintenanceFeeStore — append-only ledger.
/// No UPDATE or DELETE SQL anywhere in this class.
/// On idempotency collision (2601/2627): re-SELECT existing row and return Duplicate.
/// ChargedAt is application-supplied; no server DEFAULT on the column.
/// </summary>
public sealed class SqlMaintenanceFeeStore(string connectionString) : IMaintenanceFeeStore
{
    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;

    private readonly string _connectionString = connectionString;

    public async Task<RecordChargeResult> RecordChargeAsync(
        HouseholdRef household, string idempotencyKey,
        decimal amount, string description, DateTimeOffset chargedAt,
        CancellationToken ct)
    {
        try
        {
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "INSERT INTO dbo.MaintenanceFeeCharges " +
                "(HouseholdRef, IdempotencyKey, Amount, Description, ChargedAt) " +
                "VALUES (@hr, @ik, @amt, @desc, @cat);";
            cmd.Parameters.AddWithValue("@hr", household.Value);
            cmd.Parameters.AddWithValue("@ik", idempotencyKey);
            cmd.Parameters.Add(new SqlParameter("@amt", SqlDbType.Decimal)
                { Value = amount, Precision = 18, Scale = 2 });
            cmd.Parameters.AddWithValue("@desc", description);
            cmd.Parameters.AddWithValue("@cat", chargedAt.UtcDateTime);
            await cmd.ExecuteNonQueryAsync(ct);

            return new RecordChargeResult.Recorded(
                new MaintenanceFeeCharge(household, idempotencyKey, amount, description, chargedAt));
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            var existing = await SelectChargeAsync(household, idempotencyKey, ct);
            return existing is not null
                ? new RecordChargeResult.Duplicate(existing)
                : new RecordChargeResult.Failed();
        }
        catch (Exception)
        {
            return new RecordChargeResult.Failed();
        }
    }

    public async Task<IReadOnlyList<MaintenanceFeeCharge>> ListChargesAsync(
        HouseholdRef household, CancellationToken ct)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, IdempotencyKey, Amount, Description, ChargedAt " +
            "FROM dbo.MaintenanceFeeCharges " +
            "WHERE HouseholdRef = @hr " +
            "ORDER BY ChargedAt DESC;";
        cmd.Parameters.AddWithValue("@hr", household.Value);

        var result = new List<MaintenanceFeeCharge>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            result.Add(new MaintenanceFeeCharge(
                new HouseholdRef(reader.GetString(0)),
                reader.GetString(1),
                reader.GetDecimal(2),
                reader.GetString(3),
                new DateTimeOffset(reader.GetDateTime(4), TimeSpan.Zero)));
        }

        return result;
    }

    private async Task<MaintenanceFeeCharge?> SelectChargeAsync(
        HouseholdRef household, string idempotencyKey, CancellationToken ct)
    {
        try
        {
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "SELECT HouseholdRef, IdempotencyKey, Amount, Description, ChargedAt " +
                "FROM dbo.MaintenanceFeeCharges " +
                "WHERE HouseholdRef = @hr AND IdempotencyKey = @ik;";
            cmd.Parameters.AddWithValue("@hr", household.Value);
            cmd.Parameters.AddWithValue("@ik", idempotencyKey);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;

            return new MaintenanceFeeCharge(
                new HouseholdRef(reader.GetString(0)),
                reader.GetString(1),
                reader.GetDecimal(2),
                reader.GetString(3),
                new DateTimeOffset(reader.GetDateTime(4), TimeSpan.Zero));
        }
        catch (Exception)
        {
            return null;
        }
    }
}
```

- [ ] **Step 5: Run integration tests — expect green**

Run: `dotnet test Harmonia.sln --filter "Category=Rel"`

Expected: `Passed! - Failed: 0, Passed: 11` (7 existing Rel tests + 4 new).

---

## Task 13 — Endpoints and log exclusion tests (TDD)

**Test-first:** yes.

**Files:**
- Create: `tests/Harmonia.UnitTests/Api/MaintenanceFeeEndpointsTests.cs`
- Create: `tests/Harmonia.UnitTests/Api/MaintenanceFeeLogExclusionTests.cs`
- Create: `src/Harmonia.Api/MaintenanceFees/MaintenanceFeeEndpoints.cs`

- [ ] **Step 1: Write endpoint tests (compile fails until endpoints exist)**

Create `tests/Harmonia.UnitTests/Api/MaintenanceFeeEndpointsTests.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Api;

public class MaintenanceFeeEndpointsTests
{
    private static readonly HouseholdRef Target = new("HH-TARGET");
    private static readonly MaintenanceFeeCharge SampleCharge =
        new(Target, "IK-1", 100m, "Q3 fee", DateTimeOffset.UtcNow);

    private static RecordCharge RecordUseCase(RecordChargeResult result)
        => new(new FakeSession(new SessionContext(
                IsResident: false, IsAdmin: true, HouseholdRef: null)),
            new FakeMaintenanceFeeStore { NextRecordResult = result });

    private static RecordChargeRequest SampleRequest => new("IK-1", 100m, "Q3 fee");

    // POST — record charge
    [Fact]
    public async Task RecordCharge_Recorded_returns_201_with_charge_body()
    {
        var result = await MaintenanceFeeEndpoints.RecordCharge(
            RecordUseCase(new RecordChargeResult.Recorded(SampleCharge)),
            "HH-TARGET", SampleRequest,
            NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<ChargeDto>>(result);
        Assert.Equal(StatusCodes.Status201Created, json.StatusCode);
        Assert.Equal("IK-1", json.Value!.IdempotencyKey);
    }

    [Fact]
    public async Task RecordCharge_Duplicate_returns_200_with_existing_charge()
    {
        var result = await MaintenanceFeeEndpoints.RecordCharge(
            RecordUseCase(new RecordChargeResult.Duplicate(SampleCharge)),
            "HH-TARGET", SampleRequest,
            NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<ChargeDto>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
    }

    [Fact]
    public async Task RecordCharge_Refused_returns_403()
    {
        var result = await MaintenanceFeeEndpoints.RecordCharge(
            RecordUseCase(new RecordChargeResult.Refused()),
            "HH-TARGET", SampleRequest,
            NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task RecordCharge_Failed_returns_500()
    {
        var result = await MaintenanceFeeEndpoints.RecordCharge(
            RecordUseCase(new RecordChargeResult.Failed()),
            "HH-TARGET", SampleRequest,
            NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }

    // GET — list charges
    [Fact]
    public async Task ListCharges_Ok_returns_200_with_charge_list()
    {
        var useCase = new ListCharges(
            new FakeSession(new SessionContext(
                IsResident: true, IsAdmin: false, HouseholdRef: Target)),
            new FakeMaintenanceFeeStore { NextListResult = [SampleCharge] });

        var result = await MaintenanceFeeEndpoints.ListCharges(
            useCase, NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<List<ChargeDto>>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Single(json.Value!);
    }

    [Fact]
    public async Task ListCharges_Refused_returns_403()
    {
        var useCase = new ListCharges(new FakeSession(null),
            new FakeMaintenanceFeeStore());

        var result = await MaintenanceFeeEndpoints.ListCharges(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task ListCharges_Failed_returns_500()
    {
        var useCase = new ListCharges(
            new FakeSession(new SessionContext(
                IsResident: true, IsAdmin: false, HouseholdRef: Target)),
            new FakeMaintenanceFeeStore { ThrowOnList = true });

        var result = await MaintenanceFeeEndpoints.ListCharges(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }
}
```

- [ ] **Step 2: Write log exclusion test**

Create `tests/Harmonia.UnitTests/Api/MaintenanceFeeLogExclusionTests.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Api;

/// <summary>
/// R3: HouseholdRef value must never appear in any log line.
/// Mirrors LogExclusionTests.cs for the maintenance fee surface.
/// </summary>
public class MaintenanceFeeLogExclusionTests
{
    private const string SensitiveRef = "HH-SENSITIVE-DO-NOT-LOG";
    private static readonly HouseholdRef Household = new(SensitiveRef);
    private static readonly MaintenanceFeeCharge Charge =
        new(Household, "IK-TEST", 100m, "desc", DateTimeOffset.UtcNow);

    private sealed class CapturingLogger : ILogger
    {
        public List<string> Lines { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel l) => true;
        public void Log<TState>(LogLevel l, EventId id, TState s, Exception? ex,
            Func<TState, Exception?, string> f) => Lines.Add(f(s, ex));
    }

    [Theory]
    [InlineData("Recorded")]
    [InlineData("Duplicate")]
    [InlineData("Refused")]
    [InlineData("Failed")]
    public async Task RecordCharge_never_logs_householdRef_value(string outcome)
    {
        RecordChargeResult result = outcome switch
        {
            "Recorded"  => new RecordChargeResult.Recorded(Charge),
            "Duplicate" => new RecordChargeResult.Duplicate(Charge),
            "Refused"   => new RecordChargeResult.Refused(),
            _           => new RecordChargeResult.Failed()
        };

        var store = new FakeMaintenanceFeeStore { NextRecordResult = result };
        var useCase = new RecordCharge(
            new FakeSession(new SessionContext(
                IsResident: false, IsAdmin: true, HouseholdRef: null)),
            store);
        var logger = new CapturingLogger();

        await MaintenanceFeeEndpoints.RecordCharge(
            useCase, SensitiveRef, new RecordChargeRequest("IK-1", 100m, "desc"), logger, default);

        Assert.DoesNotContain(logger.Lines, l => l.Contains(SensitiveRef));
    }

    [Theory]
    [InlineData("Ok")]
    [InlineData("Refused")]
    [InlineData("Failed")]
    public async Task ListCharges_never_logs_householdRef_value(string outcome)
    {
        ListCharges useCase = outcome switch
        {
            "Ok" => new(
                new FakeSession(new SessionContext(
                    IsResident: true, IsAdmin: false, HouseholdRef: Household)),
                new FakeMaintenanceFeeStore { NextListResult = [Charge] }),
            "Failed" => new(
                new FakeSession(new SessionContext(
                    IsResident: true, IsAdmin: false, HouseholdRef: Household)),
                new FakeMaintenanceFeeStore { ThrowOnList = true }),
            _ => new(new FakeSession(null), new FakeMaintenanceFeeStore())
        };
        var logger = new CapturingLogger();

        await MaintenanceFeeEndpoints.ListCharges(useCase, logger, default);

        Assert.DoesNotContain(logger.Lines, l => l.Contains(SensitiveRef));
    }
}
```

- [ ] **Step 3: Run to verify compile failure**

Run: `dotnet build Harmonia.sln`

Expected: `MaintenanceFeeEndpoints` not found, `ChargeDto` not found.

- [ ] **Step 4: Implement MaintenanceFeeEndpoints**

Create `src/Harmonia.Api/MaintenanceFees/MaintenanceFeeEndpoints.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Api.MaintenanceFees;

/// <summary>POST body for recording a charge.</summary>
public sealed record RecordChargeRequest(string IdempotencyKey, decimal Amount, string Description);

public sealed record ChargeDto(
    string IdempotencyKey,
    decimal Amount,
    string Description,
    DateTimeOffset ChargedAt);

/// <summary>
/// HTTP translation for the maintenance fee surfaces — translation only, no business logic.
/// Logs carry outcome tokens only — never the HouseholdRef value (R3).
/// TypedResults used throughout so endpoint unit tests can assert on concrete result types.
/// </summary>
public static class MaintenanceFeeEndpoints
{
    public static async Task<IResult> RecordCharge(
        RecordCharge useCase, string householdRef, RecordChargeRequest request,
        ILogger logger, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(householdRef))
            return TypedResults.BadRequest("householdRef is required");

        var target = new HouseholdRef(householdRef);
        var result = await useCase.ExecuteAsync(
            target, request.IdempotencyKey, request.Amount, request.Description, ct);

        // R3: log outcome tokens only — never target.Value or any householdRef string
        switch (result)
        {
            case RecordChargeResult.Recorded r:
                logger.LogInformation("RecordCharge {IdempotencyKey}: Recorded", request.IdempotencyKey);
                return TypedResults.Json(ToDto(r.Charge), statusCode: StatusCodes.Status201Created);

            case RecordChargeResult.Duplicate d:
                logger.LogInformation("RecordCharge {IdempotencyKey}: Duplicate", request.IdempotencyKey);
                return TypedResults.Json(ToDto(d.Existing), statusCode: StatusCodes.Status200OK);

            case RecordChargeResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);

            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> ListCharges(
        ListCharges useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);

        switch (result)
        {
            case ListChargesResult.Ok ok:
                logger.LogInformation("ListCharges: {Count} charges", ok.Charges.Count);
                return TypedResults.Json(ok.Charges.Select(ToDto).ToList(),
                    statusCode: StatusCodes.Status200OK);

            case ListChargesResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);

            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private static ChargeDto ToDto(MaintenanceFeeCharge c)
        => new(c.IdempotencyKey, c.Amount, c.Description, c.ChargedAt);
}
```

- [ ] **Step 5: Run to verify unit tests pass**

Run: `dotnet test Harmonia.sln --filter "Category!=Rel"`

Expected: all tests pass (47 existing + 8 endpoint + 7 log exclusion = 62).

---

## Task 14 — Wire Program.cs, full test run, commit 2

**Test-first:** no — wiring.

**Files:**
- Modify: `src/Harmonia.Api/Program.cs`

- [ ] **Step 1: Add ledger wiring to Program.cs**

After the existing `ConnectionStrings:Reservations` block and before `builder.Services.AddSingleton<ISession>(...)`, add:

```csharp
using Harmonia.Api.Adapters;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Application.MaintenanceFees;
```

And after the existing services/routes, append:

```csharp
// Maintenance fee ledger
var mfConnStr = builder.Configuration.GetConnectionString("MaintenanceFees");
if (string.IsNullOrWhiteSpace(mfConnStr))
{
    throw new InvalidOperationException(
        "ConnectionStrings:MaintenanceFees is not configured. Supply it via environment " +
        "(ConnectionStrings__MaintenanceFees) or a git-ignored local config file.");
}
builder.Services.AddSingleton<IMaintenanceFeeStore>(new SqlMaintenanceFeeStore(mfConnStr));
builder.Services.AddScoped<RecordCharge>();
builder.Services.AddScoped<ListCharges>();
```

And after `app.MapPost(...)`, append:

```csharp
app.MapPost(
    "/maintenance-fees/charges/{householdRef}",
    (RecordCharge useCase, string householdRef, RecordChargeRequest body,
     ILoggerFactory loggers, CancellationToken ct)
        => MaintenanceFeeEndpoints.RecordCharge(
            useCase, householdRef, body,
            loggers.CreateLogger("MaintenanceFees"), ct));

app.MapGet(
    "/maintenance-fees/charges",
    (ListCharges useCase, ILoggerFactory loggers, CancellationToken ct)
        => MaintenanceFeeEndpoints.ListCharges(
            useCase, loggers.CreateLogger("MaintenanceFees"), ct));
```

- [ ] **Step 2: Verify full build**

Run: `dotnet build Harmonia.sln`

Expected: `Build succeeded. 0 Error(s).`

- [ ] **Step 3: Run all unit tests**

Run: `dotnet test Harmonia.sln --filter "Category!=Rel"`

Expected: `Passed! - Failed: 0, Passed: 62`

- [ ] **Step 4: Run all Rel integration tests**

Run: `dotnet test Harmonia.sln --filter "Category=Rel"` (requires `HARMONIA_SQL_CONNSTR`)

Expected: `Passed! - Failed: 0, Passed: 11`

- [ ] **Step 5: Commit 2**

```bash
git add src/ tests/ db/ context/ && git commit -m "feat: maintenance fee ledger — record and list charges

Append-only ledger: POST /maintenance-fees/charges/{householdRef}
(admin-only), GET /maintenance-fees/charges (resident-only).
Idempotency key prevents duplicate charges on retry.
SQL Server store; all 62 unit + 11 Rel tests green."
```
