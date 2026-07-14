# Member Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role-differentiated member directory to the Harmonia API — residents see apartment names, board sees full PII + notes, residents self-update their own contact details, board manages notes and assists residents.

**Architecture:** New `dbo.HouseholdContacts` SQL table (HouseholdRef PK); `IDirectoryStore` Application-layer port backed by raw-ADO.NET `SqlDirectoryStore` adapter; four use cases (`GetDirectory`, `UpdateMyContact`, `UpdateContact`, `UpdateNotes`) registered as Scoped services; four minimal-API endpoints in `DirectoryEndpoints`; R2 (HouseholdRef from `ISession.Resolve()` only) and R3 (Phone/Email never logged) enforced at every call site.

**Tech Stack:** .NET 8 minimal-API, raw ADO.NET (`SqlConnection`/`SqlCommand`), SQL Server (MERGE with COALESCE), xUnit, `Microsoft.Data.SqlClient`.

---

## File Map

| Role | Path |
|------|------|
| Domain record | `src/Harmonia.Domain/Directory/HouseholdContact.cs` (CREATE) |
| Application port + result types | `src/Harmonia.Application/Directory/Ports.cs` (CREATE) |
| GetDirectory use case | `src/Harmonia.Application/Directory/GetDirectory.cs` (CREATE) |
| UpdateMyContact use case | `src/Harmonia.Application/Directory/UpdateMyContact.cs` (CREATE) |
| UpdateContact use case | `src/Harmonia.Application/Directory/UpdateContact.cs` (CREATE) |
| UpdateNotes use case | `src/Harmonia.Application/Directory/UpdateNotes.cs` (CREATE) |
| SQL adapter | `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` (CREATE) |
| Endpoints + DTOs | `src/Harmonia.Api/Directory/DirectoryEndpoints.cs` (CREATE) |
| SQL schema | `db/schema.sql` (MODIFY — add `dbo.HouseholdContacts`) |
| Fakes | `tests/Harmonia.UnitTests/Fakes.cs` (MODIFY — add FakeDirectoryStore, FailingDirectoryStore) |
| GetDirectory unit tests | `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs` (CREATE) |
| UpdateMyContact unit tests | `tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs` (CREATE) |
| UpdateContact unit tests | `tests/Harmonia.UnitTests/Application/UpdateContactTests.cs` (CREATE) |
| UpdateNotes unit tests | `tests/Harmonia.UnitTests/Application/UpdateNotesTests.cs` (CREATE) |
| DirectoryEndpoints unit tests | `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs` (CREATE) |
| SqlDirectoryStore integration tests | `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs` (CREATE) |
| Composition root | `src/Harmonia.Api/Program.cs` (MODIFY — add Directory connection string guard, services, endpoints) |
| App settings key | `src/Harmonia.Api/appsettings.json` (MODIFY — add empty `"Directory"` connection string) |

---

### Task 1: SQL schema + Domain record + Application port + Fakes

**Test-first: yes** — `FakeDirectoryStore_ListAllAsync_returns_empty_list` fails until `IDirectoryStore` and `FakeDirectoryStore` exist.

**Files:**
- Create: `src/Harmonia.Domain/Directory/HouseholdContact.cs`
- Create: `src/Harmonia.Application/Directory/Ports.cs`
- Modify: `db/schema.sql`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs`

R3 note: `Phone` and `Email` fields are defined here; any logging in this or downstream files must never reference these values.

- [ ] **Step 1: Write the failing test**

Add this class to `tests/Harmonia.UnitTests/Fakes.cs` temporarily as an `#if false` block just to make the intent clear — or better: write the test file first.

