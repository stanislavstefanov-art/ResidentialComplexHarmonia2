# GDPR Directory Opt-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GDPR Art. 6(1)(f) opt-out (`IsOptedOut`) to the member directory so opted-out households are hidden from the resident view but visible to the board, with self-service for residents and board override.

**Architecture:** New `bool IsOptedOut` field propagates from `HouseholdContact` domain record → `IDirectoryStore.UpsertContactAsync` port → use cases → API DTO and SQL adapter. The filter lives in the `GetDirectory` use case (not the store). `DirectoryEntryFullDto` exposes the flag so board members can see opt-out status.

**Tech Stack:** .NET 8 minimal-API, C# record types, raw ADO.NET, SQL Server MERGE with COALESCE, xUnit.

---

### Task 1: Add `IsOptedOut` to domain record and SQL schema

**Files:**
- Modify: `src/Harmonia.Domain/Directory/HouseholdContact.cs`
- Modify: `db/schema.sql`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs` (two `HouseholdContact` constructor call sites)
- Modify: `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs` (one constructor call site)

- [ ] **Step 1: Write a failing test**

Add to `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs`:

```csharp
[Fact]
public async Task OptedOut_household_is_hidden_in_ResidentView()
{
    var store = new FakeDirectoryStore();
    store.Contacts.Add(new HouseholdContact(
        new HouseholdRef("HH-OPT-1"), "Alice", null, null, null,
        IsOptedOut: true, DateTimeOffset.UtcNow));
    var useCase = new GetDirectory(new FakeSession(ResidentCtx), store);
    var result = Assert.IsType<GetDirectoryResult.ResidentView>(await useCase.ExecuteAsync());
    Assert.Empty(result.Entries);
}
```

- [ ] **Step 2: Run the test — verify compile failure**

```
dotnet build tests/Harmonia.UnitTests/
```
Expected: error CS1503 — `HouseholdContact` has no parameter `IsOptedOut`.

- [ ] **Step 3: Add `IsOptedOut` to `HouseholdContact`**

Replace `src/Harmonia.Domain/Directory/HouseholdContact.cs`:

```csharp
namespace Harmonia.Domain.Directory;

/// <summary>
/// Snapshot of one apartment's contact information stored in <c>dbo.HouseholdContacts</c>.
/// Phone and Email are personal data (R3) — never log their values; log counts or opaque refs only.
/// </summary>
public sealed record HouseholdContact(
    HouseholdRef   HouseholdRef,
    string?        DisplayName,
    string?        Phone,
    string?        Email,
    string?        Notes,
    bool           IsOptedOut,
    DateTimeOffset UpdatedAt);
```

- [ ] **Step 4: Add `IsOptedOut` column to SQL schema**

In `db/schema.sql`, inside the `CREATE TABLE dbo.HouseholdContacts` block, add the column before `UpdatedAt`:

```sql
IF OBJECT_ID(N'dbo.HouseholdContacts', N'U') IS NULL
CREATE TABLE dbo.HouseholdContacts
(
    HouseholdRef  nvarchar(128)     NOT NULL,
    DisplayName   nvarchar(256)     NULL,
    Phone         nvarchar(32)      NULL,
    Email         nvarchar(320)     NULL,
    Notes         nvarchar(2048)    NULL,
    IsOptedOut    bit               NOT NULL
        CONSTRAINT DF_HouseholdContacts_IsOptedOut DEFAULT 0,
    UpdatedAt     datetimeoffset(3) NOT NULL,
    CONSTRAINT PK_HouseholdContacts PRIMARY KEY (HouseholdRef)
);
```

- [ ] **Step 5: Fix `HouseholdContact` constructor call sites**

In `tests/Harmonia.UnitTests/Fakes.cs`, find two calls to `new HouseholdContact(...)` in `FakeDirectoryStore` and add `IsOptedOut: false`:

```csharp
// In UpsertContactAsync (line ~339):
_contacts.Add(new HouseholdContact(
    householdRef, displayName, phone, email, null, IsOptedOut: false, DateTimeOffset.UtcNow));

// In UpsertNotesAsync (line ~355):
_contacts.Add(new HouseholdContact(
    householdRef, null, null, null, notes, IsOptedOut: false, DateTimeOffset.UtcNow));
```

In `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`, fix the constructor in `GetDirectory_resident_view_omits_PII_fields`:

```csharp
store.Contacts.Add(new HouseholdContact(
    new HouseholdRef("HH-EP-PII"), "Alice", "555-9999", "alice@test.com", "secret",
    IsOptedOut: false, DateTimeOffset.UtcNow));
