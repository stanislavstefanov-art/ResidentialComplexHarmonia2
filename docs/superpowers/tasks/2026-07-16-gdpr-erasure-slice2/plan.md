# GDPR Erasure Slice 2 — DepartedAt Schema Migration and Retention Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `DepartedAt` to `dbo.HouseholdContacts`, implement `MarkDeparted` (board sets departure) and `PurgeExpiredContacts` (board sweeps rows ≥ 1 year old) with full TDD coverage, and update the resident directory view to hide departed contacts.

**Architecture:** Three-layer — domain record gains `DepartedAt?`, port gains two result types and two interface methods, two new use cases, SQL adapter adds two new methods and a schema migration, two new endpoints wired in `Program.cs`. Board sees all contacts including departed; resident view filters them out.

**Tech Stack:** .NET 8, C# 12, ASP.NET Core Minimal API, Microsoft.Data.SqlClient (raw ADO.NET), SQL Server, xUnit, no new packages.

---

## File Map

| Action | File |
|---|---|
| Modify | `src/Harmonia.Domain/Directory/HouseholdContact.cs` |
| Modify | `src/Harmonia.Application/Directory/Ports.cs` |
| Create | `src/Harmonia.Application/Directory/MarkDeparted.cs` |
| Create | `src/Harmonia.Application/Directory/PurgeExpiredContacts.cs` |
| Modify | `src/Harmonia.Application/Directory/GetDirectory.cs` |
| Modify | `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` |
| Modify | `src/Harmonia.Api/Directory/DirectoryEndpoints.cs` |
| Modify | `src/Harmonia.Api/Program.cs` |
| Modify | `db/schema.sql` |
| Modify | `tests/Harmonia.UnitTests/Fakes.cs` |
| Create | `tests/Harmonia.UnitTests/Application/MarkDepartedTests.cs` |
| Create | `tests/Harmonia.UnitTests/Application/PurgeExpiredContactsTests.cs` |
| Modify | `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs` |
| Modify | `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs` |
| Modify | `tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs` |
| Modify | `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs` |

---

## Task 0: HouseholdContact domain change — append DepartedAt and fix all callsites

**MUST BE FIRST.** This is a breaking positional-record change that causes 15 compile errors across 7 files. All callsites must be fixed before any new test can be written.

**Files:**
- Modify: `src/Harmonia.Domain/Directory/HouseholdContact.cs`
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` (ReadRow)
- Modify: `tests/Harmonia.UnitTests/Fakes.cs` (2 callsites)
- Modify: `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs` (2 callsites)
- Modify: `tests/Harmonia.UnitTests/Application/EraseContactTests.cs` (1 callsite)
- Modify: `tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs` (3 callsites)
- Modify: `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs` (4 callsites)
- Modify: `tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs` (2 callsites)

- [ ] **Step 1: Write a failing test that proves DepartedAt doesn't exist yet**

Add this temporary test to `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs` at the bottom of the class:

```csharp
[Fact]
public void HouseholdContact_has_DepartedAt()
{
    var contact = new HouseholdContact(
        new HouseholdRef("HH-1"), null, null, null, null,
        IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null);
    Assert.Null(contact.DepartedAt);
}
```

- [ ] **Step 2: Run to verify it fails (compile error)**

```
dotnet build tests/Harmonia.UnitTests
```

Expected: Build FAILED — `CS1739 The best overload for 'HouseholdContact' does not have a parameter named 'DepartedAt'` (or similar argument count error).

- [ ] **Step 3: Add DepartedAt to HouseholdContact**

Replace the contents of `src/Harmonia.Domain/Directory/HouseholdContact.cs`:

```csharp
namespace Harmonia.Domain.Directory;

/// <summary>
/// Snapshot of one apartment's contact information stored in <c>dbo.HouseholdContacts</c>.
/// Phone, Email, and HouseholdRef are personal data (R3) — never log their values; log counts or opaque refs only.
/// </summary>
public sealed record HouseholdContact(
    HouseholdRef    HouseholdRef,
    string?         DisplayName,
    string?         Phone,
    string?         Email,
    string?         Notes,
    bool            IsOptedOut,
    DateTimeOffset  UpdatedAt,
    DateTimeOffset? DepartedAt);
```

- [ ] **Step 4: Fix SqlDirectoryStore.ReadRow**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, replace the `ReadRow` method at the bottom of the class:

Old:
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

New (DepartedAt: null placeholder until SELECT is extended in Task 4):
```csharp
    private static HouseholdContact ReadRow(SqlDataReader r) =>
        new(HouseholdRef: new HouseholdRef(r.GetString(0)),
            DisplayName:  r.IsDBNull(1) ? null : r.GetString(1),
            Phone:        r.IsDBNull(2) ? null : r.GetString(2),
            Email:        r.IsDBNull(3) ? null : r.GetString(3),
            Notes:        r.IsDBNull(4) ? null : r.GetString(4),
            IsOptedOut:   r.GetBoolean(5),
            UpdatedAt:    r.GetDateTimeOffset(6),
            DepartedAt:   null);