Create `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs` (the test that references `FakeDirectoryStore`):

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class GetDirectoryTests
{
    [Fact]
    public async Task FakeDirectoryStore_ListAllAsync_returns_empty_list()
    {
        var store = new FakeDirectoryStore();
        var all = await store.ListAllAsync();
        Assert.Empty(all);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~GetDirectoryTests.FakeDirectoryStore_ListAllAsync_returns_empty_list" --no-build 2>&1 | tail -20
```

Expected: compile error — `FakeDirectoryStore` does not exist, `IDirectoryStore` does not exist.

- [ ] **Step 3: Add dbo.HouseholdContacts to db/schema.sql**

Open `db/schema.sql` and append before the final `GO` (or after the last table block):

```sql
IF OBJECT_ID(N'dbo.HouseholdContacts', N'U') IS NULL
CREATE TABLE dbo.HouseholdContacts
(
    HouseholdRef  nvarchar(128)     NOT NULL,
    DisplayName   nvarchar(256)     NULL,
    Phone         nvarchar(32)      NULL,
    Email         nvarchar(320)     NULL,
    Notes         nvarchar(2048)    NULL,
    UpdatedAt     datetimeoffset(3) NOT NULL,
    CONSTRAINT PK_HouseholdContacts PRIMARY KEY (HouseholdRef)
);
GO
```

- [ ] **Step 4: Create the domain record**

Create `src/Harmonia.Domain/Directory/HouseholdContact.cs`:

```csharp
namespace Harmonia.Domain.Directory;

public sealed record HouseholdContact(
    HouseholdRef   HouseholdRef,
    string?        DisplayName,
    string?        Phone,
    string?        Email,
    string?        Notes,
    DateTimeOffset UpdatedAt);
```

- [ ] **Step 5: Create Ports.cs with IDirectoryStore and all result types**

Create `src/Harmonia.Application/Directory/Ports.cs`:

```csharp
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

public abstract record GetDirectoryResult
{
    private GetDirectoryResult() { }
    public sealed record Refused                                               : GetDirectoryResult;
    public sealed record ResidentView(IReadOnlyList<HouseholdContact> Entries) : GetDirectoryResult;
    public sealed record BoardView(IReadOnlyList<HouseholdContact> Entries)    : GetDirectoryResult;
    public sealed record Failed                                                : GetDirectoryResult;
}

public abstract record UpdateContactResult
{
    private UpdateContactResult() { }
    public sealed record Refused : UpdateContactResult;
    public sealed record Ok      : UpdateContactResult;
    public sealed record Failed  : UpdateContactResult;
}

public abstract record UpdateNotesResult
{
    private UpdateNotesResult() { }
    public sealed record Refused : UpdateNotesResult;
    public sealed record Ok      : UpdateNotesResult;
    public sealed record Failed  : UpdateNotesResult;
}

public interface IDirectoryStore
{
    Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default);

    Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef,
        string?      displayName,
        string?      phone,
        string?      email,
        CancellationToken ct = default);

    Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef,
        string?      notes,
        CancellationToken ct = default);
}
```

- [ ] **Step 6: Add FakeDirectoryStore and FailingDirectoryStore to Fakes.cs**

Open `tests/Harmonia.UnitTests/Fakes.cs` and append after the existing fake classes:

```csharp
// ── Directory fakes ──────────────────────────────────────────────────────────

public sealed class FakeDirectoryStore : IDirectoryStore
{
    private readonly List<HouseholdContact> _contacts = [];

    public List<HouseholdContact> Contacts => _contacts;

    public Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<HouseholdContact>>([.. _contacts]);

    public Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef, string? displayName, string? phone, string? email,
        CancellationToken ct = default)
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
                UpdatedAt   = DateTimeOffset.UtcNow
            };
        }
        else
        {
            _contacts.Add(new HouseholdContact(
                householdRef, displayName, phone, email, null, DateTimeOffset.UtcNow));
        }
        return Task.FromResult<UpdateContactResult>(new UpdateContactResult.Ok());
    }

    public Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef, string? notes, CancellationToken ct = default)
    {
        var idx = _contacts.FindIndex(c => c.HouseholdRef == householdRef);
        if (idx >= 0)
        {
            var e = _contacts[idx];
            _contacts[idx] = e with { Notes = notes, UpdatedAt = DateTimeOffset.UtcNow };
        }
        else
        {
            _contacts.Add(new HouseholdContact(
                householdRef, null, null, null, notes, DateTimeOffset.UtcNow));
        }
        return Task.FromResult<UpdateNotesResult>(new UpdateNotesResult.Ok());
    }
}

public sealed class FailingDirectoryStore : IDirectoryStore
{
    public Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef, string? displayName, string? phone, string? email,
        CancellationToken ct = default)
        => Task.FromResult<UpdateContactResult>(new UpdateContactResult.Failed());

    public Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef, string? notes, CancellationToken ct = default)
        => Task.FromResult<UpdateNotesResult>(new UpdateNotesResult.Failed());
}
```

You will also need to add these usings to the top of `Fakes.cs` if they are not already present:

```csharp
using Harmonia.Application.Directory;
using Harmonia.Domain.Directory;
```

- [ ] **Step 7: Run the test to confirm it passes**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~GetDirectoryTests.FakeDirectoryStore_ListAllAsync_returns_empty_list" 2>&1 | tail -20
```

Expected: 1 passed.

- [ ] **Step 8: Commit**

```
git add db/schema.sql src/Harmonia.Domain/Directory/HouseholdContact.cs src/Harmonia.Application/Directory/Ports.cs tests/Harmonia.UnitTests/Fakes.cs tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs
git commit -m "feat: add HouseholdContacts schema, domain record, IDirectoryStore port, and fakes"
```

---

### Task 2: GetDirectory use case

**Test-first: yes** — `Null_session_returns_Refused` fails until `GetDirectory` class exists.

**Files:**
- Create: `src/Harmonia.Application/Directory/GetDirectory.cs`
- Modify: `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs` (expand with real tests)