```

- [ ] **Step 6: Run all unit tests — verify all 195 pass + 1 new test fails**

```
dotnet test tests/Harmonia.UnitTests/ --verbosity minimal
```
Expected: 195 existing tests pass; `OptedOut_household_is_hidden_in_ResidentView` fails (filter not yet implemented).

- [ ] **Step 7: Commit**

```
git add src/Harmonia.Domain/Directory/HouseholdContact.cs db/schema.sql tests/Harmonia.UnitTests/Fakes.cs tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs
git commit -m "feat: add IsOptedOut to HouseholdContact domain record and SQL schema"
```

---

### Task 2: Update port, fakes, use cases, and SqlDirectoryStore signature

**Files:**
- Modify: `src/Harmonia.Application/Directory/Ports.cs`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs`
- Modify: `src/Harmonia.Application/Directory/UpdateMyContact.cs`
- Modify: `src/Harmonia.Application/Directory/UpdateContact.cs`
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` (signature only — SQL body updated in Task 5)
- Modify: `tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs`
- Modify: `tests/Harmonia.UnitTests/Application/UpdateContactTests.cs`

- [ ] **Step 1: Write two failing tests for opt-out forwarding**

Add to `tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs`:

```csharp
[Fact]
public async Task OptOut_flag_is_forwarded_to_store()
{
    var store = new FakeDirectoryStore();
    var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), store);
    await useCase.ExecuteAsync(null, null, null, isOptedOut: true);

    Assert.Single(store.Contacts);
    Assert.True(store.Contacts[0].IsOptedOut);
}
```

Add to `tests/Harmonia.UnitTests/Application/UpdateContactTests.cs`:

```csharp
[Fact]
public async Task OptOut_flag_is_forwarded_to_store()
{
    var store = new FakeDirectoryStore();
    var useCase = new UpdateContact(new FakeSession(AdminCtx), store);
    await useCase.ExecuteAsync("HH-OPT-FWD-1", null, null, null, isOptedOut: true);

    Assert.Single(store.Contacts);
    Assert.True(store.Contacts[0].IsOptedOut);
}
```

- [ ] **Step 2: Run tests — verify compile failure**

```
dotnet build tests/Harmonia.UnitTests/
```
Expected: error — `ExecuteAsync` does not have an `isOptedOut` parameter.

- [ ] **Step 3: Update `IDirectoryStore.UpsertContactAsync` signature**

In `src/Harmonia.Application/Directory/Ports.cs`:

```csharp
/// <summary>
/// Upserts display name, phone, email, and opt-out flag for <paramref name="householdRef"/>.
/// Passing <see langword="null"/> for any field preserves the existing stored value (COALESCE semantics).
/// R3: never log <paramref name="phone"/> or <paramref name="email"/> values.
/// </summary>
Task<UpdateContactResult> UpsertContactAsync(
    HouseholdRef householdRef,
    string?      displayName,
    string?      phone,
    string?      email,
    bool?        isOptedOut,
    CancellationToken ct = default);
```

- [ ] **Step 4: Update `FakeDirectoryStore.UpsertContactAsync`**

In `tests/Harmonia.UnitTests/Fakes.cs`:

```csharp
public Task<UpdateContactResult> UpsertContactAsync(
    HouseholdRef householdRef, string? displayName, string? phone, string? email,
    bool? isOptedOut, CancellationToken ct = default)
{
    var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef);
    if (idx >= 0)
    {
        var e = _contacts[idx];
        _contacts[idx] = e with
        {
            DisplayName = displayName ?? e.DisplayName,
            Phone       = phone       ?? e.Phone,
            Email       = email       ?? e.Email,
            IsOptedOut  = isOptedOut  ?? e.IsOptedOut,
            UpdatedAt   = DateTimeOffset.UtcNow
        };
    }
    else
    {
        _contacts.Add(new HouseholdContact(
            householdRef, displayName, phone, email, null,
            IsOptedOut: isOptedOut ?? false, DateTimeOffset.UtcNow));
    }
    return Task.FromResult<UpdateContactResult>(new UpdateContactResult.Ok());
}
```

- [ ] **Step 5: Update `FailingDirectoryStore.UpsertContactAsync`**

In `tests/Harmonia.UnitTests/Fakes.cs`:

```csharp
public Task<UpdateContactResult> UpsertContactAsync(
    HouseholdRef householdRef, string? displayName, string? phone, string? email,
    bool? isOptedOut, CancellationToken ct = default)
    => Task.FromResult<UpdateContactResult>(new UpdateContactResult.Failed());