```

- [ ] **Step 5: Fix Fakes.cs callsites**

In `tests/Harmonia.UnitTests/Fakes.cs`, in `FakeDirectoryStore.UpsertContactAsync` (around line 339), update the insert branch:

Old:
```csharp
            _contacts.Add(new HouseholdContact(
                householdRef, displayName, phone, email, null,
                IsOptedOut: isOptedOut ?? false, DateTimeOffset.UtcNow));
```

New:
```csharp
            _contacts.Add(new HouseholdContact(
                householdRef, displayName, phone, email, null,
                IsOptedOut: isOptedOut ?? false, DateTimeOffset.UtcNow, DepartedAt: null));
```

In `FakeDirectoryStore.UpsertNotesAsync` (around line 357), update the insert branch:

Old:
```csharp
            _contacts.Add(new HouseholdContact(
                householdRef, null, null, null, notes, IsOptedOut: false, DateTimeOffset.UtcNow));
```

New:
```csharp
            _contacts.Add(new HouseholdContact(
                householdRef, null, null, null, notes, IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

- [ ] **Step 6: Fix GetDirectoryTests.cs callsites**

In `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs`, append `, DepartedAt: null` to the two `new HouseholdContact(...)` calls:

Line ~71 (OptedOut_household_is_hidden_in_ResidentView):
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-OPT-1"), "Alice", null, null, null,
            IsOptedOut: true, DateTimeOffset.UtcNow, DepartedAt: null));
```

Line ~83 (OptedOut_household_IS_visible_in_BoardView):
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-OPT-2"), "Bob", null, null, null,
            IsOptedOut: true, DateTimeOffset.UtcNow, DepartedAt: null));
```

- [ ] **Step 7: Fix EraseContactTests.cs callsite**

In `tests/Harmonia.UnitTests/Application/EraseContactTests.cs`, line ~35:

Old:
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Carol", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow));
```

New:
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Carol", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

- [ ] **Step 8: Fix EraseMyContactTests.cs callsites (3)**

In `tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs`:

Line ~44 (Resident_deletes_own_contact_returns_Ok):
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-ERASE-1"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

Line ~75 (HouseholdRef_comes_from_session, first contact):
```csharp
        store.Contacts.Add(new HouseholdContact(
            residentRef, "Alice", null, null, null, IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

Line ~77 (HouseholdRef_comes_from_session, second contact):
```csharp
        store.Contacts.Add(new HouseholdContact(
            otherRef, "Bob", null, null, null, IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

- [ ] **Step 9: Fix DirectoryEndpointsTests.cs callsites (4)**

In `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`:

Line ~163 (GetDirectory_resident_view_omits_PII_fields):
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EP-PII"), "Alice", "555-9999", "alice@test.com", "secret",
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

Line ~179 (GetDirectory_board_view_includes_IsOptedOut_flag):
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-OPT-DTO"), "Carol", null, null, null,
            IsOptedOut: true, DateTimeOffset.UtcNow, DepartedAt: null));
```

Line ~209 (EraseMyContact_ok_returns_204):
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EP-1"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

Line ~251 (EraseContact_ok_returns_204):
```csharp
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Bob", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

- [ ] **Step 10: Fix DirectoryLogExclusionTests.cs callsites (2)**

In `tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs`:

Line ~35 (EraseMyContact_endpoint_never_logs_householdRef):
```csharp
            store.Contacts.Add(new HouseholdContact(
                new HouseholdRef(SecretResidentRef), "Alice", null, null, null,
                IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

Line ~65 (EraseContact_endpoint_never_logs_householdRef):
```csharp
            store.Contacts.Add(new HouseholdContact(
                new HouseholdRef(SecretBoardRef), "Bob", null, null, null,
                IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
```

- [ ] **Step 11: Build and run all unit tests — verify GREEN**

```
dotnet build
dotnet test tests/Harmonia.UnitTests
```

Expected: All existing tests PASS. The new `HouseholdContact_has_DepartedAt` test also passes.

- [ ] **Step 12: Commit**

```
git add src/Harmonia.Domain/Directory/HouseholdContact.cs src/Harmonia.Api/Adapters/SqlDirectoryStore.cs tests/Harmonia.UnitTests/Fakes.cs tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs tests/Harmonia.UnitTests/Application/EraseContactTests.cs tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs
git commit -m "feat: add DepartedAt to HouseholdContact domain record (ADR-0004)"
```

---

## Task 1: Port contract additions + fakes + SqlDirectoryStore stubs + schema migration

Adds the two new result types and interface methods, full fake implementations, SqlDirectoryStore compilation stubs, and the idempotent schema migration. The build must stay green after this task.

**Files:**
- Modify: `src/Harmonia.Application/Directory/Ports.cs`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs`
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`
- Modify: `db/schema.sql`

- [ ] **Step 1: Add result types and interface methods to Ports.cs**

Test-first: `FakeDirectoryStore` will get compile errors when we extend the interface. The compile error is the failing signal.

In `src/Harmonia.Application/Directory/Ports.cs`, append after the `EraseContactResult` block and before the `IDirectoryStore` interface declaration:

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

Then in `IDirectoryStore`, append after `DeleteContactAsync`:

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

- [ ] **Step 2: Run build to verify compile errors in fakes and adapter**

```
dotnet build
```

Expected: Build FAILED — `FakeDirectoryStore`, `FailingDirectoryStore`, `SqlDirectoryStore` do not implement `MarkDepartedAsync` and `PurgeExpiredContactsAsync`.

- [ ] **Step 3: Add full implementations to FakeDirectoryStore**

In `tests/Harmonia.UnitTests/Fakes.cs`, inside `FakeDirectoryStore`, append after `DeleteContactAsync`:

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

    public Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(CancellationToken ct = default)
    {
        var cutoff  = DateTimeOffset.UtcNow.AddYears(-1);
        var removed = _contacts.RemoveAll(c => c.DepartedAt.HasValue && c.DepartedAt.Value < cutoff);
        return Task.FromResult<PurgeExpiredContactsResult>(new PurgeExpiredContactsResult.Ok(removed));
    }
```

- [ ] **Step 4: Add stub implementations to FailingDirectoryStore**

In `tests/Harmonia.UnitTests/Fakes.cs`, inside `FailingDirectoryStore`, append after `DeleteContactAsync`:

```csharp
    public Task<MarkDepartedResult> MarkDepartedAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => Task.FromResult<MarkDepartedResult>(new MarkDepartedResult.Failed());

    public Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(CancellationToken ct = default)
        => Task.FromResult<PurgeExpiredContactsResult>(new PurgeExpiredContactsResult.Failed());
```

- [ ] **Step 5: Add compilation stubs to SqlDirectoryStore**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, append before the closing `}` of the class (before `ReadRow`):

```csharp
    public Task<MarkDepartedResult> MarkDepartedAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new NotImplementedException("Task 4 implements this");

    public Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(
        CancellationToken ct = default)
        => throw new NotImplementedException("Task 5 implements this");
```

- [ ] **Step 6: Add idempotent DepartedAt migration to schema.sql**

In `db/schema.sql`, append after the `CONSTRAINT PK_HouseholdContacts` block (at the very end of the file):

```sql

-- GDPR Art. 6(1)(f) departure marker — retention clock start (ADR-0004).
-- Idempotent: SqlServerFixture applies schema.sql on every integration test run.
IF COL_LENGTH('dbo.HouseholdContacts', 'DepartedAt') IS NULL
    ALTER TABLE dbo.HouseholdContacts ADD DepartedAt datetimeoffset NULL;
```

- [ ] **Step 7: Build and verify unit tests still pass**

```
dotnet build
dotnet test tests/Harmonia.UnitTests
```

Expected: Build SUCCEEDS. All unit tests PASS.

- [ ] **Step 8: Commit**

```
git add src/Harmonia.Application/Directory/Ports.cs tests/Harmonia.UnitTests/Fakes.cs src/Harmonia.Api/Adapters/SqlDirectoryStore.cs db/schema.sql
git commit -m "feat: add MarkDeparted and PurgeExpiredContacts port contract, fakes, and schema migration"
```

---

## Task 2: MarkDeparted use case + unit tests

Test-first: `src/Harmonia.Application/Directory/MarkDeparted.cs` does not exist.

**Files:**
- Create: `tests/Harmonia.UnitTests/Application/MarkDepartedTests.cs`
- Create: `src/Harmonia.Application/Directory/MarkDeparted.cs`

- [ ] **Step 1: Write MarkDepartedTests.cs**

Create `tests/Harmonia.UnitTests/Application/MarkDepartedTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class MarkDepartedTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-MD-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new MarkDeparted(new FakeSession(null), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<MarkDepartedResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var uc = new MarkDeparted(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<MarkDepartedResult.Refused>(result);
    }

    [Fact]
    public async Task Admin_marks_existing_contact_returns_Ok()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-1"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
        var uc = new MarkDeparted(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<MarkDepartedResult.Ok>(result);
    }

    [Fact]
    public async Task Admin_target_not_found_returns_NotFound()
    {
        var uc = new MarkDeparted(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync("HH-NONEXISTENT");
        Assert.IsType<MarkDepartedResult.NotFound>(result);
    }

    [Fact]
    public async Task MarkDeparted_is_idempotent_second_call_returns_Ok_and_preserves_original_date()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-TARGET-2"), "Bob", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
        var uc = new MarkDeparted(new FakeSession(AdminCtx), store);

        // First call — sets DepartedAt
        await uc.ExecuteAsync("HH-TARGET-2");
        var firstDepartedAt = store.Contacts[0].DepartedAt;
        Assert.NotNull(firstDepartedAt);

        // Second call — idempotent; must return Ok and must NOT change the original date
        var result = await uc.ExecuteAsync("HH-TARGET-2");
        Assert.IsType<MarkDepartedResult.Ok>(result);
        Assert.Equal(firstDepartedAt, store.Contacts[0].DepartedAt);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new MarkDeparted(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync("HH-TARGET-1");
        Assert.IsType<MarkDepartedResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Run to verify RED**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~MarkDepartedTests"
```

Expected: Build FAILED — `The type or namespace name 'MarkDeparted' could not be found`.

- [ ] **Step 3: Create MarkDeparted.cs**

Create `src/Harmonia.Application/Directory/MarkDeparted.cs`:

```csharp
using Harmonia.Domain;
using Harmonia.Domain.Directory;

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

- [ ] **Step 4: Run to verify GREEN**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~MarkDepartedTests"
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Run full unit test suite**

```
dotnet test tests/Harmonia.UnitTests
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```
git add tests/Harmonia.UnitTests/Application/MarkDepartedTests.cs src/Harmonia.Application/Directory/MarkDeparted.cs
git commit -m "feat: add MarkDeparted use case with unit tests"
```

---

## Task 3: PurgeExpiredContacts use case + unit tests

Test-first: `src/Harmonia.Application/Directory/PurgeExpiredContacts.cs` does not exist.

**Files:**
- Create: `tests/Harmonia.UnitTests/Application/PurgeExpiredContactsTests.cs`
- Create: `src/Harmonia.Application/Directory/PurgeExpiredContacts.cs`

- [ ] **Step 1: Write PurgeExpiredContactsTests.cs**

Create `tests/Harmonia.UnitTests/Application/PurgeExpiredContactsTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.UnitTests.Application;

public class PurgeExpiredContactsTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-PEC-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(null), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<PurgeExpiredContactsResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_session_returns_Refused()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<PurgeExpiredContactsResult.Refused>(result);
    }

    [Fact]
    public async Task Admin_purges_expired_rows_returns_correct_count()
    {
        var store = new FakeDirectoryStore();
        var expiredDate = DateTimeOffset.UtcNow.AddYears(-1).AddDays(-1);
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EXP-A"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: expiredDate));
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-EXP-B"), "Bob", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: expiredDate));

        var uc = new PurgeExpiredContacts(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync();

        var ok = Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        Assert.Equal(2, ok.Deleted);
        Assert.Empty(store.Contacts);
    }

    [Fact]
    public async Task Admin_no_eligible_rows_returns_zero()
    {
        var store = new FakeDirectoryStore();
        // Active resident — DepartedAt is null; must NOT be purged
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-ACTIVE"), "Carol", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));

        var uc = new PurgeExpiredContacts(new FakeSession(AdminCtx), store);
        var result = await uc.ExecuteAsync();

        var ok = Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        Assert.Equal(0, ok.Deleted);
        Assert.Single(store.Contacts); // contact untouched
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await uc.ExecuteAsync();
        Assert.IsType<PurgeExpiredContactsResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Run to verify RED**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~PurgeExpiredContactsTests"
```

Expected: Build FAILED — `The type or namespace name 'PurgeExpiredContacts' could not be found`.

- [ ] **Step 3: Create PurgeExpiredContacts.cs**

Create `src/Harmonia.Application/Directory/PurgeExpiredContacts.cs`:

```csharp
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

- [ ] **Step 4: Run to verify GREEN**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~PurgeExpiredContactsTests"
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run full unit test suite**

```
dotnet test tests/Harmonia.UnitTests
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```
git add tests/Harmonia.UnitTests/Application/PurgeExpiredContactsTests.cs src/Harmonia.Application/Directory/PurgeExpiredContacts.cs
git commit -m "feat: add PurgeExpiredContacts use case with unit tests"
```

---

## Task 4: SqlDirectoryStore SELECT/ReadRow update + MarkDepartedAsync implementation + integration tests

Updates `ListAllAsync` to select `DepartedAt` at ordinal 7, updates `ReadRow` to read it, and implements `MarkDepartedAsync`. Requires a real SQL Server — the schema migration in Task 1 adds the column.

**Files:**
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`
- Modify: `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`

- [ ] **Step 1: Write integration tests for MarkDepartedAsync**

In `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`, append after the `DeleteContact_does_not_affect_other_rows` test:

```csharp
    [Fact]
    public async Task MarkDeparted_sets_DepartedAt_and_row_appears_in_ListAll()
    {
        var hh = new HouseholdRef($"HH-DEP-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Departed Dave", null, null, isOptedOut: null);

        var result = await Store.MarkDepartedAsync(hh);

        Assert.IsType<MarkDepartedResult.Ok>(result);
        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.NotNull(entry.DepartedAt);
    }

    [Fact]
    public async Task MarkDeparted_nonexistent_row_returns_NotFound()
    {
        var hh = new HouseholdRef($"HH-DEP-NF-{Guid.NewGuid():N}");

        var result = await Store.MarkDepartedAsync(hh);

        Assert.IsType<MarkDepartedResult.NotFound>(result);
    }

    [Fact]
    public async Task MarkDeparted_already_departed_is_idempotent_and_preserves_original_date()
    {
        var hh = new HouseholdRef($"HH-DEP-IDEM-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Eve", null, null, isOptedOut: null);

        // First call sets the date
        await Store.MarkDepartedAsync(hh);
        var all = await Store.ListAllAsync();
        var firstDate = all.First(e => e.HouseholdRef == hh).DepartedAt;
        Assert.NotNull(firstDate);

        // Small delay to ensure clock would advance if not preserved
        await Task.Delay(10);

        // Second call must return Ok and must NOT update DepartedAt
        var result = await Store.MarkDepartedAsync(hh);
        Assert.IsType<MarkDepartedResult.Ok>(result);
        all = await Store.ListAllAsync();
        Assert.Equal(firstDate, all.First(e => e.HouseholdRef == hh).DepartedAt);
    }
```

Also add the `using` for the result type at the top of the file (if not already present):
```csharp
using Harmonia.Application.Directory;
```

- [ ] **Step 2: Run integration tests to verify RED**

```
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel&FullyQualifiedName~MarkDeparted"
```

Expected: Tests run but `MarkDepartedAsync` throws `NotImplementedException`.

- [ ] **Step 3: Update ListAllAsync SELECT to include DepartedAt**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, update the `cmd.CommandText` in `ListAllAsync`:

Old:
```csharp
        cmd.CommandText =
            "SELECT HouseholdRef, DisplayName, Phone, Email, Notes, IsOptedOut, UpdatedAt " +
            "FROM dbo.HouseholdContacts " +
            "ORDER BY HouseholdRef ASC;";
```

New:
```csharp
        cmd.CommandText =
            "SELECT HouseholdRef, DisplayName, Phone, Email, Notes, IsOptedOut, UpdatedAt, DepartedAt " +
            "FROM dbo.HouseholdContacts " +
            "ORDER BY HouseholdRef ASC;";
```

- [ ] **Step 4: Update ReadRow to read ordinal 7**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, replace the `ReadRow` method:

Old (DepartedAt: null placeholder from Task 0):
```csharp
    private static HouseholdContact ReadRow(SqlDataReader r) =>
        new(HouseholdRef: new HouseholdRef(r.GetString(0)),
            DisplayName:  r.IsDBNull(1) ? null : r.GetString(1),
            Phone:        r.IsDBNull(2) ? null : r.GetString(2),
            Email:        r.IsDBNull(3) ? null : r.GetString(3),
            Notes:        r.IsDBNull(4) ? null : r.GetString(4),
            IsOptedOut:   r.GetBoolean(5),
            UpdatedAt:    r.GetDateTimeOffset(6),
            DepartedAt:   null);
```

New (reads ordinal 7):
```csharp
    private static HouseholdContact ReadRow(SqlDataReader r) =>
        new(HouseholdRef: new HouseholdRef(r.GetString(0)),
            DisplayName:  r.IsDBNull(1) ? null : r.GetString(1),
            Phone:        r.IsDBNull(2) ? null : r.GetString(2),
            Email:        r.IsDBNull(3) ? null : r.GetString(3),
            Notes:        r.IsDBNull(4) ? null : r.GetString(4),
            IsOptedOut:   r.GetBoolean(5),
            UpdatedAt:    r.GetDateTimeOffset(6),
            DepartedAt:   r.IsDBNull(7) ? null : r.GetDateTimeOffset(7));
```

- [ ] **Step 5: Implement MarkDepartedAsync**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, replace the `MarkDepartedAsync` stub:

Old:
```csharp
    public Task<MarkDepartedResult> MarkDepartedAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new NotImplementedException("Task 4 implements this");
```

New:
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

Note: `ISNULL(DepartedAt, SYSUTCDATETIMEOFFSET())` is the idempotency mechanism — it preserves the original departure date if already set. `SYSUTCDATETIMEOFFSET()` returns `datetimeoffset`, matching the column type (NOT `GETUTCDATE()` which returns `datetime`).

- [ ] **Step 6: Run integration tests to verify GREEN**

```
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel&FullyQualifiedName~MarkDeparted"
```

Expected: All 3 MarkDeparted integration tests PASS.

- [ ] **Step 7: Run full test suite**

```
dotnet test tests/Harmonia.UnitTests
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel"
```

Expected: All unit tests and all integration tests PASS.

- [ ] **Step 8: Commit**

```
git add src/Harmonia.Api/Adapters/SqlDirectoryStore.cs tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs
git commit -m "feat: implement SqlDirectoryStore.MarkDepartedAsync with DepartedAt at ordinal 7"
```

---

## Task 5: PurgeExpiredContactsAsync implementation + integration tests

**Files:**
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`
- Modify: `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`

- [ ] **Step 1: Write integration tests for PurgeExpiredContactsAsync**

In `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`, append after the last MarkDeparted test:

```csharp
    [Fact]
    public async Task PurgeExpired_deletes_rows_past_cutoff_and_returns_count()
    {
        // Two rows with DepartedAt > 1 year ago — both should be deleted
        var hh1 = new HouseholdRef($"HH-PG-OLD-{Guid.NewGuid():N}");
        var hh2 = new HouseholdRef($"HH-PG-OLD2-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh1, "Old1", null, null, isOptedOut: null);
        await Store.UpsertContactAsync(hh2, "Old2", null, null, isOptedOut: null);

        // Manually set DepartedAt to > 1 year ago using direct SQL
        // (MarkDepartedAsync would set it to NOW; we need a past date for this test)
        await using var conn = new Microsoft.Data.SqlClient.SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE dbo.HouseholdContacts
            SET DepartedAt = DATEADD(year, -2, SYSUTCDATETIMEOFFSET())
            WHERE HouseholdRef IN (@HH1, @HH2);
            """;
        cmd.Parameters.AddWithValue("@HH1", hh1.Value);
        cmd.Parameters.AddWithValue("@HH2", hh2.Value);
        await cmd.ExecuteNonQueryAsync();

        var result = await Store.PurgeExpiredContactsAsync();

        var ok = Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        Assert.True(ok.Deleted >= 2, $"Expected at least 2 deleted, got {ok.Deleted}");

        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.HouseholdRef == hh1);
        Assert.DoesNotContain(all, e => e.HouseholdRef == hh2);
    }

    [Fact]
    public async Task PurgeExpired_spares_rows_inside_retention_window()
    {
        // Row with DepartedAt set recently — NOT past the 1-year cutoff
        var hh = new HouseholdRef($"HH-PG-RECENT-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Recent", null, null, isOptedOut: null);
        await Store.MarkDepartedAsync(hh); // DepartedAt = NOW (within 1 year)

        var result = await Store.PurgeExpiredContactsAsync();

        Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        var all = await Store.ListAllAsync();
        Assert.Contains(all, e => e.HouseholdRef == hh); // row still present
    }

    [Fact]
    public async Task PurgeExpired_spares_rows_with_null_DepartedAt()
    {
        // Active resident — DepartedAt is NULL
        var hh = new HouseholdRef($"HH-PG-ACTIVE-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Active", null, null, isOptedOut: null);

        var result = await Store.PurgeExpiredContactsAsync();

        Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        var all = await Store.ListAllAsync();
        Assert.Contains(all, e => e.HouseholdRef == hh); // row still present
    }
```

Also add `using Microsoft.Data.SqlClient;` at the top of `SqlDirectoryStoreTests.cs` if not present.

- [ ] **Step 2: Run to verify RED**

```
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel&FullyQualifiedName~PurgeExpired"
```

Expected: Tests run but `PurgeExpiredContactsAsync` throws `NotImplementedException`.

- [ ] **Step 3: Implement PurgeExpiredContactsAsync**

In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, replace the `PurgeExpiredContactsAsync` stub:

Old:
```csharp
    public Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(
        CancellationToken ct = default)
        => throw new NotImplementedException("Task 5 implements this");
```

New:
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

Note: `SYSUTCDATETIMEOFFSET()` (not `GETUTCDATE()`) matches the `datetimeoffset` column type. The ADR-0004 illustrative SQL uses `GETUTCDATE()` but that would cause a type mismatch at runtime.

- [ ] **Step 4: Run integration tests to verify GREEN**

```
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel&FullyQualifiedName~PurgeExpired"
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Run full test suite**

```
dotnet test tests/Harmonia.UnitTests
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel"
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```
git add src/Harmonia.Api/Adapters/SqlDirectoryStore.cs tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs
git commit -m "feat: implement SqlDirectoryStore.PurgeExpiredContactsAsync with integration tests"
```

---

## Task 6: GetDirectory departure-aware filtering + tests

ResidentView must exclude contacts where `DepartedAt` is not null. BoardView continues to return all contacts.

**Files:**
- Modify: `src/Harmonia.Application/Directory/GetDirectory.cs`
- Modify: `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs`

- [ ] **Step 1: Write failing tests for DepartedAt filtering**

In `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs`, append after `OptedOut_household_IS_visible_in_BoardView`:

```csharp
    [Fact]
    public async Task Departed_household_is_hidden_in_ResidentView()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-DEP-HIDE"), "Departed Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: DateTimeOffset.UtcNow.AddDays(-30)));
        var useCase = new GetDirectory(new FakeSession(ResidentCtx), store);
        var result = Assert.IsType<GetDirectoryResult.ResidentView>(await useCase.ExecuteAsync());
        Assert.Empty(result.Entries);
    }

    [Fact]
    public async Task Departed_household_IS_visible_in_BoardView()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-DEP-BOARD"), "Departed Bob", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: DateTimeOffset.UtcNow.AddDays(-30)));
        var useCase = new GetDirectory(new FakeSession(AdminCtx), store);
        var result = Assert.IsType<GetDirectoryResult.BoardView>(await useCase.ExecuteAsync());
        Assert.Single(result.Entries);
    }
```

- [ ] **Step 2: Run to verify RED**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~GetDirectoryTests"
```

Expected: `Departed_household_is_hidden_in_ResidentView` FAILS (departed contact appears in ResidentView). `Departed_household_IS_visible_in_BoardView` PASSES.

- [ ] **Step 3: Update GetDirectory.cs ResidentView filter**

In `src/Harmonia.Application/Directory/GetDirectory.cs`, replace the `ResidentView` branch:

Old:
```csharp
            if (ctx.IsResident)
            {
                var visible = entries.Where(e => !e.IsOptedOut).ToList();
                return new GetDirectoryResult.ResidentView(visible);
            }
```

New:
```csharp
            if (ctx.IsResident)
            {
                var visible = entries.Where(e => e.DepartedAt is null && !e.IsOptedOut).ToList();
                return new GetDirectoryResult.ResidentView(visible);
            }
```

- [ ] **Step 4: Run to verify GREEN**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~GetDirectoryTests"
```

Expected: All 10 tests PASS (8 original + 2 new).

- [ ] **Step 5: Run full unit test suite**

```
dotnet test tests/Harmonia.UnitTests
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```
git add src/Harmonia.Application/Directory/GetDirectory.cs tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs
git commit -m "feat: filter departed contacts from GetDirectory ResidentView (ADR-0004)"
```

---

## Task 7: DirectoryEntryFullDto + endpoints + endpoint tests

Adds `DepartedAt` to the board DTO, adds `MarkDepartedEndpoint` and `PurgeExpiredContactsEndpoint` to `DirectoryEndpoints`, and covers all status-code paths.

**Files:**
- Modify: `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`
- Modify: `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`

- [ ] **Step 1: Write failing endpoint tests**

In `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`, add at the top of the file:
```csharp
using System.Text.Json;
```

Append after `EraseContact_store_failure_returns_500`:

```csharp
    // ── PUT /directory/{householdRef}/departed ────────────────────────────

    [Fact]
    public async Task MarkDeparted_ok_returns_200()
    {
        var store = new FakeDirectoryStore();
        store.Contacts.Add(new HouseholdContact(
            new HouseholdRef("HH-MD-1"), "Alice", null, null, null,
            IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
        var uc = new MarkDeparted(new FakeSession(AdminCtx), store);
        var result = await DirectoryEndpoints.MarkDepartedEndpoint(
            uc, "HH-MD-1", NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task MarkDeparted_not_found_returns_404()
    {
        var uc = new MarkDeparted(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.MarkDepartedEndpoint(
            uc, "HH-MD-NF", NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status404NotFound,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task MarkDeparted_refused_returns_403()
    {
        var uc = new MarkDeparted(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.MarkDepartedEndpoint(
            uc, "HH-MD-1", NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task MarkDeparted_store_failure_returns_500()
    {
        var uc = new MarkDeparted(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.MarkDepartedEndpoint(
            uc, "HH-MD-1", NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── DELETE /directory/purge-expired ──────────────────────────────────

    [Fact]
    public async Task PurgeExpired_ok_returns_200_with_deleted_count()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(AdminCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, NullLogger.Instance, default);
        var jsonResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, jsonResult.StatusCode);

        // Verify body has { deleted: 0 }
        var okResult = Assert.IsAssignableFrom<Microsoft.AspNetCore.Http.HttpResults.Ok<object>>(result);
        var json = JsonSerializer.Serialize(okResult.Value);
        Assert.Contains("\"deleted\"", json);
    }

    [Fact]
    public async Task PurgeExpired_refused_returns_403()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(ResidentCtx), new FakeDirectoryStore());
        var result = await DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task PurgeExpired_store_failure_returns_500()
    {
        var uc = new PurgeExpiredContacts(new FakeSession(AdminCtx), new FailingDirectoryStore());
        var result = await DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }
```

Also add to the `using` block at the top:
```csharp
using Harmonia.Application.Directory;
```
(if `MarkDeparted` and `PurgeExpiredContacts` are not already resolvable via existing usings).

- [ ] **Step 2: Run to verify RED**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~DirectoryEndpointsTests"
```

Expected: Build FAILED — `MarkDepartedEndpoint` and `PurgeExpiredContactsEndpoint` do not exist in `DirectoryEndpoints`.

- [ ] **Step 3: Update DirectoryEntryFullDto to add DepartedAt**

In `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`, replace `DirectoryEntryFullDto`:

Old:
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
```

New:
```csharp
/// <summary>Board-facing view — full contact details including phone, email, notes, opt-out status, and departure date.</summary>
public sealed record DirectoryEntryFullDto(
    string          HouseholdRef,
    string?         DisplayName,
    string?         Phone,
    string?         Email,
    string?         Notes,
    bool            IsOptedOut,
    DateTimeOffset  UpdatedAt,
    DateTimeOffset? DepartedAt);
```

- [ ] **Step 4: Update ToFullDto to map DepartedAt**

In `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`, replace `ToFullDto`:

Old:
```csharp
    private static DirectoryEntryFullDto ToFullDto(HouseholdContact c) =>
        new(c.HouseholdRef.Value, c.DisplayName, c.Phone, c.Email, c.Notes, c.IsOptedOut, c.UpdatedAt);
```

New:
```csharp
    private static DirectoryEntryFullDto ToFullDto(HouseholdContact c) =>
        new(c.HouseholdRef.Value, c.DisplayName, c.Phone, c.Email, c.Notes, c.IsOptedOut, c.UpdatedAt, c.DepartedAt);
```

- [ ] **Step 5: Add MarkDepartedEndpoint to DirectoryEndpoints**

In `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`, append before the `ToFullDto` method:

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

- [ ] **Step 6: Run to verify GREEN**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~DirectoryEndpointsTests"
```

Expected: All tests PASS (16 original + 7 new = 23 total).

- [ ] **Step 7: Run full unit test suite**

```
dotnet test tests/Harmonia.UnitTests
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```
git add src/Harmonia.Api/Directory/DirectoryEndpoints.cs tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs
git commit -m "feat: add MarkDeparted and PurgeExpiredContacts endpoints with DepartedAt in BoardView DTO"
```

---

## Task 8: R3 log exclusion test for MarkDepartedEndpoint

Verifies that `householdRef` (a URL path parameter and personal data per R3) never appears in any log line emitted by `MarkDepartedEndpoint` across all four result scenarios.

`PurgeExpiredContactsEndpoint` takes no `householdRef` parameter — no R3 test is needed for it.

**Files:**
- Modify: `tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs`

- [ ] **Step 1: Write the R3 theory test**

In `tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs`, append after `EraseContact_endpoint_never_logs_householdRef`:

```csharp
    [Theory]
    [InlineData("ok")]
    [InlineData("not_found")]
    [InlineData("refused")]
    [InlineData("failed")]
    public async Task MarkDeparted_endpoint_never_logs_householdRef(string scenario)
    {
        var store = new FakeDirectoryStore();
        if (scenario == "ok")
        {
            store.Contacts.Add(new HouseholdContact(
                new HouseholdRef(SecretBoardRef), "Dave", null, null, null,
                IsOptedOut: false, DateTimeOffset.UtcNow, DepartedAt: null));
        }

        var session = scenario == "refused"
            ? new FakeSession(ResidentCtx)
            : new FakeSession(AdminCtx);
        IDirectoryStore storeToUse = scenario == "failed"
            ? new FailingDirectoryStore()
            : store;

        var logger = new CapturingLogger();
        var uc = new MarkDeparted(session, storeToUse);

        await DirectoryEndpoints.MarkDepartedEndpoint(uc, SecretBoardRef, logger, default);

        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretBoardRef, line));
    }
```

- [ ] **Step 2: Run to verify GREEN**

```
dotnet test tests/Harmonia.UnitTests --filter "FullyQualifiedName~DirectoryLogExclusionTests"
```

Expected: All 12 tests PASS (4 EraseMyContact + 4 EraseContact + 4 MarkDeparted).

- [ ] **Step 3: Run full unit test suite**

```
dotnet test tests/Harmonia.UnitTests
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```
git add tests/Harmonia.UnitTests/Api/DirectoryLogExclusionTests.cs
git commit -m "test: R3 log exclusion — householdRef never logged by MarkDepartedEndpoint"
```

---

## Task 9: Program.cs DI registrations and route mapping

Wires `MarkDeparted` and `PurgeExpiredContacts` into the composition root and adds the two new routes.

**Files:**
- Modify: `src/Harmonia.Api/Program.cs`

- [ ] **Step 1: Add DI registrations**

In `src/Harmonia.Api/Program.cs`, after `builder.Services.AddScoped<EraseContact>();`, append:

```csharp
builder.Services.AddScoped<MarkDeparted>();
builder.Services.AddScoped<PurgeExpiredContacts>();
```

- [ ] **Step 2: Add routes**

In `src/Harmonia.Api/Program.cs`, after the `app.MapDelete("/directory/{householdRef}/contact", ...)` block, append:

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

- [ ] **Step 3: Build**

```
dotnet build
```

Expected: Build SUCCEEDS.

- [ ] **Step 4: Run full test suite**

```
dotnet test tests/Harmonia.UnitTests
dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel"
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Api/Program.cs
git commit -m "feat: wire MarkDeparted and PurgeExpiredContacts routes in Program.cs"
```

---

## Self-Review

**Spec coverage check:**
- [x] T0: `HouseholdContact.DepartedAt` field
- [x] T1: `MarkDepartedResult`, `PurgeExpiredContactsResult`, `IDirectoryStore` two new methods, `FakeDirectoryStore` fakes, schema migration
- [x] T2: `MarkDeparted` use case + 6 unit tests
- [x] T3: `PurgeExpiredContacts` use case + 5 unit tests
- [x] T4: `SqlDirectoryStore.MarkDepartedAsync` + `ReadRow` ordinal 7 + 3 integration tests
- [x] T5: `SqlDirectoryStore.PurgeExpiredContactsAsync` + 3 integration tests
- [x] T6: `GetDirectory` ResidentView departure filter + 2 unit tests
- [x] T7: `DirectoryEntryFullDto.DepartedAt`, `ToFullDto` mapping, `MarkDepartedEndpoint`, `PurgeExpiredContactsEndpoint`, 7 endpoint unit tests
- [x] T8: R3 log exclusion theory for `MarkDepartedEndpoint` (4 scenarios)
- [x] T9: `Program.cs` DI + routes

**Constraints verified in plan:**
- R2: `MarkDeparted.ExecuteAsync` takes `householdRef` as `string` (from URL path, passed by endpoint), never from request body
- R3: `householdRef` never passed to `ILogger` in endpoint or use-case layer — enforced by T8 tests
- Ordinal safety: `DepartedAt` at position 7 — T0 uses placeholder `null`, T4 updates to `r.GetDateTimeOffset(7)`; `UpdatedAt` remains at 6
- `SYSUTCDATETIMEOFFSET()` in both SQL statements — explicitly noted in T4 and T5
- Idempotent schema migration — `IF COL_LENGTH(...)` guard in T1
- XML doc comments on all new public types and methods — included in the code blocks