Security: `GetDirectory` wraps `store.ListAllAsync` in try/catch — `OperationCanceledException` is rethrown, all other exceptions return `Failed`. R3 is passive here (use case never logs Phone/Email).

- [ ] **Step 1: Replace GetDirectoryTests.cs with the full test suite**

Overwrite `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class GetDirectoryTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-GD-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new GetDirectory(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.Refused>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Resident_session_returns_ResidentView()
    {
        var useCase = new GetDirectory(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.ResidentView>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Admin_session_returns_BoardView()
    {
        var useCase = new GetDirectory(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.BoardView>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new GetDirectory(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        Assert.IsType<GetDirectoryResult.Failed>(await useCase.ExecuteAsync());
    }

    [Fact]
    public async Task Admin_with_HouseholdRef_still_returns_BoardView()
    {
        // IsAdmin and IsResident are mutually exclusive; IsAdmin checked first.
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: new HouseholdRef("HH-ADM-1"));
        var useCase = new GetDirectory(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<GetDirectoryResult.BoardView>(await useCase.ExecuteAsync());
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~GetDirectoryTests" 2>&1 | tail -20
```

Expected: compile errors — `GetDirectory` does not exist.

- [ ] **Step 3: Create GetDirectory.cs**

Create `src/Harmonia.Application/Directory/GetDirectory.cs`:

```csharp
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

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
                return new GetDirectoryResult.ResidentView(entries);

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

Note: `ISession` lives in `Harmonia.Application` namespace (same assembly) — no additional using needed.

- [ ] **Step 4: Run tests to confirm they pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~GetDirectoryTests" 2>&1 | tail -20
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Application/Directory/GetDirectory.cs tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs
git commit -m "feat: add GetDirectory use case with role-based view routing"
```

---

### Task 3: UpdateMyContact use case

**Test-first: yes** — `Resident_with_HouseholdRef_returns_Ok` fails until `UpdateMyContact` exists.

**Files:**
- Create: `src/Harmonia.Application/Directory/UpdateMyContact.cs`
- Create: `tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs`

R2: `HouseholdRef` comes exclusively from `session.Resolve().HouseholdRef`; the `displayName`, `phone`, `email` parameters are content — never the identity source.
R3: `phone` and `email` parameters are accepted but must never be passed to any `ILogger` call.

- [ ] **Step 1: Write the failing test**

Create `tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class UpdateMyContactTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-MC-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Resident_with_HouseholdRef_returns_Ok()
    {
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await useCase.ExecuteAsync("Alice", "555-0100", "alice@example.com");
        Assert.IsType<UpdateContactResult.Ok>(result);
    }

    [Fact]
    public async Task Admin_session_returns_Refused()
    {
        var useCase = new UpdateMyContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(await useCase.ExecuteAsync("Admin", null, null));
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new UpdateMyContact(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(await useCase.ExecuteAsync(null, null, null));
    }

    [Fact]
    public async Task Resident_without_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var useCase = new UpdateMyContact(new FakeSession(ctx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(await useCase.ExecuteAsync("Alice", null, null));
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        Assert.IsType<UpdateContactResult.Failed>(await useCase.ExecuteAsync("Alice", null, null));
    }

    [Fact]
    public async Task HouseholdRef_comes_from_session_not_parameters()
    {
        // R2: the household written to the store must match the session, not any caller input.
        var store = new FakeDirectoryStore();
        var useCase = new UpdateMyContact(new FakeSession(ResidentCtx), store);
        await useCase.ExecuteAsync("Alice", "555-0100", null);

        Assert.Single(store.Contacts);
        Assert.Equal(new HouseholdRef("HH-MC-1"), store.Contacts[0].HouseholdRef);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~UpdateMyContactTests" 2>&1 | tail -20
```

Expected: compile error — `UpdateMyContact` does not exist.

- [ ] **Step 3: Create UpdateMyContact.cs**

Create `src/Harmonia.Application/Directory/UpdateMyContact.cs`:

```csharp
namespace Harmonia.Application.Directory;

public sealed class UpdateMyContact(ISession session, IDirectoryStore store)
{
    public async Task<UpdateContactResult> ExecuteAsync(
        string? displayName, string? phone, string? email,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true, HouseholdRef: not null })
            return new UpdateContactResult.Refused();

        return await store.UpsertContactAsync(ctx.HouseholdRef, displayName, phone, email, ct);
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~UpdateMyContactTests" 2>&1 | tail -20
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Application/Directory/UpdateMyContact.cs tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs
git commit -m "feat: add UpdateMyContact use case (R2 - HouseholdRef from session)"
```

---

### Task 4: UpdateContact use case (board)

**Test-first: yes** — `Admin_session_returns_Ok` fails until `UpdateContact` exists.