```

- [ ] **Step 6: Update `UpdateMyContact.ExecuteAsync`**

Replace `src/Harmonia.Application/Directory/UpdateMyContact.cs`:

```csharp
namespace Harmonia.Application.Directory;

/// <summary>
/// Lets a resident update their own contact details.
/// R2: the target <see cref="HouseholdRef"/> is always taken from <see cref="ISession.Resolve()"/>
/// — never from any caller-supplied parameter.
/// </summary>
public sealed class UpdateMyContact(ISession session, IDirectoryStore store)
{
    public async Task<UpdateContactResult> ExecuteAsync(
        string? displayName, string? phone, string? email, bool? isOptedOut = null,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true, HouseholdRef: not null })
            return new UpdateContactResult.Refused();

        try
        {
            return await store.UpsertContactAsync(
                ctx.HouseholdRef.Value, displayName, phone, email, isOptedOut, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateContactResult.Failed();
        }
    }
}
```

- [ ] **Step 7: Update `UpdateContact.ExecuteAsync`**

Replace `src/Harmonia.Application/Directory/UpdateContact.cs`:

```csharp
using Harmonia.Domain;

namespace Harmonia.Application.Directory;

/// <summary>Board use case — updates contact details for any household by URL-path reference.</summary>
public sealed class UpdateContact(ISession session, IDirectoryStore store)
{
    public async Task<UpdateContactResult> ExecuteAsync(
        string householdRef, string? displayName, string? phone, string? email,
        bool? isOptedOut = null, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new UpdateContactResult.Refused();

        try
        {
            return await store.UpsertContactAsync(
                new HouseholdRef(householdRef), displayName, phone, email, isOptedOut, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateContactResult.Failed();
        }
    }
}
```

- [ ] **Step 8: Update `SqlDirectoryStore.UpsertContactAsync` signature**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, add `bool? isOptedOut` parameter to the method signature (SQL body unchanged — Task 5 handles it):

```csharp
public async Task<UpdateContactResult> UpsertContactAsync(
    HouseholdRef householdRef, string? displayName, string? phone, string? email,
    bool? isOptedOut, CancellationToken ct = default)
```

- [ ] **Step 9: Fix `UpdateContactTests` call sites**

In `tests/Harmonia.UnitTests/Application/UpdateContactTests.cs`, every call to `ExecuteAsync` currently passes 4 args (householdRef, displayName, phone, email). The `isOptedOut` parameter has a default of `null`, so these calls compile as-is — no changes needed.

Verify with: `dotnet build tests/Harmonia.UnitTests/`

- [ ] **Step 10: Fix `UpdateMyContactTests` call sites**

Same — `isOptedOut` defaults to `null`. Existing calls with 3 args still compile. No changes needed.

- [ ] **Step 11: Run all unit tests — verify passing**

```
dotnet test tests/Harmonia.UnitTests/ --verbosity minimal
```
Expected: 197 tests pass (195 existing + 2 new forwarding tests). `OptedOut_household_is_hidden_in_ResidentView` still fails (filter not yet in GetDirectory).

- [ ] **Step 12: Commit**

```
git add src/Harmonia.Application/Directory/Ports.cs src/Harmonia.Application/Directory/UpdateMyContact.cs src/Harmonia.Application/Directory/UpdateContact.cs src/Harmonia.Api/Adapters/SqlDirectoryStore.cs tests/Harmonia.UnitTests/Fakes.cs tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs tests/Harmonia.UnitTests/Application/UpdateContactTests.cs
git commit -m "feat: thread IsOptedOut through port, fakes, and use cases"
```

---

### Task 3: Implement opt-out filter in `GetDirectory`

**Files:**
- Modify: `src/Harmonia.Application/Directory/GetDirectory.cs`
- Modify: `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs` (add board visibility test)

- [ ] **Step 1: Add the board-visibility test (also failing)**

Add to `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs`:

```csharp
[Fact]
public async Task OptedOut_household_IS_visible_in_BoardView()
{
    var store = new FakeDirectoryStore();
    store.Contacts.Add(new HouseholdContact(
        new HouseholdRef("HH-OPT-2"), "Bob", null, null, null,
        IsOptedOut: true, DateTimeOffset.UtcNow));
    var useCase = new GetDirectory(new FakeSession(AdminCtx), store);
    var result = Assert.IsType<GetDirectoryResult.BoardView>(await useCase.ExecuteAsync());
    Assert.Single(result.Entries);
}
```

- [ ] **Step 2: Run failing tests — verify 2 fail**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~GetDirectoryTests" --verbosity minimal
```
Expected: `OptedOut_household_is_hidden_in_ResidentView` FAIL, `OptedOut_household_IS_visible_in_BoardView` PASS (board already gets unfiltered list — this test confirms current behaviour is correct for board).

- [ ] **Step 3: Implement the filter in `GetDirectory`**

Replace `src/Harmonia.Application/Directory/GetDirectory.cs`:

```csharp
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

/// <summary>
/// Returns the directory list with a role-differentiated projection.
/// Admin sessions receive the full <see cref="GetDirectoryResult.BoardView"/> (all households,
/// including opted-out ones). Resident sessions receive the name-only
/// <see cref="GetDirectoryResult.ResidentView"/> with opted-out households excluded (GDPR Art. 21).
/// </summary>
public sealed class GetDirectory(ISession session, IDirectoryStore store)
{
    public async Task<GetDirectoryResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is null) return new GetDirectoryResult.Refused();

        try
        {
            var entries = await store.ListAllAsync(ct);

            if (ctx.IsAdmin)
                return new GetDirectoryResult.BoardView(entries);

            if (ctx.IsResident)
            {
                var visible = entries.Where(e => !e.IsOptedOut).ToList();
                return new GetDirectoryResult.ResidentView(visible);
            }

            return new GetDirectoryResult.Refused();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new GetDirectoryResult.Failed();
        }
    }
}
```

- [ ] **Step 4: Run all unit tests — verify all pass**

```
dotnet test tests/Harmonia.UnitTests/ --verbosity minimal
```
Expected: 198 tests pass (all 195 + 2 forwarding + 1 opt-out hidden = 198). `OptedOut_household_IS_visible_in_BoardView` was already passing.

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Application/Directory/GetDirectory.cs tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs
git commit -m "feat: filter opted-out households from GetDirectory resident view (GDPR Art. 21)"
```

---

### Task 4: Update API layer — `DirectoryEntryFullDto`, `UpdateContactRequest`, endpoints

**Files:**
- Modify: `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`
- Modify: `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`

- [ ] **Step 1: Write failing tests for the DTO and request field**

Add to `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`:

```csharp
[Fact]
public async Task GetDirectory_board_view_includes_IsOptedOut_flag()
{
    var store = new FakeDirectoryStore();
    store.Contacts.Add(new HouseholdContact(
        new HouseholdRef("HH-OPT-DTO"), "Carol", null, null, null,
        IsOptedOut: true, DateTimeOffset.UtcNow));
    var uc = new GetDirectory(new FakeSession(AdminCtx), store);
    var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);

