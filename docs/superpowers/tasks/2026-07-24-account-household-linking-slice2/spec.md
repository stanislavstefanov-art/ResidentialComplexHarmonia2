# Slice 2 — Admin Activation Endpoints + GDPR Purge

**Slice**: 2 of 3 — admin management of the pending queue  
**Depends on**: Slice 1 (PR #44, merged 2026-07-24) — `dbo.PendingSignIns`, `dbo.HouseholdLinks`, `IPendingSignInStore`, pending middleware, `GET /me`

---

## Goal

Give admins the ability to:
1. See who is waiting for activation (`GET /admin/pending`)
2. Link a pending caller to a household (`POST /admin/pending/{oid}/activate`)
3. Purge stale pending entries older than 90 days (`DELETE /admin/pending/purge-expired`)

Slice 3 (Angular + React UI) depends on these endpoints.

---

## Security Constraints (non-negotiable, inherited from ADR-0001 and ADR-0015)

- **R2**: household binding always written to `dbo.HouseholdLinks` by the API — never trusted from the request JWT or a client-supplied claim.
- **R3**: `EntraObjectId`, `Email`, `DisplayName` are personal data — never pass their values to any logger anywhere in the call stack.
- **Admin gate**: all three endpoints check `session.Resolve() is { IsAdmin: true }`. A non-admin or missing session → `Refused` → 403. Admin role comes from the JWT `extension_role=admin` claim (resolved by `EntraSession` in production, `DevAdminSession` in dev).

---

## Data Layer

### Schema — no changes

`dbo.PendingSignIns` and `dbo.HouseholdLinks` were created in Slice 1. No DDL changes needed.

### New domain record

```csharp
// src/Harmonia.Application/PendingSignIn/PendingSignIn.cs
namespace Harmonia.Application.PendingSignIn;

public sealed record PendingSignIn(
    string   EntraObjectId,
    string   Email,
    string   DisplayName,
    DateTime FirstSeenAt);
```

### Port extensions — `IPendingSignInStore`

Add three methods to the existing interface in `src/Harmonia.Application/PendingSignIn/Ports.cs`:

```csharp
/// <summary>Returns all pending-activation rows, ordered by FirstSeenAt ascending.</summary>
Task<IReadOnlyList<PendingSignIn>> ListAsync(CancellationToken ct = default);

/// <summary>
/// Atomically inserts into dbo.HouseholdLinks and deletes from dbo.PendingSignIns
/// in a single SQL transaction. Returns the outcome discriminant.
/// R3: oid and householdRef are personal data — never log their values.
/// </summary>
Task<ActivateResult> ActivateAsync(string oid, string householdRef, CancellationToken ct = default);

/// <summary>Deletes rows where FirstSeenAt is older than <paramref name="olderThan"/>. Returns row count.</summary>
Task<int> PurgeExpiredAsync(DateTime olderThan, CancellationToken ct = default);
```

Add the result enum to the same file:

```csharp
public enum ActivateResult { Ok, NotFound, AlreadyActivated }
```

---

## Application Layer

### Use Case 1 — `ListPendingSignIns`

```csharp
// src/Harmonia.Application/PendingSignIn/ListPendingSignIns.cs
namespace Harmonia.Application.PendingSignIn;

public abstract record ListPendingResult
{
    private ListPendingResult() { }
    public sealed record Refused                              : ListPendingResult;
    public sealed record Ok(IReadOnlyList<PendingSignIn> Items) : ListPendingResult;
}

public sealed class ListPendingSignIns(ISession session, IPendingSignInStore store)
{
    public async Task<ListPendingResult> ExecuteAsync(CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new ListPendingResult.Refused();
        var items = await store.ListAsync(ct);
        return new ListPendingResult.Ok(items);
    }
}
```

### Use Case 2 — `ActivatePendingSignIn`

```csharp
// src/Harmonia.Application/PendingSignIn/ActivatePendingSignIn.cs
namespace Harmonia.Application.PendingSignIn;

public abstract record ActivatePendingSignInResult
{
    private ActivatePendingSignInResult() { }
    public sealed record Refused          : ActivatePendingSignInResult;
    public sealed record NotFound         : ActivatePendingSignInResult;
    public sealed record AlreadyActivated : ActivatePendingSignInResult;
    public sealed record Ok               : ActivatePendingSignInResult;
}

public sealed class ActivatePendingSignIn(ISession session, IPendingSignInStore store)
{
    public async Task<ActivatePendingSignInResult> ExecuteAsync(
        string oid, string householdRef, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new ActivatePendingSignInResult.Refused();
        return await store.ActivateAsync(oid, householdRef, ct) switch
        {
            ActivateResult.Ok               => new ActivatePendingSignInResult.Ok(),
            ActivateResult.NotFound         => new ActivatePendingSignInResult.NotFound(),
            ActivateResult.AlreadyActivated => new ActivatePendingSignInResult.AlreadyActivated(),
            _                               => new ActivatePendingSignInResult.Refused()
        };
    }
}
```

### Use Case 3 — `PurgeExpiredPendingSignIns`

```csharp
// src/Harmonia.Application/PendingSignIn/PurgeExpiredPendingSignIns.cs
namespace Harmonia.Application.PendingSignIn;

public abstract record PurgeExpiredPendingResult
{
    private PurgeExpiredPendingResult() { }
    public sealed record Refused         : PurgeExpiredPendingResult;
    public sealed record Ok(int Deleted) : PurgeExpiredPendingResult;
}

public sealed class PurgeExpiredPendingSignIns(ISession session, IPendingSignInStore store)
{
    private static readonly TimeSpan RetentionWindow = TimeSpan.FromDays(90);

    public async Task<PurgeExpiredPendingResult> ExecuteAsync(CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new PurgeExpiredPendingResult.Refused();
        var cutoff  = DateTime.UtcNow - RetentionWindow;
        var deleted = await store.PurgeExpiredAsync(cutoff, ct);
        return new PurgeExpiredPendingResult.Ok(deleted);
    }
}
```

---

## Infrastructure Layer

### `SqlPendingSignInStore` — three new methods

**`ListAsync`**

```sql
SELECT EntraObjectId, Email, DisplayName, FirstSeenAt
FROM dbo.PendingSignIns
ORDER BY FirstSeenAt ASC;
```

Returns `IReadOnlyList<PendingSignIn>`. Empty list when no pending rows.

**`ActivateAsync`** — atomic two-table transaction

```sql
BEGIN TRANSACTION;

-- Guard: must be pending
IF NOT EXISTS (SELECT 1 FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid)
BEGIN
    ROLLBACK; -- signal NotFound
END

-- Guard: must not already be linked
IF EXISTS (SELECT 1 FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid)
BEGIN
    ROLLBACK; -- signal AlreadyActivated
END

INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, LinkedAt)
VALUES (@Oid, @HouseholdRef, SYSUTCDATETIME());

DELETE FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid;

COMMIT;
```

Implemented as a single `SqlCommand` with `SET XACT_ABORT ON` to auto-rollback on error. The adapter uses `@@ROWCOUNT` and conditional logic to return the correct `ActivateResult` discriminant without round-trips.

Concrete SQL implementation:

```sql
SET XACT_ABORT ON;
BEGIN TRANSACTION;
    DECLARE @pendingExists   bit = 0;
    DECLARE @alreadyLinked   bit = 0;

    IF EXISTS (SELECT 1 FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid)
        SET @pendingExists = 1;

    IF EXISTS (SELECT 1 FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid)
        SET @alreadyLinked = 1;

    IF @pendingExists = 1 AND @alreadyLinked = 0
    BEGIN
        INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, LinkedAt)
        VALUES (@Oid, @HouseholdRef, SYSUTCDATETIME());

        DELETE FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid;
    END
COMMIT;

SELECT @pendingExists AS PendingExists, @alreadyLinked AS AlreadyLinked;
```

The adapter reads `PendingExists` and `AlreadyLinked` from the result set and maps to `ActivateResult`.

**`PurgeExpiredAsync`**

```sql
DELETE FROM dbo.PendingSignIns
WHERE FirstSeenAt < @OlderThan;
SELECT @@ROWCOUNT;
```

Returns the deleted row count.

---

## API Layer

### New file: `src/Harmonia.Api/Admin/AdminPendingEndpoints.cs`

```csharp
// DTOs
public sealed record PendingSignInDto(
    string   EntraObjectId,
    string   Email,
    string   DisplayName,
    DateTime FirstSeenAt);

public sealed record ActivateRequest(string HouseholdRef);

// Handler signatures
static Task<IResult> ListPendingEndpoint(ListPendingSignIns useCase, ILogger logger, CancellationToken ct);
static Task<IResult> ActivatePendingEndpoint(ActivatePendingSignIn useCase, string oid, ActivateRequest body, ILogger logger, CancellationToken ct);
static Task<IResult> PurgeExpiredPendingEndpoint(PurgeExpiredPendingSignIns useCase, ILogger logger, CancellationToken ct);
```

**HTTP contract:**

| Method | Path | Success | Errors |
|--------|------|---------|--------|
| `GET` | `/admin/pending` | `200 [{oid,email,displayName,firstSeenAt},…]` | `403` non-admin |
| `POST` | `/admin/pending/{oid}/activate` | `200` | `403` non-admin · `404` not pending · `409` already linked |
| `DELETE` | `/admin/pending/purge-expired` | `200 {"deleted":5}` | `403` non-admin |

R3: OID, email, displayName are never passed to any logger. The logger receives only the outcome type name (same pattern as `MeEndpoints`).

### `Program.cs` additions

Three `AddScoped` calls and three route registrations (`MapGet`, `MapPost`, `MapDelete`). No other files change.

---

## Fakes

Add to `tests/Harmonia.UnitTests/Fakes.cs`:

```csharp
public sealed class FakePendingSignInStoreV2 : IPendingSignInStore
{
    public List<PendingSignIn> Pending { get; set; } = [];
    public List<(string Oid, string HouseholdRef)> ActivateCalls { get; } = [];
    public int PurgeCutoffCallCount { get; private set; }

    public Task UpsertAsync(string oid, string email, string displayName, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task<IReadOnlyList<PendingSignIn>> ListAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<PendingSignIn>>(Pending);

    public Task<ActivateResult> ActivateAsync(string oid, string householdRef, CancellationToken ct = default)
    {
        ActivateCalls.Add((oid, householdRef));
        var pending = Pending.FirstOrDefault(p => p.EntraObjectId == oid);
        if (pending is null) return Task.FromResult(ActivateResult.NotFound);
        Pending.Remove(pending);
        return Task.FromResult(ActivateResult.Ok);
    }

    public Task<int> PurgeExpiredAsync(DateTime olderThan, CancellationToken ct = default)
    {
        PurgeCutoffCallCount++;
        var removed = Pending.RemoveAll(p => p.FirstSeenAt < olderThan);
        return Task.FromResult(removed);
    }
}
```

The existing `FakePendingSignInStore` (Slice 1) remains unchanged — it only implements `UpsertAsync`. The new `FakePendingSignInStoreV2` implements all four methods and is used by Slice 2 tests.

---

## Tests

### Unit — `ListPendingSignInsTests.cs`

- Admin session + items → `Ok` with correct list
- Admin session + empty store → `Ok` with empty list
- Non-admin session → `Refused`
- Null session → `Refused`

### Unit — `ActivatePendingSignInTests.cs`

- Admin + OID in pending → `Ok`, pending row removed from fake
- Admin + OID not in pending → `NotFound`
- Admin + OID already activated (not in pending store) → `NotFound` (fake returns `NotFound`)
- Non-admin → `Refused`
- Null session → `Refused`

### Unit — `PurgeExpiredPendingSignInsTests.cs`

- Admin + rows older than 90 days → `Ok(N)` with correct count
- Admin + no expired rows → `Ok(0)`
- Non-admin → `Refused`

### Unit — `AdminPendingEndpointsTests.cs`

- `GET /admin/pending`: `ListPendingResult.Ok` → 200 JSON array; `Refused` → 403
- `POST /admin/pending/{oid}/activate`: `Ok` → 200; `NotFound` → 404; `AlreadyActivated` → 409; `Refused` → 403
- `DELETE /admin/pending/purge-expired`: `Ok(3)` → 200 `{"deleted":3}`; `Refused` → 403

### Unit — `AdminPendingLogExclusionTests.cs`

Verifies that OID, email, and displayName values never appear in log output from any of the three endpoint handlers (R3).

### Integration — `SqlPendingSignInStoreSlice2Tests.cs`

- `ListAsync` returns all pending rows ordered by `FirstSeenAt` ascending
- `ListAsync` returns empty list when no rows exist
- `ActivateAsync` with known OID → row in `HouseholdLinks`, row deleted from `PendingSignIns`, returns `Ok`
- `ActivateAsync` with unknown OID → returns `NotFound`, `HouseholdLinks` unchanged
- `ActivateAsync` with OID already in `HouseholdLinks` → returns `AlreadyActivated`, no duplicate row
- `PurgeExpiredAsync` deletes only rows older than cutoff, returns correct count

---

## Out of Scope for Slice 2

- Angular and React admin panel → Slice 3
- Email notification to the resident on activation → future slice
- Bulk activation → future slice
- Audit log of activation events → future slice