**Files:**
- Create: `src/Harmonia.Application/Directory/UpdateContact.cs`
- Create: `tests/Harmonia.UnitTests/Application/UpdateContactTests.cs`

R2 note: for board operations, the `householdRef` comes from the URL path (the board acts on behalf of any household), not from the admin's own session. This is correct: R2 restricts *residents* from spoofing their identity; board members legitimately target other households.

- [ ] **Step 1: Write the failing test**

Create `tests/Harmonia.UnitTests/Application/UpdateContactTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class UpdateContactTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-UC-1"));

    [Fact]
    public async Task Admin_session_returns_Ok()
    {
        var useCase = new UpdateContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Ok>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Bob", "555-0200", null));
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var useCase = new UpdateContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("HH-OTHER-1", "Bob", null, null));
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new UpdateContact(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<UpdateContactResult.Refused>(
            await useCase.ExecuteAsync("HH-TARGET-1", null, null, null));
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new UpdateContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        Assert.IsType<UpdateContactResult.Failed>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Bob", null, null));
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~UpdateContactTests" 2>&1 | tail -20
```

Expected: compile error — `UpdateContact` does not exist.

- [ ] **Step 3: Create UpdateContact.cs**

Create `src/Harmonia.Application/Directory/UpdateContact.cs`:

```csharp
using Harmonia.Domain;

namespace Harmonia.Application.Directory;

public sealed class UpdateContact(ISession session, IDirectoryStore store)
{
    public async Task<UpdateContactResult> ExecuteAsync(
        string householdRef, string? displayName, string? phone, string? email,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new UpdateContactResult.Refused();

        return await store.UpsertContactAsync(
            new HouseholdRef(householdRef), displayName, phone, email, ct);
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~UpdateContactTests" 2>&1 | tail -20
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Application/Directory/UpdateContact.cs tests/Harmonia.UnitTests/Application/UpdateContactTests.cs
git commit -m "feat: add UpdateContact use case (board manages any household contact)"
```

---

### Task 5: UpdateNotes use case (board)

**Test-first: yes** — `Admin_session_returns_Ok` fails until `UpdateNotes` exists.

**Files:**
- Create: `src/Harmonia.Application/Directory/UpdateNotes.cs`
- Create: `tests/Harmonia.UnitTests/Application/UpdateNotesTests.cs`

- [ ] **Step 1: Write the failing test**

Create `tests/Harmonia.UnitTests/Application/UpdateNotesTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class UpdateNotesTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-UN-1"));

    [Fact]
    public async Task Admin_session_returns_Ok()
    {
        var useCase = new UpdateNotes(new FakeSession(AdminCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateNotesResult.Ok>(
            await useCase.ExecuteAsync("HH-TARGET-1", "Parking spot A12"));
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var useCase = new UpdateNotes(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        Assert.IsType<UpdateNotesResult.Refused>(
            await useCase.ExecuteAsync("HH-OTHER-1", "some note"));
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new UpdateNotes(new FakeSession(null), new FakeDirectoryStore());
        Assert.IsType<UpdateNotesResult.Refused>(
            await useCase.ExecuteAsync("HH-TARGET-1", "note"));
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new UpdateNotes(new FakeSession(AdminCtx), new FailingDirectoryStore());
        Assert.IsType<UpdateNotesResult.Failed>(
            await useCase.ExecuteAsync("HH-TARGET-1", "note"));
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~UpdateNotesTests" 2>&1 | tail -20
```

Expected: compile error — `UpdateNotes` does not exist.

- [ ] **Step 3: Create UpdateNotes.cs**

Create `src/Harmonia.Application/Directory/UpdateNotes.cs`:

```csharp
using Harmonia.Domain;

namespace Harmonia.Application.Directory;

public sealed class UpdateNotes(ISession session, IDirectoryStore store)
{
    public async Task<UpdateNotesResult> ExecuteAsync(
        string householdRef, string? notes,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new UpdateNotesResult.Refused();

        return await store.UpsertNotesAsync(new HouseholdRef(householdRef), notes, ct);
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~UpdateNotesTests" 2>&1 | tail -20
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Application/Directory/UpdateNotes.cs tests/Harmonia.UnitTests/Application/UpdateNotesTests.cs
git commit -m "feat: add UpdateNotes use case (board manages apartment operational notes)"
```

---

### Task 6: SqlDirectoryStore adapter + integration tests

**Test-first: yes** — `UpsertContact_insert_creates_row_readable_by_ListAll` fails until `SqlDirectoryStore` exists (compile error) and the SQL schema exists in the test DB.