    var json = Assert.IsType<JsonHttpResult<List<DirectoryEntryFullDto>>>(result);
    Assert.NotNull(json.Value);
    Assert.Single(json.Value);
    Assert.True(json.Value[0].IsOptedOut);
}

[Fact]
public async Task UpdateMyContact_opt_out_is_forwarded()
{
    var store = new FakeDirectoryStore();
    var uc = new UpdateMyContact(new FakeSession(ResidentCtx), store);
    await DirectoryEndpoints.UpdateMyContactEndpoint(
        uc, new UpdateContactRequest(null, null, null, OptedOut: true), NullLogger.Instance, default);

    Assert.Single(store.Contacts);
    Assert.True(store.Contacts[0].IsOptedOut);
}
```

- [ ] **Step 2: Run — verify compile failure**

```
dotnet build tests/Harmonia.UnitTests/
```
Expected: `DirectoryEntryFullDto` has no `IsOptedOut`; `UpdateContactRequest` has no `OptedOut`.

- [ ] **Step 3: Update `DirectoryEntryFullDto` and `UpdateContactRequest`**

In `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`:

```csharp
/// <summary>Board-facing view — full contact details including phone, email, notes, and opt-out status.</summary>
public sealed record DirectoryEntryFullDto(
    string         HouseholdRef,
    string?        DisplayName,
    string?        Phone,
    string?        Email,
    string?        Notes,
    bool           IsOptedOut,
    DateTimeOffset UpdatedAt);

/// <summary>Request body for contact-detail updates (phone/email are PII — R3).</summary>
public sealed record UpdateContactRequest(
    string? DisplayName,
    string? Phone,
    string? Email,
    bool?   OptedOut = null);
