# GDPR Art. 17 Erasure Core — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add resident self-erase and board DSAR hard-delete for `dbo.HouseholdContacts`, with full unit, integration, and R3 log-exclusion test coverage.

**Architecture:** New `EraseContactResult` discriminated union and `IDirectoryStore.DeleteContactAsync` port method in `Ports.cs`. Two use cases (`EraseMyContact`, `EraseContact`) follow the established guard-clause → store-call → exception-wrapper pattern. `SqlDirectoryStore` implements a single-row `DELETE` that maps `rows affected = 0` to `NotFound`. Two `MapDelete` routes in `Program.cs` wire the two new `DirectoryEndpoints` methods.

**Tech Stack:** C# / .NET 8, ASP.NET Core Minimal API, Microsoft.Data.SqlClient (raw ADO.NET), SQL Server, xUnit, TypedResults.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/Harmonia.Application/Directory/Ports.cs` | Modify | Add `EraseContactResult` + `DeleteContactAsync` to `IDirectoryStore` |
| `tests/Harmonia.UnitTests/Fakes.cs` | Modify | Add `DeleteContactAsync` to `FakeDirectoryStore` and `FailingDirectoryStore` |
| `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` | Modify | Add `DeleteContactAsync` (stub in T1, real impl in T4) |
| `src/Harmonia.Application/Directory/EraseMyContact.cs` | Create | Resident self-erase use case |
| `src/Harmonia.Application/Directory/EraseContact.cs` | Create | Board DSAR hard-delete use case |
| `src/Harmonia.Api/Directory/DirectoryEndpoints.cs` | Modify | Add `EraseMyContactEndpoint` and `EraseContactEndpoint` |
| `src/Harmonia.Api/Program.cs` | Modify | `AddScoped` + two `MapDelete` routes |
| `tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs` | Create | 7 unit tests for `EraseMyContact` |
| `tests/Harmonia.UnitTests/Application/EraseContactTests.cs` | Create | 5 unit tests for `EraseContact` |
| `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs` | Modify | 8 endpoint unit tests |
| `tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs` | Create | R3 log-exclusion tests for erase endpoints |
| `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs` | Modify | 3 integration tests for `DeleteContactAsync` |

---

### Task 1: Port contract + fakes + SqlDirectoryStore stub

**Why first:** `IDirectoryStore` is a shared contract. All three implementations (`FakeDirectoryStore`, `FailingDirectoryStore`, `SqlDirectoryStore`) must implement every interface method or the build fails. This task makes the solution compile so Tasks 2–6 can write failing tests against real classes.

**Files:**
- Modify: `src/Harmonia.Application/Directory/Ports.cs`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs:311-377`
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`

- [ ] **Step 1: Add `EraseContactResult` and `DeleteContactAsync` to Ports.cs**

Open `src/Harmonia.Application/Directory/Ports.cs`. After the closing `}` of `UpdateNotesResult` (line 40) and before the `/// <summary>` of `IDirectoryStore` (line 42), insert the new result type. Then add the new method to the interface after `UpsertNotesAsync`.

The file after edits:

```csharp
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

/// <summary>Role-differentiated outcome of <see cref="GetDirectory"/>.</summary>
public abstract record GetDirectoryResult
{
    private GetDirectoryResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused                                               : GetDirectoryResult;
    /// <summary>Resident view — name and apartment only, no PII.</summary>
    public sealed record ResidentView(IReadOnlyList<HouseholdContact> Entries) : GetDirectoryResult;
    /// <summary>Board view — full contact details including phone, email, and notes.</summary>
    public sealed record BoardView(IReadOnlyList<HouseholdContact> Entries)    : GetDirectoryResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed                                                : GetDirectoryResult;
}

/// <summary>Outcome of updating a household's contact fields.</summary>
public abstract record UpdateContactResult
{
    private UpdateContactResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused : UpdateContactResult;
    public sealed record Ok      : UpdateContactResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed  : UpdateContactResult;
}

/// <summary>Outcome of updating a household's operational notes.</summary>
public abstract record UpdateNotesResult
{
    private UpdateNotesResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused : UpdateNotesResult;
    public sealed record Ok      : UpdateNotesResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed  : UpdateNotesResult;
}

/// <summary>Outcome of a contact-erasure request (GDPR Art. 17).</summary>
public abstract record EraseContactResult
{
    private EraseContactResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused  : EraseContactResult;
    /// <summary>Row deleted successfully.</summary>
    public sealed record Ok       : EraseContactResult;
    /// <summary>No row with that HouseholdRef exists.</summary>
    public sealed record NotFound : EraseContactResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed   : EraseContactResult;
}

/// <summary>
/// Directory store port — SQL adapter lives in <c>Harmonia.Api.Reservations.Adapters</c>.
/// R3: <paramref name="phone"/> and <paramref name="email"/> values must never appear in log output;
/// implementations must log only exception types and opaque identifiers.
/// </summary>
public interface IDirectoryStore
{
    Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default);

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

    /// <summary>
    /// Upserts the operational notes for <paramref name="householdRef"/>.
    /// Passing <see langword="null"/> clears existing notes.
    /// </summary>
    Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef,
        string?      notes,
        CancellationToken ct = default);

    /// <summary>
    /// Hard-deletes the contact record for <paramref name="householdRef"/> (GDPR Art. 17).
    /// Returns <see cref="EraseContactResult.NotFound"/> when no row exists.
    /// R3: never log <paramref name="householdRef"/> value.
    /// </summary>
    Task<EraseContactResult> DeleteContactAsync(
        HouseholdRef householdRef,
        CancellationToken ct = default);
}
```

- [ ] **Step 2: Add `DeleteContactAsync` implementations to `FakeDirectoryStore` and `FailingDirectoryStore` in Fakes.cs**

In `tests/Harmonia.UnitTests/Fakes.cs`, add `DeleteContactAsync` to `FakeDirectoryStore` after `UpsertNotesAsync` (after line 361), and add it to `FailingDirectoryStore` (after line 376).

Add to `FakeDirectoryStore` (between the closing `}` of `UpsertNotesAsync` and the closing `}` of the class at line 362):

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

Add to `FailingDirectoryStore` (after `UpsertNotesAsync`, before the closing `}` of the class at line 377):

```csharp
    public Task<EraseContactResult> DeleteContactAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => Task.FromResult<EraseContactResult>(new EraseContactResult.Failed());
```

- [ ] **Step 3: Add a `NotImplementedException` stub to `SqlDirectoryStore`**

Open `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`. After the closing `}` of `UpsertNotesAsync` (line 101) and before `ReadRow` (line 103), add the stub:

```csharp
    public Task<EraseContactResult> DeleteContactAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new NotImplementedException("Implemented in T4");
```

This stub will be replaced with the real implementation in Task 4.

- [ ] **Step 4: Verify the solution compiles**

Run:
```
dotnet build
```