**Files:**
- Create: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`
- Create: `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`

Namespace: `Harmonia.Api.Reservations.Adapters` (matches all existing store adapters).
R3: `phone` and `email` parameter values are **never** passed to any `ILogger` call. Error logging is exception-type only.
Pattern: `OperationCanceledException` rethrown before `catch (Exception)`. Typed `SqlParameter` with `SqlDbType` for all nullable strings.
Prerequisites: `HARMONIA_SQL_CONNSTR` env var must point to a SQL Server where `db/schema.sql` has been applied.

- [ ] **Step 1: Write the failing integration tests**

Create `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`:

```csharp
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlDirectoryStoreTests(SqlServerFixture fixture)
{
    private SqlDirectoryStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task UpsertContact_insert_creates_row_readable_by_ListAll()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");

        var result = await Store.UpsertContactAsync(hh, "Alice Smith", "555-0100", "alice@example.com");
        Assert.IsType<UpdateContactResult.Ok>(result);

        var all = await Store.ListAllAsync();
        var entry = all.FirstOrDefault(e => e.HouseholdRef == hh);
        Assert.NotNull(entry);
        Assert.Equal("Alice Smith", entry.DisplayName);
        Assert.Equal("555-0100", entry.Phone);
        Assert.Equal("alice@example.com", entry.Email);
        Assert.Null(entry.Notes);
    }

    [Fact]
    public async Task UpsertContact_partial_update_preserves_existing_phone()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Bob", "555-0200", null);

        await Store.UpsertContactAsync(hh, "Robert", null, null);

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.Equal("Robert", entry.DisplayName);
        Assert.Equal("555-0200", entry.Phone);
    }

    [Fact]
    public async Task UpsertNotes_insert_then_update_replaces_notes()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");
        await Store.UpsertNotesAsync(hh, "Parking spot A12");
        await Store.UpsertNotesAsync(hh, "Parking spot B7");

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.Equal("Parking spot B7", entry.Notes);
    }

    [Fact]
    public async Task ListAll_returns_rows_ordered_by_household_ref()
    {
        var prefix = $"HH-DIR-ORD-{Guid.NewGuid():N}";
        var a = new HouseholdRef($"{prefix}-A");
        var b = new HouseholdRef($"{prefix}-B");
        await Store.UpsertContactAsync(b, "Zara", null, null);
        await Store.UpsertContactAsync(a, "Alice", null, null);

        var all = await Store.ListAllAsync();
        var relevant = all.Where(e =>
            e.HouseholdRef == a || e.HouseholdRef == b).ToList();

        Assert.Equal(2, relevant.Count);
        Assert.True(string.Compare(
            relevant[0].HouseholdRef.Value,
            relevant[1].HouseholdRef.Value,
            StringComparison.Ordinal) < 0);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.IntegrationTests/ --filter "FullyQualifiedName~SqlDirectoryStoreTests" 2>&1 | tail -20
```

Expected: compile error — `SqlDirectoryStore` does not exist in `Harmonia.Api.Reservations.Adapters`.

- [ ] **Step 3: Create SqlDirectoryStore.cs**

Create `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`:

```csharp
using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Api.Reservations.Adapters;

public sealed class SqlDirectoryStore(string connectionString) : IDirectoryStore
{
    public async Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt " +
            "FROM dbo.HouseholdContacts " +
            "ORDER BY HouseholdRef ASC;";

        var results = new List<HouseholdContact>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    public async Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef, string? displayName, string? phone, string? email,
        CancellationToken ct = default)
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
                        UpdatedAt   = SYSUTCDATETIMEOFFSET()
                WHEN NOT MATCHED THEN
                    INSERT (HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt)
                    VALUES (@HouseholdRef, @DisplayName, @Phone, @Email, NULL, SYSUTCDATETIMEOFFSET());
                """;
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@DisplayName", SqlDbType.NVarChar, 256)
                { Value = (object?)displayName ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar, 32)
                { Value = (object?)phone ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar, 320)
                { Value = (object?)email ?? DBNull.Value });
            await cmd.ExecuteNonQueryAsync(ct);
            return new UpdateContactResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateContactResult.Failed();
        }
    }

    public async Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef, string? notes,
        CancellationToken ct = default)
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
                    UPDATE SET Notes = @Notes, UpdatedAt = SYSUTCDATETIMEOFFSET()
                WHEN NOT MATCHED THEN
                    INSERT (HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt)
                    VALUES (@HouseholdRef, NULL, NULL, NULL, @Notes, SYSUTCDATETIMEOFFSET());
                """;
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@Notes", SqlDbType.NVarChar, 2048)
                { Value = (object?)notes ?? DBNull.Value });
            await cmd.ExecuteNonQueryAsync(ct);
            return new UpdateNotesResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateNotesResult.Failed();
        }
    }

    private static HouseholdContact ReadRow(SqlDataReader r) =>
        new(HouseholdRef:  new HouseholdRef(r.GetString(0)),
            DisplayName:   r.IsDBNull(1) ? null : r.GetString(1),
            Phone:         r.IsDBNull(2) ? null : r.GetString(2),
            Email:         r.IsDBNull(3) ? null : r.GetString(3),
            Notes:         r.IsDBNull(4) ? null : r.GetString(4),
            UpdatedAt:     r.GetDateTimeOffset(5));
}
```

- [ ] **Step 4: Run integration tests**

Ensure `HARMONIA_SQL_CONNSTR` is set and `db/schema.sql` has been applied to the target DB before running:

```
dotnet test tests/Harmonia.IntegrationTests/ --filter "FullyQualifiedName~SqlDirectoryStoreTests" 2>&1 | tail -30
```

Expected: 4 passed.

- [ ] **Step 5: Run full unit test suite to confirm no regressions**

```
dotnet test tests/Harmonia.UnitTests/ 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 6: Commit**

