# GDPR Erasure Slice 2 — DepartedAt Schema Migration and Retention Enforcement

**Scope:** Schema migration adding `DepartedAt` to `dbo.HouseholdContacts`, `MarkDeparted` use case (board sets departure date), `PurgeExpiredContacts` use case (board sweeps rows ≥ 1 year past departure), and departure-aware filtering in `GetDirectory`. Governed by ADR-0004.

---

## Goal

Enforce the 1-year retention policy from ADR-0004: board admins mark residents as departed, and a board-triggered purge hard-deletes rows where `DepartedAt < NOW() - 1 year`. Resident directory view hides departed contacts. Board view exposes departure status.

---

## Architecture

Same three-layer pattern as the rest of the directory feature. No new packages. No background service — purge is board-triggered via HTTP.

---

## Domain

### `src/Harmonia.Domain/Directory/HouseholdContact.cs`

Append `DepartedAt: DateTimeOffset?` as the last parameter of the positional record constructor:

```csharp
/// <summary>
/// Contact details for one household unit.
/// R3: <see cref="Phone"/>, <see cref="Email"/>, and <see cref="HouseholdRef"/> are personal data — never log them.
/// </summary>
public sealed record HouseholdContact(
    HouseholdRef     HouseholdRef,
    string?          DisplayName,
    string?          Phone,
    string?          Email,
    string?          Notes,
    bool             IsOptedOut,
    DateTimeOffset   UpdatedAt,
    DateTimeOffset?  DepartedAt);
```

**Breaking change:** every existing `new HouseholdContact(...)` callsite gains a required 8th argument. All callsites must be updated to pass `DepartedAt: null` explicitly. Affected callsites: `SqlDirectoryStore.ReadRow`, `FakeDirectoryStore` in `Fakes.cs`, and every test that constructs `HouseholdContact` directly.

---

## Port Contract

### `src/Harmonia.Application/Directory/Ports.cs`

Add two result types and two port methods.

**New result types** (append after `EraseContactResult`):

```csharp
/// <summary>Outcome of marking a household as departed (GDPR Art. 6(1)(f) retention clock start).</summary>
public abstract record MarkDepartedResult
{
    private MarkDepartedResult() { }
    /// <summary>Caller lacks the required role or session.</summary>
    public sealed record Refused  : MarkDepartedResult;
    /// <summary>DepartedAt set (or already set — idempotent).</summary>
    public sealed record Ok       : MarkDepartedResult;
    /// <summary>No row with that HouseholdRef exists.</summary>
    public sealed record NotFound : MarkDepartedResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed   : MarkDepartedResult;
}

/// <summary>Outcome of the annual retention purge sweep.</summary>
public abstract record PurgeExpiredContactsResult
{
    private PurgeExpiredContactsResult() { }
    /// <summary>Caller lacks the required role or session.</summary>
    public sealed record Refused            : PurgeExpiredContactsResult;
    /// <summary>Sweep completed; <see cref="Deleted"/> rows were hard-deleted.</summary>
    public sealed record Ok(int Deleted)    : PurgeExpiredContactsResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed             : PurgeExpiredContactsResult;
}
```

**New port methods** (append to `IDirectoryStore` after `DeleteContactAsync`):

```csharp
    /// <summary>
    /// Sets <c>DepartedAt</c> for <paramref name="householdRef"/> to the current UTC time.
    /// Idempotent — preserves the original departure date if already set.
    /// Returns <see cref="MarkDepartedResult.NotFound"/> when no row exists.
    /// R3: never log <paramref name="householdRef"/> value.
    /// </summary>
    Task<MarkDepartedResult> MarkDepartedAsync(
        HouseholdRef householdRef,
        CancellationToken ct = default);

    /// <summary>
    /// Hard-deletes all rows where <c>DepartedAt</c> is older than 1 year (GDPR Art. 6(1)(f) retention cutoff).
    /// Returns the count of deleted rows.
    /// </summary>
    Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(
        CancellationToken ct = default);
```

---

## Use Cases

### `src/Harmonia.Application/Directory/MarkDeparted.cs`

Board-only. `householdRef` comes from the URL path parameter (R2 — never from request body).

```csharp
using Harmonia.Application;
using Harmonia.Domain;

namespace Harmonia.Application.Directory;

/// <summary>
/// Board-only: sets DepartedAt for a resident, starting the 1-year retention clock (ADR-0004).
/// householdRef sourced from URL path param (R2).
/// </summary>
public sealed class MarkDeparted(ISession session, IDirectoryStore store)
{
    public async Task<MarkDepartedResult> ExecuteAsync(
        string householdRef, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new MarkDepartedResult.Refused();
        try
        {
            return await store.MarkDepartedAsync(new HouseholdRef(householdRef), ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new MarkDepartedResult.Failed(); }
    }
}
```