Expected: Build succeeded, 0 errors. (There will be a runtime failure if `DeleteContactAsync` is called on `SqlDirectoryStore`, but the build must be clean.)

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Application/Directory/Ports.cs
git add tests/Harmonia.UnitTests/Fakes.cs
git add src/Harmonia.Api/Adapters/SqlDirectoryStore.cs
git commit -m "feat: add EraseContactResult and DeleteContactAsync port method (gdpr-erasure-art17 T1)"
```

---

### Task 2: `EraseMyContact` use case

**Test-first: yes — `Resident_deletes_own_contact_returns_Ok` fails until `EraseMyContact` class exists.**

**Files:**
- Create: `tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs`
- Create: `src/Harmonia.Application/Directory/EraseMyContact.cs`

- [ ] **Step 1: Write all failing tests for `EraseMyContact`**

Create `tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class EraseMyContactTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-ERASE-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new EraseMyContact(new FakeSession(null), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Admin_session_returns_Refused()
    {
        var uc = new EraseMyContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_with_no_householdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var uc = new EraseMyContact(new FakeSession(ctx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_deletes_own_contact_returns_Ok()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-ERASE-1"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow));
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), store);
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Ok>(result);
    }

    [Fact]
    public async Task Resident_no_record_returns_NotFound()
    {
        var store = new FakeDirectoryStore(); // empty
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), store);
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.NotFound>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<EraseContactResult.Failed>(result);
    }

    [Fact]
    public async Task HouseholdRef_comes_from_session_not_a_parameter()
    {
        // Seed two contacts; resident owns HH-ERASE-1, other household is HH-OTHER-99
        var store = new FakeDirectoryStore();
        var residentRef = new HouseholdRef("HH-ERASE-1");
        var otherRef    = new HouseholdRef("HH-OTHER-99");
        store.Contacts.Add(new HouseholdContact(
            residentRef, "Alice", null, null, null, IsOptedOut: false, DateTimeOffset.UtcNow));
        store.Contacts.Add(new HouseholdContact(
            otherRef, "Bob", null, null, null, IsOptedOut: false, DateTimeOffset.UtcNow));

        var uc = new EraseMyContact(new FakeSession(ResidentCtx), store);
        await uc.ExecuteAsync();

        // Only the resident's row was deleted — the other row is untouched
        Assert.Single(store.Contacts);
        Assert.Equal(otherRef, store.Contacts[0].HouseholdRef);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~EraseMyContactTests" -v normal
```

Expected: Build error — `EraseMyContact` type not found.

- [ ] **Step 3: Create `EraseMyContact.cs`**

Create `src/Harmonia.Application/Directory/EraseMyContact.cs`:

```csharp
using Harmonia.Application;

namespace Harmonia.Application.Directory;

/// <summary>
/// Resident Art. 17 self-erase. HouseholdRef is sourced exclusively from the verified session (R2).
/// </summary>
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

- [ ] **Step 4: Run tests to confirm they pass**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~EraseMyContactTests" -v normal
```

Expected: 7 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```
git add tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs
git add src/Harmonia.Application/Directory/EraseMyContact.cs
git commit -m "feat: add EraseMyContact use case with unit tests (gdpr-erasure-art17 T2)"
```

---

### Task 3: `EraseContact` use case

**Test-first: yes — `Admin_deletes_contact_returns_Ok` fails until `EraseContact` class exists.**

**Files:**
- Create: `tests/Harmonia.UnitTests/Application/EraseContactTests.cs`
- Create: `src/Harmonia.Application/Directory/EraseContact.cs`

- [ ] **Step 1: Write all failing tests for `EraseContact`**

Create `tests/Harmonia.UnitTests/Application/EraseContactTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class EraseContactTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-RES-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new EraseContact(new FakeSession(null), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var uc = new EraseContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Refused>(result);
    }

    [Fact]
    public async Task Admin_deletes_contact_returns_Ok()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Carol", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow));
        var uc = new EraseContact(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Ok>(result);
    }

    [Fact]
    public async Task Admin_target_not_found_returns_NotFound()
    {
        var store = new FakeDirectoryStore(); // empty
        var uc = new EraseContact(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.NotFound>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new EraseContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<EraseContactResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~EraseContactTests" -v normal
```

Expected: Build error — `EraseContact` type not found.

- [ ] **Step 3: Create `EraseContact.cs`**

Create `src/Harmonia.Application/Directory/EraseContact.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Domain;

namespace Harmonia.Application.Directory;

/// <summary>
/// Board DSAR hard-delete. Requires IsAdmin.
/// householdRef comes from the URL path parameter — never from the request body (R2).
/// </summary>
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

- [ ] **Step 4: Run tests to confirm they pass**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~EraseContactTests" -v normal
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```
git add tests/Harmonia.UnitTests/Application/EraseContactTests.cs
git add src/Harmonia.Application/Directory/EraseContact.cs
git commit -m "feat: add EraseContact use case with unit tests (gdpr-erasure-art17 T3)"
```

---

### Task 4: `SqlDirectoryStore.DeleteContactAsync` + integration tests

**Test-first: yes — integration tests fail at runtime (NotImplementedException from Task 1 stub) until real implementation replaces it.**

**Files:**
- Modify: `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`

- [ ] **Step 1: Write failing integration tests**

Append to `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs` (before the final closing `}`):

```csharp
    [Fact]
    public async Task DeleteContact_existing_row_returns_Ok_and_row_is_gone()
    {
        var hh = new HouseholdRef($"HH-DEL-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Dave", null, null, null);

        var result = await Store.DeleteContactAsync(hh);

        Assert.IsType<EraseContactResult.Ok>(result);
        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.HouseholdRef == hh);
    }

    [Fact]
    public async Task DeleteContact_nonexistent_row_returns_NotFound()
    {
        var hh = new HouseholdRef($"HH-DEL-NF-{Guid.NewGuid():N}");

        var result = await Store.DeleteContactAsync(hh);

        Assert.IsType<EraseContactResult.NotFound>(result);
    }

    [Fact]
    public async Task DeleteContact_does_not_affect_other_rows()
    {
        var target = new HouseholdRef($"HH-DEL-TGT-{Guid.NewGuid():N}");
        var other  = new HouseholdRef($"HH-DEL-OTH-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(target, "Eve",   null, null, null);
        await Store.UpsertContactAsync(other,  "Frank", null, null, null);

        await Store.DeleteContactAsync(target);

        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.HouseholdRef == target);
        Assert.Contains(all,       e => e.HouseholdRef == other);
    }
```

Also add the missing `using` if needed — check that `EraseContactResult` is imported. Add to the top of the file:

```csharp
using Harmonia.Application.Directory;
```

(It may already be present — check before adding.)

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel" -v normal
```

Expected: `DeleteContact_existing_row_returns_Ok_and_row_is_gone` fails with `NotImplementedException` ("Implemented in T4").

If `HARMONIA_SQL_CONNSTR` is not set, all integration tests are skipped — set it first:
```powershell
$env:HARMONIA_SQL_CONNSTR = "Server=127.0.0.1,1433;Database=HarmoniaTest;User Id=sa;Password=<dev-password>;TrustServerCertificate=True"
```

- [ ] **Step 3: Replace stub with real `DeleteContactAsync` in `SqlDirectoryStore`**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, replace the stub added in Task 1:

```csharp
// REMOVE this stub:
//   public Task<EraseContactResult> DeleteContactAsync(
//       HouseholdRef householdRef, CancellationToken ct = default)
//       => throw new NotImplementedException("Implemented in T4");
```

Replace with the real implementation (insert before `ReadRow`, after `UpsertNotesAsync`):

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

- [ ] **Step 4: Run integration tests to confirm they pass**

```
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel" -v normal
```

Expected: All integration tests pass (including the 3 new ones).

- [ ] **Step 5: Commit**

```
git add tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs
git add src/Harmonia.Api/Adapters/SqlDirectoryStore.cs
git commit -m "feat: implement SqlDirectoryStore.DeleteContactAsync with integration tests (gdpr-erasure-art17 T4)"
```

---

### Task 5: Endpoints + endpoint unit tests + Program.cs wiring

**Test-first: yes — endpoint tests fail until `EraseMyContactEndpoint` and `EraseContactEndpoint` methods exist on `DirectoryEndpoints`.**

**Files:**
- Modify: `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`
- Modify: `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`
- Modify: `src/Harmonia.Api/Program.cs`

- [ ] **Step 1: Write failing endpoint tests**

Append to `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs` (before the final closing `}`):

```csharp
    // ── DELETE /directory/contact (resident self-erase) ───────────────────────

    [Fact]
    public async Task EraseMyContact_ok_returns_204()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EP-1"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow));
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), store);
        var result = await DirectoryEndpoints.EraseMyContactEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status204NoContent,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task EraseMyContact_not_found_returns_204()
    {
        // Resident has no record — idempotent Art. 17: obligation already satisfied
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.EraseMyContactEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status204NoContent,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task EraseMyContact_refused_returns_403()
    {
        var uc = new EraseMyContact(new FakeSession(null), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.EraseMyContactEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task EraseMyContact_store_failure_returns_500()
    {
        var uc = new EraseMyContact(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.EraseMyContactEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── DELETE /directory/{householdRef}/contact (board DSAR) ────────────────

    [Fact]
    public async Task EraseContact_ok_returns_204()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Bob", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow));
        var uc = new EraseContact(new FakeSession(AdminCtx), store);
        var result = await DirectoryEndpoints.EraseContactEndpoint(
            uc, "HH-TARGET-1", NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status204NoContent,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task EraseContact_not_found_returns_404()
    {
        var uc = new EraseContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.EraseContactEndpoint(
            uc, "HH-TARGET-1", NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status404NotFound,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task EraseContact_refused_returns_403()
    {
        var uc = new EraseContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.EraseContactEndpoint(
            uc, "HH-TARGET-1", NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task EraseContact_store_failure_returns_500()
    {
        var uc = new EraseContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.EraseContactEndpoint(
            uc, "HH-TARGET-1", NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }
```

Add missing `using` statements at the top of `DirectoryEndpointsTests.cs` if not already present:

```csharp
using Harmonia.Application.Directory;
```

(`EraseMyContact` and `EraseContact` are in `Harmonia.Application.Directory`.)

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~DirectoryEndpointsTests" -v normal
```

Expected: Build error — `EraseMyContactEndpoint` and `EraseContactEndpoint` methods not found on `DirectoryEndpoints`.

- [ ] **Step 3: Add endpoint methods to `DirectoryEndpoints.cs`**

Open `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`. Add the two new methods before the private `ToFullDto` method (before line 98). The file needs `EraseMyContact` and `EraseContact` added to usings — they're in `Harmonia.Application.Directory` which is already imported.

Add after `UpdateNotesEndpoint` (after line 96, before `private static DirectoryEntryFullDto ToFullDto`):

```csharp
    /// <summary>
    /// DELETE /directory/contact — resident Art. 17 self-erase.
    /// HouseholdRef is resolved from session inside the use case (R2).
    /// R3: householdRef never logged here.
    /// </summary>
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

    /// <summary>
    /// DELETE /directory/{householdRef}/contact — board DSAR hard-delete.
    /// R3: householdRef never logged here.
    /// </summary>
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

- [ ] **Step 4: Run endpoint tests to confirm they pass**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~DirectoryEndpointsTests" -v normal
```

Expected: All endpoint tests pass (including the 8 new ones).

- [ ] **Step 5: Wire routes and DI in `Program.cs`**

Open `src/Harmonia.Api/Program.cs`.

**DI registrations** — add after `builder.Services.AddScoped<UpdateNotes>();` (after line 155):

```csharp
builder.Services.AddScoped<EraseMyContact>();
builder.Services.AddScoped<EraseContact>();
```

**Routes** — add after the `app.MapPut("/directory/{householdRef}/notes", ...)` block (after line 285, before `app.Run()`):

```csharp
app.MapDelete(
    "/directory/contact",
    (EraseMyContact uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseMyContactEndpoint(
            uc, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapDelete(
    "/directory/{householdRef}/contact",
    (EraseContact uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseContactEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();
```

- [ ] **Step 6: Build to confirm no wiring errors**

```
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 7: Run all unit tests**

```
dotnet test tests/Harmonia.UnitTests -v normal
```

Expected: All unit tests pass.

- [ ] **Step 8: Commit**

```
git add tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs
git add src/Harmonia.Api/Directory/DirectoryEndpoints.cs
git add src/Harmonia.Api/Program.cs
git commit -m "feat: add erase endpoints and Program.cs wiring with endpoint tests (gdpr-erasure-art17 T5)"
```

---

### Task 6: R3 log-exclusion tests for erase endpoints

**Test-first: yes — tests are written first; they pass if (and only if) no householdRef value appears in any log output from the endpoint methods.**

**Files:**
- Create: `tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs`

- [ ] **Step 1: Create `DirectoryLogExclusionTests.cs`**

`CapturingLogger` is already defined in `tests/Harmonia.UnitTests/Api/LogExclusionTests.cs` in the `Harmonia.UnitTests.Api` namespace. The new file is in the same namespace and can use it directly.

Create `tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Api.Directory;
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Api;

/// <summary>
/// R3 compliance: householdRef must never appear in any log line emitted by the
/// directory erase endpoints, regardless of result outcome.
/// </summary>
public class DirectoryLogExclusionTests
{
    private const string SecretResidentRef = "HH-R3-RESIDENT-SECRET";
    private const string SecretBoardRef    = "HH-R3-BOARD-SECRET";

    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef(SecretResidentRef));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    // ── EraseMyContact endpoint — resident self-erase ────────────────────────

    [Theory]
    [InlineData("ok")]        // Ok result
    [InlineData("not_found")] // NotFound result
    [InlineData("refused")]   // Refused result
    [InlineData("failed")]    // Failed result
    public async Task EraseMyContact_endpoint_never_logs_householdRef(string scenario)
    {
        var store = new FakeDirectoryStore();
        if (scenario == "ok")
        {
            store.Contacts.Add(new HouseholdContact(
                new HouseholdRef(SecretResidentRef), "Alice", null, null, null,
                IsOptedOut: false, DateTimeOffset.UtcNow));
        }

        var session = scenario == "refused"
            ? new FakeSession(null)
            : new FakeSession(ResidentCtx);
        var storeToUse = scenario == "failed"
            ? (IDirectoryStore)new FailingDirectoryStore()
            : store;

        var logger = new CapturingLogger();
        var uc = new EraseMyContact(session, storeToUse);

        await DirectoryEndpoints.EraseMyContactEndpoint(uc, logger, default);

        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretResidentRef, line));
    }

    // ── EraseContact endpoint — board DSAR ───────────────────────────────────

    [Theory]
    [InlineData("ok")]        // Ok result
    [InlineData("not_found")] // NotFound result
    [InlineData("refused")]   // Refused result
    [InlineData("failed")]    // Failed result
    public async Task EraseContact_endpoint_never_logs_householdRef(string scenario)
    {
        var store = new FakeDirectoryStore();
        if (scenario == "ok")
        {
            store.Contacts.Add(new HouseholdContact(
                new HouseholdRef(SecretBoardRef), "Bob", null, null, null,
                IsOptedOut: false, DateTimeOffset.UtcNow));
        }

        var session = scenario == "refused"
            ? new FakeSession(ResidentCtx)  // non-admin → Refused
            : new FakeSession(AdminCtx);
        var storeToUse = scenario == "failed"
            ? (IDirectoryStore)new FailingDirectoryStore()
            : store;

        var logger = new CapturingLogger();
        var uc = new EraseContact(session, storeToUse);

        await DirectoryEndpoints.EraseContactEndpoint(uc, SecretBoardRef, logger, default);

        // SecretBoardRef was passed as the householdRef URL parameter — it must NOT appear in logs
        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretBoardRef, line));
    }
}
```

- [ ] **Step 2: Run R3 log-exclusion tests**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~DirectoryLogExclusionTests" -v normal
```

Expected: 8 tests pass (4 per `[Theory]` × 2 test methods). If any test fails, it means a log line is leaking `householdRef` — fix the endpoint before committing.

- [ ] **Step 3: Run the full unit test suite**

```
dotnet test tests/Harmonia.UnitTests -v normal
```

Expected: All unit tests pass.

- [ ] **Step 4: Commit**

```
git add tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs
git commit -m "test: add R3 log-exclusion tests for directory erase endpoints (gdpr-erasure-art17 T6)"
```

---

## Final validation

- [ ] **Run all unit tests**

```
dotnet test tests/Harmonia.UnitTests -v normal
```

Expected: All tests pass.

- [ ] **Run integration tests (requires SQL Server)**

```
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel" -v normal
```

Expected: All integration tests pass, including the 3 new `DeleteContact_*` tests.

- [ ] **Run full test suite**

```
dotnet test -v normal
```

Expected: All tests pass. Integration tests are skipped if `HARMONIA_SQL_CONNSTR` is not set — set it to run the full suite.