```
git add src/Harmonia.Api/Adapters/SqlDirectoryStore.cs tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs
git commit -m "feat: add SqlDirectoryStore adapter with MERGE upsert and integration tests"
```

---

### Task 7: DirectoryEndpoints + unit tests

**Test-first: yes** — `GetDirectory_refused_returns_403` fails until `DirectoryEndpoints` exists (compile error).

**Files:**
- Create: `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`
- Create: `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`

Endpoint handlers are static methods that accept use-case + `ILogger` + `CancellationToken`. TypedResults switch form throughout — no `Results.*`.
DTOs: `DirectoryEntryPublicDto` (no PII) and `DirectoryEntryFullDto` (all fields) are defined in `DirectoryEndpoints.cs` — the endpoint file owns its own DTOs and request record types.

- [ ] **Step 1: Write the failing tests**

Create `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Directory;
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Api;

public class DirectoryEndpointsTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-EP-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    // ── GET /directory ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetDirectory_resident_returns_200()
    {
        var uc = new GetDirectory(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetDirectory_board_returns_200()
    {
        var uc = new GetDirectory(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetDirectory_refused_returns_403()
    {
        var uc = new GetDirectory(new FakeSession(null), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetDirectory_store_failure_returns_500()
    {
        var uc = new GetDirectory(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── PUT /directory/contact ─────────────────────────────────────────────

    [Fact]
    public async Task UpdateMyContact_ok_returns_200()
    {
        var uc = new UpdateMyContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateMyContactEndpoint(
            uc, new UpdateContactRequest("Alice", null, null), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateMyContact_refused_returns_403()
    {
        var uc = new UpdateMyContact(new FakeSession(null), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateMyContactEndpoint(
            uc, new UpdateContactRequest(null, null, null), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateMyContact_store_failure_returns_500()
    {
        var uc = new UpdateMyContact(new FakeSession(ResidentCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.UpdateMyContactEndpoint(
            uc, new UpdateContactRequest("Alice", null, null), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── PUT /directory/{householdRef}/contact ──────────────────────────────

    [Fact]
    public async Task UpdateContact_ok_returns_200()
    {
        var uc = new UpdateContact(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateContactEndpoint(
            uc, "HH-TARGET-1", new UpdateContactRequest("Bob", null, null),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateContact_refused_returns_403()
    {
        var uc = new UpdateContact(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateContactEndpoint(
            uc, "HH-OTHER-1", new UpdateContactRequest(null, null, null),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateContact_store_failure_returns_500()
    {
        var uc = new UpdateContact(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.UpdateContactEndpoint(
            uc, "HH-TARGET-1", new UpdateContactRequest("Bob", null, null),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── PUT /directory/{householdRef}/notes ───────────────────────────────

    [Fact]
    public async Task UpdateNotes_ok_returns_200()
    {
        var uc = new UpdateNotes(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateNotesEndpoint(
            uc, "HH-TARGET-1", new UpdateNotesRequest("Parking A12"),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateNotes_refused_returns_403()
    {
        var uc = new UpdateNotes(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.UpdateNotesEndpoint(
            uc, "HH-OTHER-1", new UpdateNotesRequest("note"),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task UpdateNotes_store_failure_returns_500()
    {
        var uc = new UpdateNotes(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.UpdateNotesEndpoint(
            uc, "HH-TARGET-1", new UpdateNotesRequest("note"),
            NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetDirectory_resident_view_omits_PII_fields()
    {
        // Spec requirement: ResidentView must not expose Phone, Email, or Notes.
        // DirectoryEntryPublicDto enforces this at the type level; this test confirms the
        // endpoint maps to that DTO (not DirectoryEntryFullDto) for a resident session.
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EP-PII"), "Alice", "555-9999", "alice@test.com", "secret",
            DateTimeOffset.UtcNow));
        var uc = new GetDirectory(new FakeSession(ResidentCtx), store);
        var result = await DirectoryEndpoints.GetDirectoryEndpoint(uc, NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<List<DirectoryEntryPublicDto>>>(result);
        Assert.NotNull(json.Value);
        Assert.Single(json.Value);
        Assert.Equal("Alice", json.Value[0].DisplayName);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~DirectoryEndpointsTests" 2>&1 | tail -20
```

