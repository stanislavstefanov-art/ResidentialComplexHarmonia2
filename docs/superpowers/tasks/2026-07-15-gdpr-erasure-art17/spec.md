# GDPR Art. 17 Erasure Core — Slice 1 Design Spec

**Scope:** Resident self-erase and board DSAR hard-delete for `dbo.HouseholdContacts`.
No schema migration (DepartedAt deferred to Slice 2). No retention purge (deferred to Slice 2).

---

## Goal

Allow a resident to delete their own contact record (Art. 17 right-to-erasure self-service) and
allow a board admin to hard-delete any contact record on behalf of a resident (DSAR compliance).
Both paths are irreversible hard-DELETEs against `dbo.HouseholdContacts`.

---

## Architecture

Three-layer clean architecture — identical to the existing directory feature:

- **Domain:** no change to `HouseholdContact.cs`. `HouseholdRef` value type used as the deletion key.
- **Application (port):** `IDirectoryStore` gains one new method; `Ports.cs` gains one new result type.
- **Application (use cases):** two new use-case classes, one per actor.
- **Adapter:** `SqlDirectoryStore` implements the new port method with a single-row `DELETE`.
- **API:** two new static endpoint methods on `DirectoryEndpoints`; two new `MapDelete` routes in `Program.cs`.

---

## Port Contract

**New result type in `src/Harmonia.Application/Directory/Ports.cs`:**

```csharp
/// <summary>Result of a contact-erasure request.</summary>
public abstract record EraseContactResult
{
    private EraseContactResult() { }
    /// <summary>Caller lacks the required role or session.</summary>
    public sealed record Refused  : EraseContactResult;
    /// <summary>Row deleted successfully.</summary>
    public sealed record Ok       : EraseContactResult;
    /// <summary>No row with that HouseholdRef exists.</summary>
    public sealed record NotFound : EraseContactResult;
    /// <summary>Store error — caller should return 500.</summary>
    public sealed record Failed   : EraseContactResult;
}
```

**New port method on `IDirectoryStore`:**

```csharp
Task<EraseContactResult> DeleteContactAsync(
    HouseholdRef householdRef,
    CancellationToken ct = default);
```

---

## Use Cases

### `src/Harmonia.Application/Directory/EraseMyContact.cs`

Resident Art. 17 self-erase. `HouseholdRef` is sourced exclusively from the verified session
(R2 — never from any request parameter). An admin session gets `Refused`; the board endpoint
handles admin-initiated deletions.

```csharp
public sealed class EraseMyContact(ISession session, IDirectoryStore store)
{
    public async Task<EraseContactResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true, HouseholdRef: not null })
            return new EraseContactResult.Refused();
        try
        {
            return await store.DeleteContactAsync(ctx.HouseholdRef.Value, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new EraseContactResult.Failed(); }
    }
}
```

### `src/Harmonia.Application/Directory/EraseContact.cs`

Board DSAR hard-delete. Requires `IsAdmin`. `householdRef` comes from the URL path parameter
(passed by the endpoint) — not from the request body or query string.

```csharp
public sealed class EraseContact(ISession session, IDirectoryStore store)
{
    public async Task<EraseContactResult> ExecuteAsync(
        string householdRef, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new EraseContactResult.Refused();
        try
        {
            return await store.DeleteContactAsync(new HouseholdRef(householdRef), ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new EraseContactResult.Failed(); }
    }
}
```

---

## SQL Adapter

**New method on `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`:**

```csharp
public async Task<EraseContactResult> DeleteContactAsync(
    HouseholdRef householdRef, CancellationToken ct = default)
{
    try
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "DELETE FROM dbo.HouseholdContacts WHERE HouseholdRef = @HouseholdRef;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return rows == 0
            ? new EraseContactResult.NotFound()
            : new EraseContactResult.Ok();
    }
    catch (OperationCanceledException) { throw; }
    catch (Exception) { return new EraseContactResult.Failed(); }
}
```