### `src/Harmonia.Application/Directory/PurgeExpiredContacts.cs`

Board-only. No `householdRef` parameter — operates on all eligible rows.

```csharp
using Harmonia.Application;

namespace Harmonia.Application.Directory;

/// <summary>
/// Board-only: hard-deletes all HouseholdContacts rows where DepartedAt &lt; NOW() - 1 year (ADR-0004).
/// </summary>
public sealed class PurgeExpiredContacts(ISession session, IDirectoryStore store)
{
    public async Task<PurgeExpiredContactsResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new PurgeExpiredContactsResult.Refused();
        try
        {
            return await store.PurgeExpiredContactsAsync(ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new PurgeExpiredContactsResult.Failed(); }
    }
}
```

---

## SQL Adapter

### `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`

**1. Update `ListAllAsync` SELECT** — append `DepartedAt` at the end of the column list:

```sql
SELECT HouseholdRef, DisplayName, Phone, Email, Notes, IsOptedOut, UpdatedAt, DepartedAt
FROM dbo.HouseholdContacts
ORDER BY DisplayName;
```

**2. Update `ReadRow`** — add ordinal 7:

```csharp
private static HouseholdContact ReadRow(SqlDataReader r) => new(
    new HouseholdRef(r.GetString(0)),
    r.IsDBNull(1) ? null : r.GetString(1),
    r.IsDBNull(2) ? null : r.GetString(2),
    r.IsDBNull(3) ? null : r.GetString(3),
    r.IsDBNull(4) ? null : r.GetString(4),
    r.GetBoolean(5),
    r.GetDateTimeOffset(6),
    r.IsDBNull(7) ? null : r.GetDateTimeOffset(7));
```

**3. Add `MarkDepartedAsync`:**

```csharp
public async Task<MarkDepartedResult> MarkDepartedAsync(
    HouseholdRef householdRef, CancellationToken ct = default)
{
    try
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE dbo.HouseholdContacts
            SET DepartedAt = ISNULL(DepartedAt, SYSUTCDATETIMEOFFSET())
            WHERE HouseholdRef = @HouseholdRef;
            """;
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return rows == 0
            ? new MarkDepartedResult.NotFound()
            : new MarkDepartedResult.Ok();
    }
    catch (OperationCanceledException) { throw; }
    catch (Exception) { return new MarkDepartedResult.Failed(); }
}
```

`ISNULL(DepartedAt, SYSUTCDATETIMEOFFSET())` preserves the original departure date if already set — idempotent.

**4. Add `PurgeExpiredContactsAsync`:**

```csharp
public async Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(
    CancellationToken ct = default)
{
    try
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            DELETE FROM dbo.HouseholdContacts
            WHERE DepartedAt IS NOT NULL
              AND DepartedAt < DATEADD(year, -1, SYSUTCDATETIMEOFFSET());
            """;
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return new PurgeExpiredContactsResult.Ok(rows);
    }
    catch (OperationCanceledException) { throw; }
    catch (Exception) { return new PurgeExpiredContactsResult.Failed(); }
}
```

Uses `SYSUTCDATETIMEOFFSET()` (returns `datetimeoffset`) — not `GETUTCDATE()` (returns `datetime`) — to match the column type.

---

## Database Migration

### `db/schema.sql`

Add idempotent `ALTER TABLE` after the `CREATE TABLE dbo.HouseholdContacts` block:

```sql
IF COL_LENGTH('dbo.HouseholdContacts', 'DepartedAt') IS NULL
    ALTER TABLE dbo.HouseholdContacts ADD DepartedAt datetimeoffset NULL;
```

Must be idempotent — `SqlServerFixture` applies `schema.sql` on every integration test run against the shared database.

---

## GetDirectory — departure-aware filtering

### `src/Harmonia.Application/Directory/GetDirectory.cs`

Filter departed contacts from `ResidentView`. Board sees all contacts (including departed, so they know who to purge or verify).

In `GetDirectory.ExecuteAsync`, when building `ResidentView`, filter out rows where `DepartedAt` is set:

```csharp
// ResidentView: exclude departed residents and opted-out contacts
case { IsResident: true }:
    var residentEntries = all
        .Where(c => c.DepartedAt is null && !c.IsOptedOut)
        .ToList();
    return new GetDirectoryResult.ResidentView(residentEntries);
```