Expected: compile error — `DirectoryEndpoints`, `UpdateContactRequest`, `UpdateNotesRequest` do not exist.

- [ ] **Step 3: Create DirectoryEndpoints.cs**

Create `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Directory;
using Harmonia.Domain.Directory;

namespace Harmonia.Api.Directory;

public sealed record DirectoryEntryPublicDto(string HouseholdRef, string? DisplayName);

public sealed record DirectoryEntryFullDto(
    string         HouseholdRef,
    string?        DisplayName,
    string?        Phone,
    string?        Email,
    string?        Notes,
    DateTimeOffset UpdatedAt);

public sealed record UpdateContactRequest(string? DisplayName, string? Phone, string? Email);

public sealed record UpdateNotesRequest(string? Notes);

public static class DirectoryEndpoints
{
    public static async Task<IResult> GetDirectoryEndpoint(
        GetDirectory useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        return result switch
        {
            GetDirectoryResult.Refused         => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            GetDirectoryResult.ResidentView rv => TypedResults.Json(
                rv.Entries.Select(e =>
                    new DirectoryEntryPublicDto(e.HouseholdRef.Value, e.DisplayName)).ToList(),
                statusCode: StatusCodes.Status200OK),
            GetDirectoryResult.BoardView bv    => TypedResults.Json(
                bv.Entries.Select(ToFullDto).ToList(),
                statusCode: StatusCodes.Status200OK),
            GetDirectoryResult.Failed          => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> UpdateMyContactEndpoint(
        UpdateMyContact useCase, UpdateContactRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(body.DisplayName, body.Phone, body.Email, ct);
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
            householdRef, body.DisplayName, body.Phone, body.Email, ct);
        return result switch
        {
            UpdateContactResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            UpdateContactResult.Ok      => TypedResults.Ok(),
            UpdateContactResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> UpdateNotesEndpoint(
        UpdateNotes useCase, string householdRef, UpdateNotesRequest body,
        ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(householdRef, body.Notes, ct);
        return result switch
        {
            UpdateNotesResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            UpdateNotesResult.Ok      => TypedResults.Ok(),
            UpdateNotesResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                         => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static DirectoryEntryFullDto ToFullDto(HouseholdContact c) =>
        new(c.HouseholdRef.Value, c.DisplayName, c.Phone, c.Email, c.Notes, c.UpdatedAt);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~DirectoryEndpointsTests" 2>&1 | tail -20
```

Expected: 12 passed.

- [ ] **Step 5: Run full unit suite to check for regressions**

```
dotnet test tests/Harmonia.UnitTests/ 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 6: Commit**

```
git add src/Harmonia.Api/Directory/DirectoryEndpoints.cs tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs
git commit -m "feat: add DirectoryEndpoints with role-based DTO projection"
```

---

### Task 8: Program.cs wiring + appsettings.json

**Test-first: yes** — the build itself is the gate; `dotnet build` fails until the wiring compiles.

**Files:**
- Modify: `src/Harmonia.Api/Program.cs`
- Modify: `src/Harmonia.Api/appsettings.json`

This task wires everything into the composition root. No new logic — just registration and routing. Check that the existing using-directives pattern in Program.cs is followed.

- [ ] **Step 1: Add "Directory" key to appsettings.json**

Open `src/Harmonia.Api/appsettings.json` and add `"Directory": ""` to the `ConnectionStrings` object:

```json
"ConnectionStrings": {
  "Reservations": "",
  "MaintenanceFees": "",
  "Expenses": "",
  "Payments": "",
  "Notifications": "",
  "Directory": ""
}
```

- [ ] **Step 2: Verify the build fails without Program.cs changes**

```
dotnet build src/Harmonia.Api/ 2>&1 | tail -20
```

The build may succeed at this point (appsettings change doesn't affect compilation). That's fine — the next step adds code that would fail to compile without the files created in earlier tasks.

- [ ] **Step 3: Add using directives to Program.cs**

Open `src/Harmonia.Api/Program.cs`. Find the block of `using` statements at the top of the file and add:

```csharp
using Harmonia.Api.Directory;
using Harmonia.Application.Directory;
using Harmonia.Api.Reservations.Adapters;
```

If `using Harmonia.Api.Reservations.Adapters;` is already present (it should be — `SqlNotificationStore` lives there), skip adding it again.

- [ ] **Step 4: Add the Directory connection string guard and service registrations**

In `Program.cs`, find the section where other connection strings are guarded and configured (e.g., the `Notifications` block). Add immediately after it:

```csharp
var dirConnString = builder.Configuration.GetConnectionString("Directory");
if (string.IsNullOrWhiteSpace(dirConnString))
    throw new InvalidOperationException(
        "ConnectionStrings:Directory is not configured. Supply it via environment " +
        "(ConnectionStrings__Directory) or a git-ignored local config file.");