```

- [ ] **Step 4: Update `ToFullDto` helper**

```csharp
private static DirectoryEntryFullDto ToFullDto(HouseholdContact c) =>
    new(c.HouseholdRef.Value, c.DisplayName, c.Phone, c.Email, c.Notes, c.IsOptedOut, c.UpdatedAt);
```

- [ ] **Step 5: Update `UpdateMyContactEndpoint` and `UpdateContactEndpoint` to pass `body.OptedOut`**

```csharp
public static async Task<IResult> UpdateMyContactEndpoint(
    UpdateMyContact useCase, UpdateContactRequest body, ILogger logger, CancellationToken ct)
{
    var result = await useCase.ExecuteAsync(body.DisplayName, body.Phone, body.Email, body.OptedOut, ct);
    return result switch
    {
        UpdateContactResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
        UpdateContactResult.Ok      => TypedResults.Ok(),
        UpdateContactResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
        _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
    };
}

public static async Task<IResult> UpdateContactEndpoint(
    UpdateContact useCase, string householdRef, UpdateContactRequest body,
    ILogger logger, CancellationToken ct)
{
    var result = await useCase.ExecuteAsync(
        householdRef, body.DisplayName, body.Phone, body.Email, body.OptedOut, ct);
    return result switch
    {
        UpdateContactResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
        UpdateContactResult.Ok      => TypedResults.Ok(),
        UpdateContactResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
        _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
    };
}
```

- [ ] **Step 6: Verify existing `UpdateContactRequest` call sites still compile**

`UpdateContactRequest` gains `bool? OptedOut = null` (default parameter). All existing calls with 3 positional args compile without change.

- [ ] **Step 7: Run all unit tests — verify all pass**

```
dotnet test tests/Harmonia.UnitTests/ --verbosity minimal
```
Expected: 200 tests pass (198 + 2 new).

- [ ] **Step 8: Commit**

```
git add src/Harmonia.Api/Directory/DirectoryEndpoints.cs tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs
git commit -m "feat: add IsOptedOut to DirectoryEntryFullDto and OptedOut to UpdateContactRequest"
```

---

### Task 5: Update `SqlDirectoryStore` — SELECT, `ReadRow`, MERGE

**Files:**
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`
- Modify: `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`

- [ ] **Step 1: Write failing integration test**

Add to `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`:

```csharp
[Fact]
public async Task UpsertContact_sets_IsOptedOut_and_ListAll_returns_it()
{
    var hh = new HouseholdRef($"HH-DIR-OPT-{Guid.NewGuid():N}");

    await Store.UpsertContactAsync(hh, "Dave", null, null, isOptedOut: true);

    var all = await Store.ListAllAsync();
    var entry = all.First(e => e.HouseholdRef == hh);
    Assert.True(entry.IsOptedOut);
}

[Fact]
public async Task UpsertContact_null_isOptedOut_preserves_existing_value()
{
    var hh = new HouseholdRef($"HH-DIR-OPT-PRES-{Guid.NewGuid():N}");
    await Store.UpsertContactAsync(hh, "Eve", null, null, isOptedOut: true);

    // null should preserve IsOptedOut = true
    await Store.UpsertContactAsync(hh, "Eve Updated", null, null, isOptedOut: null);

    var all = await Store.ListAllAsync();
    var entry = all.First(e => e.HouseholdRef == hh);
    Assert.True(entry.IsOptedOut);
}
```

- [ ] **Step 2: Run — BLOCKED (no test DB) or verify failure**

```
dotnet test tests/Harmonia.IntegrationTests/ --filter "FullyQualifiedName~SqlDirectoryStoreTests" --verbosity minimal
```
Expected: BLOCKED if `HARMONIA_SQL_CONNSTR` not set; otherwise FAIL (column missing from SELECT/MERGE).

- [ ] **Step 3: Update `ListAllAsync` SELECT and `ReadRow`**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`:

```csharp
public async Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync(ct);
    await using var cmd = conn.CreateCommand();
    cmd.CommandText =
        "SELECT HouseholdRef, DisplayName, Phone, Email, Notes, IsOptedOut, UpdatedAt " +
        "FROM dbo.HouseholdContacts " +
        "ORDER BY HouseholdRef ASC;";
    var results = new List<HouseholdContact>();
    await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
    while (await reader.ReadAsync(ct))
        results.Add(ReadRow(reader));
    return results;
}
```

Update `ReadRow`:

```csharp
private static HouseholdContact ReadRow(SqlDataReader r) =>
    new(HouseholdRef: new HouseholdRef(r.GetString(0)),
        DisplayName:  r.IsDBNull(1) ? null : r.GetString(1),
        Phone:        r.IsDBNull(2) ? null : r.GetString(2),
        Email:        r.IsDBNull(3) ? null : r.GetString(3),
        Notes:        r.IsDBNull(4) ? null : r.GetString(4),
        IsOptedOut:   r.GetBoolean(5),
        UpdatedAt:    r.GetDateTimeOffset(6));