(Board view returns `all` unchanged — board needs visibility into departed status for DSAR and purge verification.)

---

## API Endpoints

### `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`

**Update `DirectoryEntryFullDto`** — add `DepartedAt`:

```csharp
public sealed record DirectoryEntryFullDto(
    string           HouseholdRef,
    string?          DisplayName,
    string?          Phone,
    string?          Email,
    string?          Notes,
    bool             IsOptedOut,
    DateTimeOffset   UpdatedAt,
    DateTimeOffset?  DepartedAt);
```

**Update `ToFullDto`** — map the new field:

```csharp
private static DirectoryEntryFullDto ToFullDto(HouseholdContact c) => new(
    c.HouseholdRef.Value, c.DisplayName, c.Phone, c.Email,
    c.Notes, c.IsOptedOut, c.UpdatedAt, c.DepartedAt);
```

**Add `MarkDepartedEndpoint`:**

```csharp
/// <summary>
/// PUT /directory/{householdRef}/departed — board sets departure date.
/// R3: householdRef never logged here.
/// </summary>
public static async Task<IResult> MarkDepartedEndpoint(
    MarkDeparted useCase, string householdRef, ILogger logger, CancellationToken ct)
{
    var result = await useCase.ExecuteAsync(householdRef, ct);
    return result switch
    {
        MarkDepartedResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
        MarkDepartedResult.Ok       => TypedResults.Ok(),
        MarkDepartedResult.NotFound => TypedResults.NotFound(),
        MarkDepartedResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
        _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
    };
}
```

**Add `PurgeExpiredContactsEndpoint`:**

```csharp
/// <summary>
/// DELETE /directory/purge-expired — board triggers annual retention sweep.
/// Returns { deleted: N } — 0 when no rows are eligible.
/// </summary>
public static async Task<IResult> PurgeExpiredContactsEndpoint(
    PurgeExpiredContacts useCase, ILogger logger, CancellationToken ct)
{
    var result = await useCase.ExecuteAsync(ct);
    return result switch
    {
        PurgeExpiredContactsResult.Refused       => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
        PurgeExpiredContactsResult.Ok ok         => TypedResults.Ok(new { deleted = ok.Deleted }),
        PurgeExpiredContactsResult.Failed        => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
        _                                        => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
    };
}
```

### `src/Harmonia.Api/Program.cs`

**DI registrations** (after `AddScoped<EraseContact>()`):

```csharp
builder.Services.AddScoped<MarkDeparted>();
builder.Services.AddScoped<PurgeExpiredContacts>();
```

**Routes** (after the existing `MapDelete` routes):

```csharp
app.MapPut(
    "/directory/{householdRef}/departed",
    (MarkDeparted uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.MarkDepartedEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapDelete(
    "/directory/purge-expired",
    (PurgeExpiredContacts uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();
```

---

## Fakes (`tests/Harmonia.UnitTests/Fakes.cs`)

All existing `new HouseholdContact(...)` callsites in `Fakes.cs` gain `DepartedAt: null` as the 8th argument.

**`FakeDirectoryStore.MarkDepartedAsync`:**

```csharp
public Task<MarkDepartedResult> MarkDepartedAsync(
    HouseholdRef householdRef, CancellationToken ct = default)
{
    var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef);
    if (idx < 0) return Task.FromResult<MarkDepartedResult>(new MarkDepartedResult.NotFound());
    var c = _contacts[idx];
    _contacts[idx] = c with { DepartedAt = c.DepartedAt ?? DateTimeOffset.UtcNow };
    return Task.FromResult<MarkDepartedResult>(new MarkDepartedResult.Ok());
}
```

**`FakeDirectoryStore.PurgeExpiredContactsAsync`:**

```csharp
public Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(CancellationToken ct = default)
{
    var cutoff  = DateTimeOffset.UtcNow.AddYears(-1);
    var removed = _contacts.RemoveAll(c => c.DepartedAt.HasValue && c.DepartedAt.Value < cutoff);
    return Task.FromResult<PurgeExpiredContactsResult>(new PurgeExpiredContactsResult.Ok(removed));
}
```

**`FailingDirectoryStore.MarkDepartedAsync`:**

```csharp
public Task<MarkDepartedResult> MarkDepartedAsync(
    HouseholdRef householdRef, CancellationToken ct = default)
    => Task.FromResult<MarkDepartedResult>(new MarkDepartedResult.Failed());
```

**`FailingDirectoryStore.PurgeExpiredContactsAsync`:**