builder.Services.AddSingleton<IDirectoryStore>(new SqlDirectoryStore(dirConnString));
builder.Services.AddScoped<GetDirectory>();
builder.Services.AddScoped<UpdateMyContact>();
builder.Services.AddScoped<UpdateContact>();
builder.Services.AddScoped<UpdateNotes>();
```

- [ ] **Step 5: Register the four endpoints**

In `Program.cs`, find the section where `app.MapGet` / `app.MapPut` calls are made for other features. Add:

```csharp
app.MapGet(
    "/directory",
    (GetDirectory uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.GetDirectoryEndpoint(
            uc, loggers.CreateLogger("Directory"), ct));

app.MapPut(
    "/directory/contact",
    (UpdateMyContact uc, UpdateContactRequest body, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.UpdateMyContactEndpoint(
            uc, body, loggers.CreateLogger("Directory"), ct));

app.MapPut(
    "/directory/{householdRef}/contact",
    (UpdateContact uc, string householdRef, UpdateContactRequest body,
     ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.UpdateContactEndpoint(
            uc, householdRef, body, loggers.CreateLogger("Directory"), ct));

app.MapPut(
    "/directory/{householdRef}/notes",
    (UpdateNotes uc, string householdRef, UpdateNotesRequest body,
     ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.UpdateNotesEndpoint(
            uc, householdRef, body, loggers.CreateLogger("Directory"), ct));
```

- [ ] **Step 6: Build to confirm compilation succeeds**

```
dotnet build src/Harmonia.Api/ 2>&1 | tail -20
```

Expected: Build succeeded, 0 error(s).

- [ ] **Step 7: Run all unit tests**

```
dotnet test tests/Harmonia.UnitTests/ 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 8: Commit**

```
git add src/Harmonia.Api/Program.cs src/Harmonia.Api/appsettings.json
git commit -m "feat: wire Directory connection string, services, and endpoints into Program.cs"
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| `dbo.HouseholdContacts` table | Task 1 Step 3 |
| `HouseholdContact` domain record | Task 1 Step 4 |
| `IDirectoryStore` port + result types | Task 1 Step 5 |
| `FakeDirectoryStore`, `FailingDirectoryStore` | Task 1 Step 6 |
| `GetDirectory` use case (role check: IsAdmin first) | Task 2 Step 3 |
| `UpdateMyContact` use case (R2: session HouseholdRef) | Task 3 Step 3 |
| `UpdateContact` use case (board, householdRef from caller) | Task 4 Step 3 |
| `UpdateNotes` use case (board) | Task 5 Step 3 |
| `SqlDirectoryStore` with MERGE + COALESCE | Task 6 Step 3 |
| R3: Phone/Email never in ILogger calls | Task 6 (no log calls in store) + Task 7 (no log calls in endpoints) |
| `DirectoryEntryPublicDto` (no PII) | Task 7 Step 3 |
| `DirectoryEntryFullDto` (all fields) | Task 7 Step 3 |
| `UpdateContactRequest`, `UpdateNotesRequest` | Task 7 Step 3 |
| Connection string key "Directory" with fail-fast guard | Task 8 Steps 1 + 4 |
| 4 endpoints registered in Program.cs | Task 8 Step 5 |
| Unit tests — all use cases | Tasks 2–5 |
| Unit tests — all endpoint status codes | Task 7 |
| Integration tests — upsert + partial update + ordering | Task 6 |

### Type consistency

- `IDirectoryStore.UpsertContactAsync` takes `(HouseholdRef, string?, string?, string?, CancellationToken)` — matches across `UpdateMyContact`, `UpdateContact`, `FakeDirectoryStore`, `FailingDirectoryStore`, `SqlDirectoryStore`.
- `IDirectoryStore.UpsertNotesAsync` takes `(HouseholdRef, string?, CancellationToken)` — matches across `UpdateNotes`, `FakeDirectoryStore`, `FailingDirectoryStore`, `SqlDirectoryStore`.
- `UpdateMyContact.ExecuteAsync` signature `(string? displayName, string? phone, string? email, CancellationToken)` matches calls in `DirectoryEndpoints.UpdateMyContactEndpoint` and `UpdateMyContactTests`.
- `UpdateContact.ExecuteAsync` signature `(string householdRef, string? displayName, string? phone, string? email, CancellationToken)` matches calls in `DirectoryEndpoints.UpdateContactEndpoint` and `UpdateContactTests`.
- `UpdateNotes.ExecuteAsync` signature `(string householdRef, string? notes, CancellationToken)` matches `DirectoryEndpoints.UpdateNotesEndpoint` and `UpdateNotesTests`.