```

- [ ] **Step 4: Update `UpsertContactAsync` MERGE**

```csharp
public async Task<UpdateContactResult> UpsertContactAsync(
    HouseholdRef householdRef, string? displayName, string? phone, string? email,
    bool? isOptedOut, CancellationToken ct = default)
{
    try
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            MERGE dbo.HouseholdContacts WITH (HOLDLOCK) AS target
            USING (VALUES (@HouseholdRef)) AS source (HouseholdRef)
            ON target.HouseholdRef = source.HouseholdRef
            WHEN MATCHED THEN
                UPDATE SET
                    DisplayName = COALESCE(@DisplayName, target.DisplayName),
                    Phone       = COALESCE(@Phone,       target.Phone),
                    Email       = COALESCE(@Email,       target.Email),
                    IsOptedOut  = COALESCE(@IsOptedOut,  target.IsOptedOut),
                    UpdatedAt   = SYSUTCDATETIMEOFFSET()
            WHEN NOT MATCHED THEN
                INSERT (HouseholdRef, DisplayName, Phone, Email, Notes, IsOptedOut, UpdatedAt)
                VALUES (@HouseholdRef, @DisplayName, @Phone, @Email, NULL, COALESCE(@IsOptedOut, 0), SYSUTCDATETIMEOFFSET());
            """;
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        cmd.Parameters.Add(new SqlParameter("@DisplayName", SqlDbType.NVarChar, 256)
            { Value = (object?)displayName ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar, 32)
            { Value = (object?)phone ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar, 320)
            { Value = (object?)email ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@IsOptedOut", SqlDbType.Bit)
            { Value = (object?)isOptedOut ?? DBNull.Value });
        await cmd.ExecuteNonQueryAsync(ct);
        return new UpdateContactResult.Ok();
    }
    catch (OperationCanceledException) { throw; }
    catch (Exception) { return new UpdateContactResult.Failed(); }
}
```

- [ ] **Step 5: Run unit tests — verify all 200 still pass**

```
dotnet test tests/Harmonia.UnitTests/ --verbosity minimal
```
Expected: 200 PASS (unit tests don't hit SQL, so ordinal shift doesn't affect them).

- [ ] **Step 6: Run integration tests (if DB available)**

```
dotnet test tests/Harmonia.IntegrationTests/ --filter "FullyQualifiedName~SqlDirectoryStoreTests" --verbosity minimal
```
Expected: 6 PASS (4 original + 2 new). BLOCKED if `HARMONIA_SQL_CONNSTR` not set.

- [ ] **Step 7: Commit**

```
git add src/Harmonia.Api/Adapters/SqlDirectoryStore.cs tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs
git commit -m "feat: update SqlDirectoryStore SELECT and MERGE to handle IsOptedOut (GDPR opt-out)"
```

---

## Self-Review

**Spec coverage check:**
- AC1 (opted-out hidden in ResidentView): ✅ Task 3 filter + GetDirectoryTests
- AC2 (opted-out visible in BoardView): ✅ Task 3 board test
- AC3 (resident can set OptedOut via PUT /directory/contact): ✅ Task 4 `UpdateMyContactEndpoint` passes `body.OptedOut`
- AC4 (board can set OptedOut via PUT /directory/{ref}/contact): ✅ Task 4 `UpdateContactEndpoint`
- AC5 (null OptedOut preserves existing): ✅ Task 2 FakeDirectoryStore + Task 5 SQL COALESCE integration test
- AC6 (schema includes column): ✅ Task 1 `schema.sql`
- AC7 (board DTO includes IsOptedOut): ✅ Task 4 `DirectoryEntryFullDto` + `GetDirectory_board_view_includes_IsOptedOut_flag`
- AC8 (195 existing tests pass): ✅ compile-fix in Task 1 ensures no regression

**Placeholder scan:** No TBD/TODO in any step.

**Type consistency:** `bool? isOptedOut` used throughout; `bool IsOptedOut` on the record; `bool? OptedOut` on the DTO (public API surface, nullable = omit-means-no-change).