`rows == 0` → `NotFound`; `rows == 1` → `Ok`; SQL exception → `Failed`.
No `MERGE`, no `COALESCE` — single-row `DELETE` only.

---

## API Endpoints

**New methods on `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`:**

```csharp
public static async Task<IResult> EraseMyContactEndpoint(
    EraseMyContact useCase, ILogger logger, CancellationToken ct)
{
    var result = await useCase.ExecuteAsync(ct);
    return result switch
    {
        EraseContactResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
        EraseContactResult.Ok       => TypedResults.NoContent(),
        EraseContactResult.NotFound => TypedResults.NoContent(),   // 204 — idempotent Art. 17
        EraseContactResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
        _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
    };
}

public static async Task<IResult> EraseContactEndpoint(
    EraseContact useCase, string householdRef, ILogger logger, CancellationToken ct)
{
    var result = await useCase.ExecuteAsync(householdRef, ct);
    return result switch
    {
        EraseContactResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
        EraseContactResult.Ok       => TypedResults.NoContent(),
        EraseContactResult.NotFound => TypedResults.NotFound(),    // 404 — board DSAR confirmation
        EraseContactResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
        _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
    };
}
```

R3: `householdRef` never passed to `logger` in either method.

**HTTP status summary:**

| Result | `DELETE /directory/contact` (resident) | `DELETE /directory/{householdRef}/contact` (board) |
|---|---|---|
| `Ok` | 204 No Content | 204 No Content |
| `NotFound` | 204 No Content (idempotent) | 404 Not Found |
| `Refused` | 403 Forbidden | 403 Forbidden |
| `Failed` | 500 | 500 |

---

## Program.cs Wiring

```csharp
// DI — alongside existing directory use cases
builder.Services.AddScoped<EraseMyContact>();
builder.Services.AddScoped<EraseContact>();

// Routes — alongside existing directory MapPut calls
app.MapDelete("/directory/contact",
    (EraseMyContact uc, ILogger<DirectoryEndpoints> log, CancellationToken ct) =>
        DirectoryEndpoints.EraseMyContactEndpoint(uc, log, ct))
   .RequireAuthorization();

app.MapDelete("/directory/{householdRef}/contact",
    (EraseContact uc, string householdRef, ILogger<DirectoryEndpoints> log, CancellationToken ct) =>
        DirectoryEndpoints.EraseContactEndpoint(uc, householdRef, log, ct))
   .RequireAuthorization();
```

---

## Fakes (`tests/Harmonia.UnitTests/Fakes.cs`)

**`FakeDirectoryStore.DeleteContactAsync`:**

```csharp
public Task<EraseContactResult> DeleteContactAsync(
    HouseholdRef householdRef, CancellationToken ct = default)
{
    var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef);
    if (idx < 0) return Task.FromResult<EraseContactResult>(new EraseContactResult.NotFound());
    _contacts.RemoveAt(idx);
    return Task.FromResult<EraseContactResult>(new EraseContactResult.Ok());
}
```

**`FailingDirectoryStore.DeleteContactAsync`:**

```csharp
public Task<EraseContactResult> DeleteContactAsync(
    HouseholdRef householdRef, CancellationToken ct = default)
    => Task.FromResult<EraseContactResult>(new EraseContactResult.Failed());
```

---

## Testing

### Unit tests — use cases

**`tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs`**

| Test | Setup | Expected result |
|---|---|---|
| `Null_session_returns_Refused` | `FakeSession(null)` | `EraseContactResult.Refused` |
| `Admin_session_returns_Refused` | `FakeSession(AdminCtx)` | `EraseContactResult.Refused` |
| `Resident_with_no_householdRef_returns_Refused` | `FakeSession(IsResident:true, HouseholdRef:null)` | `EraseContactResult.Refused` |
| `Resident_deletes_own_contact_returns_Ok` | seed store with resident ref | `EraseContactResult.Ok` |
| `Resident_no_record_returns_NotFound` | empty store | `EraseContactResult.NotFound` |
| `Store_failure_returns_Failed` | `FailingDirectoryStore` | `EraseContactResult.Failed` |
| `HouseholdRef_comes_from_session` | seed two contacts; resident is `HH-1` | deleted ref is `HH-1` (assert `store.Contacts` has only the other ref) |