```csharp
public Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(CancellationToken ct = default)
    => Task.FromResult<PurgeExpiredContactsResult>(new PurgeExpiredContactsResult.Failed());
```

---

## Testing

### Unit tests — use cases

**`MarkDepartedTests.cs`** (6 tests):

| Test | Setup | Expected |
|---|---|---|
| `Null_session_returns_Refused` | `FakeSession(null)` | `Refused` |
| `Resident_session_returns_Refused` | `FakeSession(ResidentCtx)` | `Refused` |
| `Admin_marks_existing_contact_returns_Ok` | seed store with target ref | `Ok` |
| `Admin_target_not_found_returns_NotFound` | empty store | `NotFound` |
| `MarkDeparted_is_idempotent` | seed store with `DepartedAt` already set; call again | `Ok`; original `DepartedAt` unchanged |
| `Store_failure_returns_Failed` | `FailingDirectoryStore` | `Failed` |

**`PurgeExpiredContactsTests.cs`** (5 tests):

| Test | Setup | Expected |
|---|---|---|
| `Null_session_returns_Refused` | `FakeSession(null)` | `Refused` |
| `Resident_session_returns_Refused` | `FakeSession(ResidentCtx)` | `Refused` |
| `Admin_purges_expired_rows_returns_count` | seed 2 expired rows | `Ok(Deleted: 2)` |
| `Admin_no_eligible_rows_returns_zero` | seed 1 row, `DepartedAt = null` | `Ok(Deleted: 0)` |
| `Store_failure_returns_Failed` | `FailingDirectoryStore` | `Failed` |

### Unit tests — endpoints

**Append to `DirectoryEndpointsTests.cs`** (7 tests):

| Test | Assert |
|---|---|
| `MarkDeparted_ok_returns_200` | `StatusCode == 200` |
| `MarkDeparted_not_found_returns_404` | `StatusCode == 404` |
| `MarkDeparted_refused_returns_403` | `StatusCode == 403` |
| `MarkDeparted_store_failure_returns_500` | `StatusCode == 500` |
| `PurgeExpired_ok_returns_200_with_count` | `StatusCode == 200`; response body `{ deleted: N }` |
| `PurgeExpired_refused_returns_403` | `StatusCode == 403` |
| `PurgeExpired_store_failure_returns_500` | `StatusCode == 500` |

### Integration tests

**Append to `SqlDirectoryStoreTests.cs`** (6 tests):

| Test | What it proves |
|---|---|
| `MarkDeparted_sets_DepartedAt_and_row_appears_in_ListAll` | Happy path; `ListAllAsync` returns row with non-null `DepartedAt` |
| `MarkDeparted_nonexistent_row_returns_NotFound` | Zero-rows-affected branch |
| `MarkDeparted_already_departed_is_idempotent` | Original date preserved; returns `Ok` |
| `PurgeExpired_deletes_rows_past_cutoff` | Rows with `DepartedAt < NOW()-1yr` deleted; count matches |
| `PurgeExpired_spares_rows_inside_window` | Rows with recent `DepartedAt` untouched |
| `PurgeExpired_spares_rows_with_null_DepartedAt` | Active residents unaffected |

### R3 log-exclusion tests

**`DirectoryLogExclusionTests.cs`** — add one `[Theory]` (4 `[InlineData]` scenarios) for `MarkDepartedEndpoint`: verify `householdRef` URL path parameter never appears in any log line across `ok`, `not_found`, `refused`, `failed` outcomes. `PurgeExpiredContactsEndpoint` takes no `householdRef` parameter so no R3 test is needed for it.

---

## Constraints

- **R2:** `MarkDeparted.ExecuteAsync` receives `householdRef` as a `string` from the URL path parameter — never from request body or session.
- **R3:** `householdRef` never passed to `ILogger` in endpoint or use-case layer.
- **Ordinal safety:** `DepartedAt` at position 7 in `ReadRow` — must not shift `IsOptedOut` (5) or `UpdatedAt` (6).
- **`SYSUTCDATETIMEOFFSET()`** in SQL (not `GETUTCDATE()`) — type matches `datetimeoffset NULL` column.
- **Idempotent migration:** `IF COL_LENGTH(...)` guard mandatory in `schema.sql`.
- **XML doc comments** on all new public types and methods.

---

## Out of Scope

- Resident opt-out of being listed post-departure (separate policy decision).
- `PushSubscriptions` and `NotificationHistory` erasure (Slice 3, pending scope decision).
- Background/scheduled purge — purge is board-admin HTTP triggered only (ADR-0004).