**`tests/Harmonia.UnitTests/Application/EraseContactTests.cs`**

| Test | Setup | Expected result |
|---|---|---|
| `Null_session_returns_Refused` | `FakeSession(null)` | `EraseContactResult.Refused` |
| `Resident_session_returns_Refused` | `FakeSession(ResidentCtx)` | `EraseContactResult.Refused` |
| `Admin_deletes_contact_returns_Ok` | seed store with target ref | `EraseContactResult.Ok` |
| `Admin_target_not_found_returns_NotFound` | empty store | `EraseContactResult.NotFound` |
| `Store_failure_returns_Failed` | `FailingDirectoryStore` | `EraseContactResult.Failed` |

### Unit tests — endpoints (append to `DirectoryEndpointsTests.cs`)

| Test | Assert |
|---|---|
| `EraseMyContact_ok_returns_204` | `StatusCode == 204` |
| `EraseMyContact_not_found_returns_204` | `StatusCode == 204` |
| `EraseMyContact_refused_returns_403` | `StatusCode == 403` |
| `EraseMyContact_store_failure_returns_500` | `StatusCode == 500` |
| `EraseContact_ok_returns_204` | `StatusCode == 204` |
| `EraseContact_not_found_returns_404` | `StatusCode == 404` |
| `EraseContact_refused_returns_403` | `StatusCode == 403` |
| `EraseContact_store_failure_returns_500` | `StatusCode == 500` |

### Integration tests (append to `SqlDirectoryStoreTests.cs`)

All use `[Collection("Database")]`, `[Trait("Category","Rel")]`, Guid-isolated refs.

| Test | What it proves |
|---|---|
| `DeleteContact_existing_row_returns_Ok_and_row_is_gone` | Happy path; `ListAllAsync` confirms deletion |
| `DeleteContact_nonexistent_row_returns_NotFound` | Zero-rows-affected branch |
| `DeleteContact_does_not_affect_other_rows` | Only the targeted row is removed |

### R3 log-exclusion tests (`tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs`)

Uses `CapturingLogger` (same pattern as `LogExclusionTests.cs`).

| Test | What it proves |
|---|---|
| `EraseMyContact_endpoint_never_logs_householdRef` | Sentinel `HouseholdRef` absent from all log lines across all four `EraseContactResult` variants |
| `EraseContact_endpoint_never_logs_householdRef` | Sentinel `householdRef` URL parameter absent from all log lines across all four variants |

---

## Constraints

- **R2:** `EraseMyContact.ExecuteAsync` accepts no `householdRef` parameter. The value comes exclusively from `session.Resolve().HouseholdRef.Value`.
- **R3:** `householdRef`, `DisplayName`, `Phone`, `Email`, `Notes` must not appear in any `ILogger` call in the endpoint or use-case layer.
- **No schema migration in this slice.** `DepartedAt` and `PurgeExpiredContacts` are Slice 2.
- **No soft-delete.** Hard `DELETE` only. No `DeletedAt` column, no tombstone record.
- **XML doc comments required** on all new public types (`EraseContactResult` variants, use-case classes, endpoint methods) — enforced by code-quality standard.

---

## Out of Scope (this slice)

- `DepartedAt` column / schema migration
- `PurgeExpiredContacts` use case and retention sweep
- `dbo.PushSubscriptions` erasure (separate ADR decision required)
- `dbo.NotificationHistory` erasure
- Art. 17(3)(b) legal-basis documentation for financial ledger retention
