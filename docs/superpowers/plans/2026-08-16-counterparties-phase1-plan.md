# Counterparties + Finance-Screen Reorg — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only Counterparties CRUD entity (backend + React + Angular management screens) and restructure navigation into an "Administration" group (Counterparties + Households + Pending Activations), purely additively — without touching `AssociationExpenses`.

**Architecture:** Mirror the existing layered pattern exactly — pure `Counterparty` domain record → `Harmonia.Application.Counterparties` use cases + ports (discriminated-union results) → `SqlCounterpartyStore` ADO.NET adapter → `CounterpartyEndpoints` minimal-API. Frontend mirrors `HouseholdsScreen.tsx` (React) and `directory-list.component.ts` (Angular). Nav is regrouped once, in a new shared Angular `<app-nav/>` and in React's `App.tsx`.

**Tech Stack:** .NET 8 minimal API, `Microsoft.Data.SqlClient` (raw ADO.NET), xUnit; React 18 + MUI 9 + react-i18next + Jest; Angular 20/21 + PrimeNG 22 + @ngx-translate + Vitest.

---

## Context

The spec (`docs/superpowers/specs/2026-08-12-counterparties-finance-reorg-design.md`) defines two phases. **Phase 2** — the destructive `AssociationExpenses` migration (TRUNCATE + drop `Category`/`ParentCategory` + add `CounterpartyId` FK), the expense-endpoint changes, and the finance-screen tab reorganisation — is **out of scope here**. This plan is **Phase 1 only**: it introduces the `Counterparties` entity and its screens, plus the nav restructure, all additively. Phase 1 must land first because the Phase 2 bill form depends on counterparties existing.

Two forward-compatibility decisions carried in from design review:
1. **DELETE → 409 "has bills" is wired now but unreachable in Phase 1.** The `CounterpartyId` FK column arrives in Phase 2, so `SqlCounterpartyStore.DeleteAsync` must **not** query a `CounterpartyId` column yet — it deletes unconditionally (0 bills). The `HasBills` DU case, the 409 endpoint mapping, and the UI 409 handler are all built now so Phase 2 only flips the store's bill-count query on.
2. **Two navigation gaps found during exploration:** (a) React nav is currently a **flat** `<Tabs>` strip, not a grouped menu; (b) Angular has **no** Households screen at all and duplicates an inline `harmonia-header` across ~10 components. So this plan also **extracts a shared Angular `<app-nav/>`** (behaviour-preserving) before adding the grouped menu, and **ports the Households screen to Angular** for parity with React.

`Counterparty.Id` is a `Guid` (no `/`), so — unlike `householdRef` — it is safe as a real path segment: `/counterparties/{id}`.

---

## Part A — Backend: Counterparties CRUD (TDD)

### File structure (Part A)

| Layer | File | Responsibility |
|-------|------|----------------|
| Domain | Create `src/Harmonia.Domain/Counterparties/Counterparty.cs` | Pure record |
| Application | Create `src/Harmonia.Application/Counterparties/Ports.cs` | `ICounterpartyStore` + result DUs |
| Application | Create `src/Harmonia.Application/Counterparties/{ListCounterparties,CreateCounterparty,GetCounterparty,UpdateCounterparty,DeleteCounterparty}.cs` | Admin-gated use cases |
| Api | Create `src/Harmonia.Api/Adapters/SqlCounterpartyStore.cs` | ADO.NET adapter |
| Api | Create `src/Harmonia.Api/Counterparties/CounterpartyEndpoints.cs` | Minimal-API handlers + DTOs |
| Api | Modify `src/Harmonia.Api/Program.cs` | DI + endpoint mapping |
| DB | Modify `db/schema.sql` | Additive `dbo.Counterparties` table |
| Tests | Modify `tests/Harmonia.UnitTests/Fakes.cs` | `FakeCounterpartyStore` + `FailingCounterpartyStore` |
| Tests | Create `tests/Harmonia.UnitTests/Counterparties/CounterpartyUseCaseTests.cs` + `Api/CounterpartyEndpointsTests.cs` | Unit tests |
| Tests | Create `tests/Harmonia.IntegrationTests/SqlCounterpartyStoreTests.cs` | Real-SQL round-trips |

Value shape used everywhere: `Counterparty(Guid Id, string Name, string Category, string ParentCategory, string? VatNumber, string? Phone, string? Email, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)`.

---

### Task A1: Domain record

**Files:** Create `src/Harmonia.Domain/Counterparties/Counterparty.cs`

- [ ] **Step 1: Write the record** (no test needed — pure data record, mirrors `AssociationExpense.cs`)

```csharp
namespace Harmonia.Domain.Counterparties;

public sealed record Counterparty(
    Guid           Id,
    string         Name,
    string         Category,
    string         ParentCategory,
    string?        VatNumber,
    string?        Phone,
    string?        Email,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
```

- [ ] **Step 2: Build** — Run: `dotnet build src/Harmonia.Domain/Harmonia.Domain.csproj` — Expected: PASS.
- [ ] **Step 3: Commit** — `git add src/Harmonia.Domain/Counterparties/Counterparty.cs && git commit -m "feat(counterparties): add Counterparty domain record"`

---

### Task A2: Application ports (ICounterpartyStore + result DUs)

**Files:** Create `src/Harmonia.Application/Counterparties/Ports.cs`

- [ ] **Step 1: Write ports** (mirrors `Expenses/Ports.cs` + `Households/Ports.cs`)

```csharp
using Harmonia.Domain.Counterparties;

namespace Harmonia.Application.Counterparties;

public interface ICounterpartyStore
{
    Task<IReadOnlyList<Counterparty>> ListAsync(CancellationToken ct = default);
    Task<Counterparty?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Counterparty> CreateAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default);
    Task<UpdateCounterpartyStoreResult> UpdateAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default);
    Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default);
}

// Store-level results (no auth concept — the use case owns Refused).
public abstract record UpdateCounterpartyStoreResult
{
    private UpdateCounterpartyStoreResult() { }
    public sealed record Ok(Counterparty Counterparty) : UpdateCounterpartyStoreResult;
    public sealed record NotFound                        : UpdateCounterpartyStoreResult;
}

public abstract record DeleteCounterpartyStoreResult
{
    private DeleteCounterpartyStoreResult() { }
    public sealed record Ok       : DeleteCounterpartyStoreResult;
    public sealed record HasBills : DeleteCounterpartyStoreResult; // Phase 2 activates this; Phase 1 never returns it.
    public sealed record NotFound : DeleteCounterpartyStoreResult;
}

// Use-case-level results (include Refused for the admin gate + Failed for infra errors).
public abstract record ListCounterpartiesResult
{
    private ListCounterpartiesResult() { }
    public sealed record Refused                                     : ListCounterpartiesResult;
    public sealed record Ok(IReadOnlyList<Counterparty> Counterparties) : ListCounterpartiesResult;
    public sealed record Failed                                      : ListCounterpartiesResult;
}

public abstract record CreateCounterpartyResult
{
    private CreateCounterpartyResult() { }
    public sealed record Refused                          : CreateCounterpartyResult;
    public sealed record Created(Counterparty Counterparty) : CreateCounterpartyResult;
    public sealed record Failed                           : CreateCounterpartyResult;
}

public abstract record GetCounterpartyResult
{
    private GetCounterpartyResult() { }
    public sealed record Refused                      : GetCounterpartyResult;
    public sealed record Ok(Counterparty Counterparty) : GetCounterpartyResult;
    public sealed record NotFound                     : GetCounterpartyResult;
    public sealed record Failed                       : GetCounterpartyResult;
}

public abstract record UpdateCounterpartyResult
{
    private UpdateCounterpartyResult() { }
    public sealed record Refused                      : UpdateCounterpartyResult;
    public sealed record Ok(Counterparty Counterparty) : UpdateCounterpartyResult;
    public sealed record NotFound                     : UpdateCounterpartyResult;
    public sealed record Failed                       : UpdateCounterpartyResult;
}

public abstract record DeleteCounterpartyResult
{
    private DeleteCounterpartyResult() { }
    public sealed record Refused  : DeleteCounterpartyResult;
    public sealed record Ok       : DeleteCounterpartyResult;
    public sealed record HasBills : DeleteCounterpartyResult;
    public sealed record NotFound : DeleteCounterpartyResult;
    public sealed record Failed   : DeleteCounterpartyResult;
}
```

- [ ] **Step 2: Build** — `dotnet build src/Harmonia.Application/Harmonia.Application.csproj` — Expected: PASS.
- [ ] **Step 3: Commit** — `git add src/Harmonia.Application/Counterparties/Ports.cs && git commit -m "feat(counterparties): add application ports and result unions"`

---

### Task A3: Use cases (admin-gated)

**Files:** Create the five files under `src/Harmonia.Application/Counterparties/`. Each mirrors `Households/GetHouseholds.cs` + `Households/DeleteHousehold.cs`: admin gate first, then `try { ... } catch (OperationCanceledException) { throw; } catch (Exception) { return Failed; }`.

- [ ] **Step 1: Write the five use cases**

`ListCounterparties.cs`:
```csharp
namespace Harmonia.Application.Counterparties;

public sealed class ListCounterparties(ISession session, ICounterpartyStore store)
{
    public async Task<ListCounterpartiesResult> ExecuteAsync(CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new ListCounterpartiesResult.Refused();
        try
        {
            return new ListCounterpartiesResult.Ok(await store.ListAsync(ct));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new ListCounterpartiesResult.Failed(); }
    }
}
```

`CreateCounterparty.cs`:
```csharp
namespace Harmonia.Application.Counterparties;

public sealed class CreateCounterparty(ISession session, ICounterpartyStore store)
{
    public async Task<CreateCounterpartyResult> ExecuteAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new CreateCounterpartyResult.Refused();
        try
        {
            var created = await store.CreateAsync(name, category, parentCategory, vatNumber, phone, email, ct);
            return new CreateCounterpartyResult.Created(created);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new CreateCounterpartyResult.Failed(); }
    }
}
```

`GetCounterparty.cs`:
```csharp
namespace Harmonia.Application.Counterparties;

public sealed class GetCounterparty(ISession session, ICounterpartyStore store)
{
    public async Task<GetCounterpartyResult> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new GetCounterpartyResult.Refused();
        try
        {
            var found = await store.GetAsync(id, ct);
            return found is null
                ? new GetCounterpartyResult.NotFound()
                : new GetCounterpartyResult.Ok(found);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new GetCounterpartyResult.Failed(); }
    }
}
```

`UpdateCounterparty.cs`:
```csharp
namespace Harmonia.Application.Counterparties;

public sealed class UpdateCounterparty(ISession session, ICounterpartyStore store)
{
    public async Task<UpdateCounterpartyResult> ExecuteAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new UpdateCounterpartyResult.Refused();
        try
        {
            return await store.UpdateAsync(id, name, category, parentCategory, vatNumber, phone, email, ct) switch
            {
                UpdateCounterpartyStoreResult.Ok ok    => new UpdateCounterpartyResult.Ok(ok.Counterparty),
                UpdateCounterpartyStoreResult.NotFound => new UpdateCounterpartyResult.NotFound(),
                _                                       => new UpdateCounterpartyResult.Failed()
            };
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new UpdateCounterpartyResult.Failed(); }
    }
}
```

`DeleteCounterparty.cs`:
```csharp
namespace Harmonia.Application.Counterparties;

public sealed class DeleteCounterparty(ISession session, ICounterpartyStore store)
{
    public async Task<DeleteCounterpartyResult> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new DeleteCounterpartyResult.Refused();
        try
        {
            return await store.DeleteAsync(id, ct) switch
            {
                DeleteCounterpartyStoreResult.Ok       => new DeleteCounterpartyResult.Ok(),
                DeleteCounterpartyStoreResult.HasBills => new DeleteCounterpartyResult.HasBills(),
                DeleteCounterpartyStoreResult.NotFound => new DeleteCounterpartyResult.NotFound(),
                _                                       => new DeleteCounterpartyResult.Failed()
            };
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new DeleteCounterpartyResult.Failed(); }
    }
}
```

- [ ] **Step 2: Build** — `dotnet build src/Harmonia.Application/Harmonia.Application.csproj` — Expected: PASS.
- [ ] **Step 3: Commit** — `git add src/Harmonia.Application/Counterparties && git commit -m "feat(counterparties): add admin-gated use cases"`

---

### Task A4: Fakes for unit tests

**Files:** Modify `tests/Harmonia.UnitTests/Fakes.cs`

- [ ] **Step 1: Add the `using` and two fakes** (append after `FailingExpenseStore`, ~line 122). Mirrors `FakeExpenseStore`/`FailingExpenseStore`.

Add to the `using` block at top (after `using Harmonia.Application.Expenses;`):
```csharp
using Harmonia.Application.Counterparties;
using Harmonia.Domain.Counterparties;
```

Append these classes:
```csharp
public sealed class FakeCounterpartyStore : ICounterpartyStore
{
    private readonly Dictionary<Guid, Counterparty> _byId = [];

    // Phase 1: no bills FK exists yet, so nothing is ever "in use". Flip to true in a
    // specific test to exercise the HasBills path without a real FK.
    public HashSet<Guid> WithBills { get; } = [];

    public Task<IReadOnlyList<Counterparty>> ListAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<Counterparty>>(
            _byId.Values.OrderBy(c => c.Name).ToList());

    public Task<Counterparty?> GetAsync(Guid id, CancellationToken ct = default)
    {
        _byId.TryGetValue(id, out var cp);
        return Task.FromResult(cp);
    }

    public Task<Counterparty> CreateAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var cp = new Counterparty(Guid.NewGuid(), name, category, parentCategory, vatNumber, phone, email, now, now);
        _byId[cp.Id] = cp;
        return Task.FromResult(cp);
    }

    public Task<UpdateCounterpartyStoreResult> UpdateAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        if (!_byId.TryGetValue(id, out var existing))
            return Task.FromResult<UpdateCounterpartyStoreResult>(new UpdateCounterpartyStoreResult.NotFound());
        var updated = existing with
        {
            Name = name, Category = category, ParentCategory = parentCategory,
            VatNumber = vatNumber, Phone = phone, Email = email, UpdatedAt = DateTimeOffset.UtcNow
        };
        _byId[id] = updated;
        return Task.FromResult<UpdateCounterpartyStoreResult>(new UpdateCounterpartyStoreResult.Ok(updated));
    }

    public Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        if (!_byId.ContainsKey(id))
            return Task.FromResult<DeleteCounterpartyStoreResult>(new DeleteCounterpartyStoreResult.NotFound());
        if (WithBills.Contains(id))
            return Task.FromResult<DeleteCounterpartyStoreResult>(new DeleteCounterpartyStoreResult.HasBills());
        _byId.Remove(id);
        return Task.FromResult<DeleteCounterpartyStoreResult>(new DeleteCounterpartyStoreResult.Ok());
    }
}

public sealed class FailingCounterpartyStore : ICounterpartyStore
{
    public Task<IReadOnlyList<Counterparty>> ListAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<Counterparty?> GetAsync(Guid id, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<Counterparty> CreateAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<UpdateCounterpartyStoreResult> UpdateAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
}
```

- [ ] **Step 2: Build tests project** — `dotnet build tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj` — Expected: PASS.
- [ ] **Step 3: Commit** — `git add tests/Harmonia.UnitTests/Fakes.cs && git commit -m "test(counterparties): add fake and failing stores"`

---

### Task A5: Use-case unit tests

**Files:** Create `tests/Harmonia.UnitTests/Counterparties/CounterpartyUseCaseTests.cs`

- [ ] **Step 1: Write failing tests** (covers admin gate, happy paths, NotFound, HasBills, Failed)

```csharp
using Harmonia.Application;
using Harmonia.Application.Counterparties;
using Xunit;

namespace Harmonia.UnitTests.Counterparties;

public sealed class CounterpartyUseCaseTests
{
    private static FakeSession Admin()    => new(new SessionContext(IsResident: false, IsAdmin: true,  HouseholdRef: null));
    private static FakeSession Resident() => new(new SessionContext(IsResident: true,  IsAdmin: false, HouseholdRef: "X3 АП1"));
    private static FakeSession Anon()      => new(null);

    // ── List ──
    [Fact]
    public async Task List_as_admin_returns_ok()
    {
        var store = new FakeCounterpartyStore();
        await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        var result = await new ListCounterparties(Admin(), store).ExecuteAsync();
        var ok = Assert.IsType<ListCounterpartiesResult.Ok>(result);
        Assert.Single(ok.Counterparties);
    }

    [Fact]
    public async Task List_as_resident_is_refused()
        => Assert.IsType<ListCounterpartiesResult.Refused>(
            await new ListCounterparties(Resident(), new FakeCounterpartyStore()).ExecuteAsync());

    [Fact]
    public async Task List_without_session_is_refused()
        => Assert.IsType<ListCounterpartiesResult.Refused>(
            await new ListCounterparties(Anon(), new FakeCounterpartyStore()).ExecuteAsync());

    [Fact]
    public async Task List_when_store_throws_returns_failed()
        => Assert.IsType<ListCounterpartiesResult.Failed>(
            await new ListCounterparties(Admin(), new FailingCounterpartyStore()).ExecuteAsync());

    // ── Create ──
    [Fact]
    public async Task Create_as_admin_returns_created()
    {
        var result = await new CreateCounterparty(Admin(), new FakeCounterpartyStore())
            .ExecuteAsync("PowerCo", "Electricity", "Utilities", "BG123", "+359", "b@p.bg");
        var created = Assert.IsType<CreateCounterpartyResult.Created>(result);
        Assert.Equal("PowerCo", created.Counterparty.Name);
        Assert.NotEqual(System.Guid.Empty, created.Counterparty.Id);
    }

    [Fact]
    public async Task Create_as_resident_is_refused()
        => Assert.IsType<CreateCounterpartyResult.Refused>(
            await new CreateCounterparty(Resident(), new FakeCounterpartyStore())
                .ExecuteAsync("X", "Y", "Z", null, null, null));

    [Fact]
    public async Task Create_when_store_throws_returns_failed()
        => Assert.IsType<CreateCounterpartyResult.Failed>(
            await new CreateCounterparty(Admin(), new FailingCounterpartyStore())
                .ExecuteAsync("X", "Y", "Z", null, null, null));

    // ── Get ──
    [Fact]
    public async Task Get_missing_returns_not_found()
        => Assert.IsType<GetCounterpartyResult.NotFound>(
            await new GetCounterparty(Admin(), new FakeCounterpartyStore()).ExecuteAsync(System.Guid.NewGuid()));

    [Fact]
    public async Task Get_existing_returns_ok()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        var ok = Assert.IsType<GetCounterpartyResult.Ok>(
            await new GetCounterparty(Admin(), store).ExecuteAsync(cp.Id));
        Assert.Equal(cp.Id, ok.Counterparty.Id);
    }

    // ── Update ──
    [Fact]
    public async Task Update_existing_returns_ok_with_new_values()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("Old", "Electricity", "Utilities", null, null, null);
        var ok = Assert.IsType<UpdateCounterpartyResult.Ok>(
            await new UpdateCounterparty(Admin(), store)
                .ExecuteAsync(cp.Id, "New", "Water", "Utilities", "BG9", null, null));
        Assert.Equal("New", ok.Counterparty.Name);
        Assert.Equal("Water", ok.Counterparty.Category);
    }

    [Fact]
    public async Task Update_missing_returns_not_found()
        => Assert.IsType<UpdateCounterpartyResult.NotFound>(
            await new UpdateCounterparty(Admin(), new FakeCounterpartyStore())
                .ExecuteAsync(System.Guid.NewGuid(), "N", "C", "P", null, null, null));

    [Fact]
    public async Task Update_as_resident_is_refused()
        => Assert.IsType<UpdateCounterpartyResult.Refused>(
            await new UpdateCounterparty(Resident(), new FakeCounterpartyStore())
                .ExecuteAsync(System.Guid.NewGuid(), "N", "C", "P", null, null, null));

    // ── Delete ──
    [Fact]
    public async Task Delete_existing_returns_ok()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        Assert.IsType<DeleteCounterpartyResult.Ok>(
            await new DeleteCounterparty(Admin(), store).ExecuteAsync(cp.Id));
    }

    [Fact]
    public async Task Delete_missing_returns_not_found()
        => Assert.IsType<DeleteCounterpartyResult.NotFound>(
            await new DeleteCounterparty(Admin(), new FakeCounterpartyStore()).ExecuteAsync(System.Guid.NewGuid()));

    [Fact]
    public async Task Delete_with_bills_returns_has_bills()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        store.WithBills.Add(cp.Id);
        Assert.IsType<DeleteCounterpartyResult.HasBills>(
            await new DeleteCounterparty(Admin(), store).ExecuteAsync(cp.Id));
    }

    [Fact]
    public async Task Delete_as_resident_is_refused()
        => Assert.IsType<DeleteCounterpartyResult.Refused>(
            await new DeleteCounterparty(Resident(), new FakeCounterpartyStore()).ExecuteAsync(System.Guid.NewGuid()));
}
```

- [ ] **Step 2: Run — verify FAIL** — `dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~CounterpartyUseCaseTests"` — Expected: compile PASS (use cases exist from A3), all tests PASS. (If any fail, fix the use case, not the test.)
- [ ] **Step 3: Commit** — `git add tests/Harmonia.UnitTests/Counterparties && git commit -m "test(counterparties): use-case unit tests"`

> Note: A3 was written before its tests here (record/DU scaffolding first). If you prefer strict red-green, comment out A3 bodies to `throw new NotImplementedException()`, watch red, then restore — but the DU/gate pattern is copied verbatim from a proven use case, so straight-to-green is acceptable per the existing repo convention.

---

### Task A6: SqlCounterpartyStore adapter

**Files:** Create `src/Harmonia.Api/Adapters/SqlCounterpartyStore.cs`

- [ ] **Step 1: Write the adapter** (mirrors `SqlHouseholdStore.cs`; per-method `SqlConnection`, ordinal reads via private `ReadRow`). **Phase 1 `DeleteAsync` never references a `CounterpartyId` column** — it deletes unconditionally.

```csharp
using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Counterparties;
using Harmonia.Domain.Counterparties;

namespace Harmonia.Api.Adapters;

public sealed class SqlCounterpartyStore(string connectionString) : ICounterpartyStore
{
    private const string SelectColumns =
        "Id, Name, Category, ParentCategory, VatNumber, Phone, Email, CreatedAt, UpdatedAt";

    public async Task<IReadOnlyList<Counterparty>> ListAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT {SelectColumns} FROM dbo.Counterparties ORDER BY Name ASC;";
        var results = new List<Counterparty>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    public async Task<Counterparty?> GetAsync(Guid id, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT {SelectColumns} FROM dbo.Counterparties WHERE Id = @Id;";
        cmd.Parameters.AddWithValue("@Id", id);
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadRow(reader) : null;
    }

    public async Task<Counterparty> CreateAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var cp = new Counterparty(Guid.NewGuid(), name, category, parentCategory, vatNumber, phone, email, now, now);
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO dbo.Counterparties
                (Id, Name, Category, ParentCategory, VatNumber, Phone, Email, CreatedAt, UpdatedAt)
            VALUES
                (@Id, @Name, @Category, @ParentCategory, @VatNumber, @Phone, @Email, @CreatedAt, @UpdatedAt);
            """;
        BindWriteParams(cmd, cp);
        await cmd.ExecuteNonQueryAsync(ct);
        return cp;
    }

    public async Task<UpdateCounterpartyStoreResult> UpdateAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE dbo.Counterparties
            SET Name = @Name, Category = @Category, ParentCategory = @ParentCategory,
                VatNumber = @VatNumber, Phone = @Phone, Email = @Email, UpdatedAt = @UpdatedAt
            OUTPUT inserted.Id, inserted.Name, inserted.Category, inserted.ParentCategory,
                   inserted.VatNumber, inserted.Phone, inserted.Email, inserted.CreatedAt, inserted.UpdatedAt
            WHERE Id = @Id;
            """;
        cmd.Parameters.AddWithValue("@Id", id);
        cmd.Parameters.AddWithValue("@Name", name);
        cmd.Parameters.AddWithValue("@Category", category);
        cmd.Parameters.AddWithValue("@ParentCategory", parentCategory);
        cmd.Parameters.Add(new SqlParameter("@VatNumber", SqlDbType.NVarChar) { Value = (object?)vatNumber ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar) { Value = (object?)phone ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar) { Value = (object?)email ?? DBNull.Value });
        cmd.Parameters.AddWithValue("@UpdatedAt", DateTimeOffset.UtcNow);
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new UpdateCounterpartyStoreResult.Ok(ReadRow(reader))
            : new UpdateCounterpartyStoreResult.NotFound();
    }

    // Phase 1: no CounterpartyId FK on AssociationExpenses yet, so nothing can reference a counterparty.
    // Delete is unconditional here. Phase 2 adds a "has bills" pre-check that returns HasBills.
    public async Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM dbo.Counterparties WHERE Id = @Id;";
        cmd.Parameters.AddWithValue("@Id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return rows == 0
            ? new DeleteCounterpartyStoreResult.NotFound()
            : new DeleteCounterpartyStoreResult.Ok();
    }

    private static void BindWriteParams(SqlCommand cmd, Counterparty cp)
    {
        cmd.Parameters.AddWithValue("@Id", cp.Id);
        cmd.Parameters.AddWithValue("@Name", cp.Name);
        cmd.Parameters.AddWithValue("@Category", cp.Category);
        cmd.Parameters.AddWithValue("@ParentCategory", cp.ParentCategory);
        cmd.Parameters.Add(new SqlParameter("@VatNumber", SqlDbType.NVarChar) { Value = (object?)cp.VatNumber ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar) { Value = (object?)cp.Phone ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar) { Value = (object?)cp.Email ?? DBNull.Value });
        cmd.Parameters.AddWithValue("@CreatedAt", cp.CreatedAt);
        cmd.Parameters.AddWithValue("@UpdatedAt", cp.UpdatedAt);
    }

    private static Counterparty ReadRow(SqlDataReader r) => new(
        r.GetGuid(0),
        r.GetString(1),
        r.GetString(2),
        r.GetString(3),
        r.IsDBNull(4) ? null : r.GetString(4),
        r.IsDBNull(5) ? null : r.GetString(5),
        r.IsDBNull(6) ? null : r.GetString(6),
        r.GetDateTimeOffset(7),
        r.GetDateTimeOffset(8));
}
```

- [ ] **Step 2: Build** — `dotnet build src/Harmonia.Api/Harmonia.Api.csproj` — Expected: PASS.
- [ ] **Step 3: Commit** — `git add src/Harmonia.Api/Adapters/SqlCounterpartyStore.cs && git commit -m "feat(counterparties): SQL store adapter (Phase 1 unconditional delete)"`

---

### Task A7: schema.sql additive table

**Files:** Modify `db/schema.sql`

- [ ] **Step 1: Append after the `dbo.Households` block** (additive idiom — safe to re-run)

```sql
IF OBJECT_ID(N'dbo.Counterparties', N'U') IS NULL
CREATE TABLE dbo.Counterparties (
    Id             uniqueidentifier   NOT NULL,
    Name           nvarchar(256)      NOT NULL,
    Category       nvarchar(100)      NOT NULL,
    ParentCategory nvarchar(100)      NOT NULL,
    VatNumber      nvarchar(64)       NULL,
    Phone          nvarchar(32)       NULL,
    Email          nvarchar(320)      NULL,
    CreatedAt      datetimeoffset(3)  NOT NULL,
    UpdatedAt      datetimeoffset(3)  NOT NULL,
    CONSTRAINT PK_Counterparties PRIMARY KEY (Id)
);
```

- [ ] **Step 2: Commit** — `git add db/schema.sql && git commit -m "feat(counterparties): additive Counterparties table in schema.sql"`

---

### Task A8: CounterpartyEndpoints + Program.cs wiring

**Files:** Create `src/Harmonia.Api/Counterparties/CounterpartyEndpoints.cs`; Modify `src/Harmonia.Api/Program.cs`

- [ ] **Step 1: Write endpoints** (DTOs at top; `switch`-expression → TypedResults; DELETE→409 on HasBills; POST→201; PUT→200)

```csharp
using Microsoft.AspNetCore.Http;
using Harmonia.Application.Counterparties;
using Harmonia.Domain.Counterparties;

namespace Harmonia.Api.Counterparties;

public sealed record CounterpartyRequest(
    string  Name,
    string  Category,
    string  ParentCategory,
    string? VatNumber,
    string? Phone,
    string? Email);

public sealed record CounterpartyDto(
    Guid           Id,
    string         Name,
    string         Category,
    string         ParentCategory,
    string?        VatNumber,
    string?        Phone,
    string?        Email,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public static class CounterpartyEndpoints
{
    public static async Task<IResult> ListCounterpartiesEndpoint(
        ListCounterparties useCase, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        return result switch
        {
            ListCounterpartiesResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            ListCounterpartiesResult.Ok ok   => TypedResults.Ok(ok.Counterparties.Select(ToDto).ToList()),
            ListCounterpartiesResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> CreateCounterpartyEndpoint(
        CreateCounterparty useCase, CounterpartyRequest body, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            body.Name, body.Category, body.ParentCategory, body.VatNumber, body.Phone, body.Email, ct);
        return result switch
        {
            CreateCounterpartyResult.Refused        => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            CreateCounterpartyResult.Created created => TypedResults.Json(ToDto(created.Counterparty), statusCode: StatusCodes.Status201Created),
            CreateCounterpartyResult.Failed         => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                       => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> GetCounterpartyEndpoint(
        GetCounterparty useCase, Guid id, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(id, ct);
        return result switch
        {
            GetCounterpartyResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            GetCounterpartyResult.Ok ok    => TypedResults.Ok(ToDto(ok.Counterparty)),
            GetCounterpartyResult.NotFound => TypedResults.NotFound(),
            GetCounterpartyResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                              => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> UpdateCounterpartyEndpoint(
        UpdateCounterparty useCase, Guid id, CounterpartyRequest body, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            id, body.Name, body.Category, body.ParentCategory, body.VatNumber, body.Phone, body.Email, ct);
        return result switch
        {
            UpdateCounterpartyResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            UpdateCounterpartyResult.Ok ok    => TypedResults.Ok(ToDto(ok.Counterparty)),
            UpdateCounterpartyResult.NotFound => TypedResults.NotFound(),
            UpdateCounterpartyResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                 => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> DeleteCounterpartyEndpoint(
        DeleteCounterparty useCase, Guid id, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(id, ct);
        return result switch
        {
            DeleteCounterpartyResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            DeleteCounterpartyResult.Ok       => TypedResults.NoContent(),
            DeleteCounterpartyResult.HasBills => TypedResults.StatusCode(StatusCodes.Status409Conflict),
            DeleteCounterpartyResult.NotFound => TypedResults.NotFound(),
            DeleteCounterpartyResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                 => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static CounterpartyDto ToDto(Counterparty c) => new(
        c.Id, c.Name, c.Category, c.ParentCategory, c.VatNumber, c.Phone, c.Email, c.CreatedAt, c.UpdatedAt);
}
```

- [ ] **Step 2: Wire Program.cs** — three edits:

(a) Add usings after line 5 (`using Harmonia.Application.Households;`):
```csharp
using Harmonia.Api.Counterparties;
using Harmonia.Application.Counterparties;
```

(b) Register the store — after line 52 (`AddSingleton<IHouseholdStore>...`):
```csharp
builder.Services.AddSingleton<ICounterpartyStore>(new SqlCounterpartyStore(defaultConn));
```

(c) Register use cases — after line 188 (`AddScoped<DeleteHousehold>();`):
```csharp
builder.Services.AddScoped<ListCounterparties>();
builder.Services.AddScoped<CreateCounterparty>();
builder.Services.AddScoped<GetCounterparty>();
builder.Services.AddScoped<UpdateCounterparty>();
builder.Services.AddScoped<DeleteCounterparty>();
```

(d) Map endpoints — after line 446 (the `/households/item` DELETE map), before `app.MapGet("/healthz"...)`:
```csharp
app.MapGet(
    "/counterparties",
    (ListCounterparties uc, CancellationToken ct) =>
        CounterpartyEndpoints.ListCounterpartiesEndpoint(uc, ct));

app.MapPost(
    "/counterparties",
    (CreateCounterparty uc, CounterpartyRequest body, CancellationToken ct) =>
        CounterpartyEndpoints.CreateCounterpartyEndpoint(uc, body, ct));

app.MapGet(
    "/counterparties/{id:guid}",
    (GetCounterparty uc, Guid id, CancellationToken ct) =>
        CounterpartyEndpoints.GetCounterpartyEndpoint(uc, id, ct));

app.MapPut(
    "/counterparties/{id:guid}",
    (UpdateCounterparty uc, Guid id, CounterpartyRequest body, CancellationToken ct) =>
        CounterpartyEndpoints.UpdateCounterpartyEndpoint(uc, id, body, ct));

app.MapDelete(
    "/counterparties/{id:guid}",
    (DeleteCounterparty uc, Guid id, CancellationToken ct) =>
        CounterpartyEndpoints.DeleteCounterpartyEndpoint(uc, id, ct));
```

- [ ] **Step 3: Build** — `dotnet build src/Harmonia.Api/Harmonia.Api.csproj` — Expected: PASS.
- [ ] **Step 4: Commit** — `git add src/Harmonia.Api/Counterparties src/Harmonia.Api/Program.cs && git commit -m "feat(counterparties): endpoints + DI wiring"`

---

### Task A9: Endpoint + integration tests

**Files:** Create `tests/Harmonia.UnitTests/Api/CounterpartyEndpointsTests.cs`; Create `tests/Harmonia.IntegrationTests/SqlCounterpartyStoreTests.cs`

- [ ] **Step 1: Endpoint unit tests** (call the static endpoint method directly; assert status via `IStatusCodeHttpResult`)

```csharp
using Harmonia.Api.Counterparties;
using Harmonia.Application;
using Harmonia.Application.Counterparties;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Harmonia.UnitTests.Api;

public sealed class CounterpartyEndpointsTests
{
    private static FakeSession Admin()    => new(new SessionContext(IsResident: false, IsAdmin: true,  HouseholdRef: null));
    private static FakeSession Resident() => new(new SessionContext(IsResident: true,  IsAdmin: false, HouseholdRef: "X3 АП1"));
    private static CounterpartyRequest Req() => new("PowerCo", "Electricity", "Utilities", "BG123", "+359", "b@p.bg");

    private static int Status(IResult r)
        => Assert.IsAssignableFrom<IStatusCodeHttpResult>(r).StatusCode ?? 0;

    [Fact]
    public async Task Create_as_admin_returns_201()
    {
        var uc = new CreateCounterparty(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.CreateCounterpartyEndpoint(uc, Req(), default);
        Assert.Equal(StatusCodes.Status201Created, Status(result));
    }

    [Fact]
    public async Task Create_as_resident_returns_403()
    {
        var uc = new CreateCounterparty(Resident(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.CreateCounterpartyEndpoint(uc, Req(), default);
        Assert.Equal(StatusCodes.Status403Forbidden, Status(result));
    }

    [Fact]
    public async Task List_as_admin_returns_200()
    {
        var uc = new ListCounterparties(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.ListCounterpartiesEndpoint(uc, default);
        Assert.Equal(StatusCodes.Status200OK, Status(result));
    }

    [Fact]
    public async Task List_as_resident_returns_403()
    {
        var uc = new ListCounterparties(Resident(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.ListCounterpartiesEndpoint(uc, default);
        Assert.Equal(StatusCodes.Status403Forbidden, Status(result));
    }

    [Fact]
    public async Task Get_missing_returns_404()
    {
        var uc = new GetCounterparty(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.GetCounterpartyEndpoint(uc, System.Guid.NewGuid(), default);
        Assert.Equal(StatusCodes.Status404NotFound, Status(result));
    }

    [Fact]
    public async Task Update_missing_returns_404()
    {
        var uc = new UpdateCounterparty(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.UpdateCounterpartyEndpoint(uc, System.Guid.NewGuid(), Req(), default);
        Assert.Equal(StatusCodes.Status404NotFound, Status(result));
    }

    [Fact]
    public async Task Delete_existing_returns_204()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        var uc = new DeleteCounterparty(Admin(), store);
        var result = await CounterpartyEndpoints.DeleteCounterpartyEndpoint(uc, cp.Id, default);
        Assert.Equal(StatusCodes.Status204NoContent, Status(result));
    }

    [Fact]
    public async Task Delete_with_bills_returns_409()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        store.WithBills.Add(cp.Id);
        var uc = new DeleteCounterparty(Admin(), store);
        var result = await CounterpartyEndpoints.DeleteCounterpartyEndpoint(uc, cp.Id, default);
        Assert.Equal(StatusCodes.Status409Conflict, Status(result));
    }

    [Fact]
    public async Task Delete_missing_returns_404()
    {
        var uc = new DeleteCounterparty(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.DeleteCounterpartyEndpoint(uc, System.Guid.NewGuid(), default);
        Assert.Equal(StatusCodes.Status404NotFound, Status(result));
    }
}
```

- [ ] **Step 2: Integration tests** (Rel tier — real SQL Server; mirrors `SqlExpenseStoreTests.cs`, `[Collection("Database")]`, `[Trait("Category","Rel")]`)

```csharp
using Harmonia.Api.Adapters;
using Harmonia.Application.Counterparties;
using Xunit;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public sealed class SqlCounterpartyStoreTests(SqlServerFixture db)
{
    private SqlCounterpartyStore Store() => new(db.ConnectionString);

    [Fact]
    public async Task Create_then_Get_round_trips()
    {
        var store = Store();
        var name = $"rel-cp-{Guid.NewGuid():N}";
        var created = await store.CreateAsync(name, "Electricity", "Utilities", "BG123", "+359", "b@p.bg");

        var fetched = await store.GetAsync(created.Id);
        Assert.NotNull(fetched);
        Assert.Equal(name, fetched!.Name);
        Assert.Equal("Electricity", fetched.Category);
        Assert.Equal("BG123", fetched.VatNumber);
    }

    [Fact]
    public async Task List_includes_created()
    {
        var store = Store();
        var name = $"rel-cp-{Guid.NewGuid():N}";
        await store.CreateAsync(name, "Water", "Utilities", null, null, null);
        var all = await store.ListAsync();
        Assert.Contains(all, c => c.Name == name);
    }

    [Fact]
    public async Task Update_changes_values_and_returns_ok()
    {
        var store = Store();
        var created = await store.CreateAsync($"rel-cp-{Guid.NewGuid():N}", "Old", "Utilities", null, null, null);
        var newName = $"rel-cp-{Guid.NewGuid():N}";
        var result = await store.UpdateAsync(created.Id, newName, "Water", "Utilities", "BG9", "+1", "n@n.bg");
        var ok = Assert.IsType<UpdateCounterpartyStoreResult.Ok>(result);
        Assert.Equal(newName, ok.Counterparty.Name);
        Assert.Equal("Water", ok.Counterparty.Category);
    }

    [Fact]
    public async Task Update_missing_returns_not_found()
    {
        var result = await Store().UpdateAsync(Guid.NewGuid(), "N", "C", "P", null, null, null);
        Assert.IsType<UpdateCounterpartyStoreResult.NotFound>(result);
    }

    [Fact]
    public async Task Delete_removes_row()
    {
        var store = Store();
        var created = await store.CreateAsync($"rel-cp-{Guid.NewGuid():N}", "Electricity", "Utilities", null, null, null);
        Assert.IsType<DeleteCounterpartyStoreResult.Ok>(await store.DeleteAsync(created.Id));
        Assert.Null(await store.GetAsync(created.Id));
    }

    [Fact]
    public async Task Delete_missing_returns_not_found()
        => Assert.IsType<DeleteCounterpartyStoreResult.NotFound>(await Store().DeleteAsync(Guid.NewGuid()));
}
```

- [ ] **Step 3: Run unit tests — verify PASS** — `dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~Counterparty"` — Expected: all PASS.
- [ ] **Step 4: Run integration tests against real SQL** — set `HARMONIA_SQL_CONNSTR` then `dotnet test tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj --filter "Category=Rel&FullyQualifiedName~Counterparty"` — Expected: all PASS (fixture applies `schema.sql`, creating `dbo.Counterparties`).
- [ ] **Step 5: Commit** — `git add tests/Harmonia.UnitTests/Api/CounterpartyEndpointsTests.cs tests/Harmonia.IntegrationTests/SqlCounterpartyStoreTests.cs && git commit -m "test(counterparties): endpoint + integration tests"`

---

## Part B — React: Counterparties screen + Administration menu

### File structure (Part B)

| File | Responsibility |
|------|----------------|
| Create `ui/react/src/api/counterparties.ts` | Typed API client |
| Create `ui/react/src/components/CounterpartiesScreen.tsx` | MUI CRUD screen (mirrors `HouseholdsScreen.tsx`) |
| Modify `ui/react/src/App.tsx` | `'counterparties'` screen + Administration menu |

---

### Task B1: React API client

**Files:** Create `ui/react/src/api/counterparties.ts` (mirrors `api/households.ts`; 409 surfaces as an error with `status`)

- [ ] **Step 1: Write client**

```typescript
import { API_BASE, apiFetch } from './config';

export interface CounterpartyDto {
  id: string;
  name: string;
  category: string;
  parentCategory: string;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CounterpartyInput {
  name: string;
  category: string;
  parentCategory: string;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
}

export async function getCounterparties(): Promise<CounterpartyDto[]> {
  const res = await apiFetch(`${API_BASE}/counterparties`);
  if (!res.ok) throw Object.assign(new Error(`GET /counterparties failed: ${res.status}`), { status: res.status });
  return res.json();
}

export async function createCounterparty(input: CounterpartyInput): Promise<CounterpartyDto> {
  const res = await apiFetch(`${API_BASE}/counterparties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw Object.assign(new Error(`POST /counterparties failed: ${res.status}`), { status: res.status });
  return res.json();
}

export async function updateCounterparty(id: string, input: CounterpartyInput): Promise<CounterpartyDto> {
  const res = await apiFetch(`${API_BASE}/counterparties/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw Object.assign(new Error(`PUT /counterparties/${id} failed: ${res.status}`), { status: res.status });
  return res.json();
}

export async function deleteCounterparty(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/counterparties/${id}`, { method: 'DELETE' });
  if (res.status === 204) return;
  throw Object.assign(new Error(`DELETE /counterparties/${id} failed: ${res.status}`), { status: res.status });
}
```

- [ ] **Step 2: Commit** — `git add ui/react/src/api/counterparties.ts && git commit -m "feat(react): counterparties API client"`

---

### Task B2: React CounterpartiesScreen

**Files:** Create `ui/react/src/components/CounterpartiesScreen.tsx`

Read `ui/react/src/components/HouseholdsScreen.tsx` first — this component copies its structure (MUI `Table`, add/edit dialog with the same `TextField`/`Dialog` layout, delete-confirm dialog, `showToast`, loading/error states). The differences from HouseholdsScreen:
- Columns: **Name · Category · ParentCategory · VAT · Phone · Email · Edit · Delete** (no `HouseholdRefPicker`, no directory-name join).
- Form fields: `name`, `category`, `parentCategory` (required text) + `vatNumber`, `phone`, `email` (optional text). No `sqMeters` number field, no ref picker.
- Add and Edit share one dialog driven by an `editing: CounterpartyDto | null` + `form: CounterpartyInput` state.
- **Delete confirm handles 409:** on `deleteCounterparty` catch, if `err.status === 409` show `t('counterparties.deleteHasBills')` in the dialog instead of a generic error toast.

- [ ] **Step 1: Write the component**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import {
  CounterpartyDto, CounterpartyInput,
  getCounterparties, createCounterparty, updateCounterparty, deleteCounterparty,
} from '../api/counterparties';

const EMPTY: CounterpartyInput = {
  name: '', category: '', parentCategory: '', vatNumber: '', phone: '', email: '',
};

function toInput(c: CounterpartyDto): CounterpartyInput {
  return {
    name: c.name, category: c.category, parentCategory: c.parentCategory,
    vatNumber: c.vatNumber ?? '', phone: c.phone ?? '', email: c.email ?? '',
  };
}

// Blank optional fields → null before send.
function normalise(input: CounterpartyInput): CounterpartyInput {
  return {
    name: input.name.trim(),
    category: input.category.trim(),
    parentCategory: input.parentCategory.trim(),
    vatNumber: input.vatNumber?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
  };
}

export default function CounterpartiesScreen() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CounterpartyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // add/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CounterpartyDto | null>(null);
  const [form, setForm] = useState<CounterpartyInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  // delete dialog
  const [deleting, setDeleting] = useState<CounterpartyDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const formValid = useMemo(
    () => form.name.trim() !== '' && form.category.trim() !== '' && form.parentCategory.trim() !== '',
    [form],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getCounterparties());
    } catch {
      setError(t('counterparties.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openAdd() { setEditing(null); setForm(EMPTY); setDialogOpen(true); }
  function openEdit(c: CounterpartyDto) { setEditing(c); setForm(toInput(c)); setDialogOpen(true); }

  async function save() {
    if (!formValid) return;
    setSaving(true);
    try {
      const payload = normalise(form);
      if (editing) await updateCounterparty(editing.id, payload);
      else await createCounterparty(payload);
      setDialogOpen(false);
      setToast(editing ? t('counterparties.updated') : t('counterparties.created'));
      await load();
    } catch {
      setToast(t('counterparties.saveError'));
    } finally {
      setSaving(false);
    }
  }

  function openDelete(c: CounterpartyDto) { setDeleting(c); setDeleteError(null); }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      await deleteCounterparty(deleting.id);
      setDeleting(null);
      setToast(t('counterparties.deleted'));
      await load();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setDeleteError(status === 409 ? t('counterparties.deleteHasBills') : t('counterparties.deleteError'));
    } finally {
      setDeletingBusy(false);
    }
  }

  const field = (key: keyof CounterpartyInput, required = false) => (
    <TextField
      label={t(`counterparties.${key}`)}
      value={form[key] ?? ''}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      required={required}
      fullWidth
      margin="dense"
    />
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>{t('counterparties.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>{t('counterparties.add')}</Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" action={<Button onClick={load}>{t('common.retry')}</Button>}>{error}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('counterparties.name')}</TableCell>
                <TableCell>{t('counterparties.category')}</TableCell>
                <TableCell>{t('counterparties.parentCategory')}</TableCell>
                <TableCell>{t('counterparties.vatNumber')}</TableCell>
                <TableCell>{t('counterparties.phone')}</TableCell>
                <TableCell>{t('counterparties.email')}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {t('counterparties.empty')}
                </TableCell></TableRow>
              ) : rows.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.category}</TableCell>
                  <TableCell>{c.parentCategory}</TableCell>
                  <TableCell>{c.vatNumber ?? '—'}</TableCell>
                  <TableCell>{c.phone ?? '—'}</TableCell>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => openEdit(c)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <IconButton size="small" color="error" onClick={() => openDelete(c)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? t('counterparties.editTitle') : t('counterparties.addTitle')}</DialogTitle>
        <DialogContent>
          {field('name', true)}
          {field('category', true)}
          {field('parentCategory', true)}
          {field('vatNumber')}
          {field('phone')}
          {field('email')}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={save} disabled={!formValid || saving}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* delete confirm */}
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('counterparties.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('counterparties.deleteConfirm', { name: deleting?.name })}</Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={deletingBusy}>
            {deletingBusy ? <CircularProgress size={20} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast(null)} message={toast ?? ''} />
    </Box>
  );
}
```

- [ ] **Step 2: Commit** — `git add ui/react/src/components/CounterpartiesScreen.tsx && git commit -m "feat(react): counterparties management screen"`

---

### Task B3: React Administration menu in App.tsx

**Files:** Modify `ui/react/src/App.tsx`

The current nav is a flat `<Tabs>` where `value={screen}`. Adding a grouped "Administration" dropdown means: when an admin sub-screen (`counterparties` / `households` / `admin-pending`) is active, the `<Tabs value>` must be a **sentinel** (`false`) so MUI doesn't warn about a value with no matching `<Tab>`.

- [ ] **Step 1: Add the screen + import**

Line 21 area — add import:
```tsx
import CounterpartiesScreen from './components/CounterpartiesScreen';
```

Line 31 — extend the `Screen` union:
```tsx
type Screen = 'directory' | 'reservations' | 'financial' | 'notifications' | 'privacy' | 'contact-edit' | 'admin-pending' | 'households' | 'counterparties';
```

Line 80 — add `'counterparties'` to `roleScreens`:
```tsx
const roleScreens: Screen[] = ['directory', 'financial', 'notifications', 'privacy', 'contact-edit', 'admin-pending', 'households', 'counterparties'];
```

- [ ] **Step 2: Add Administration state + menu.** Inside `MainApp`, after `const [profileAnchor, ...]` (line 78), add:
```tsx
const ADMIN_SCREENS: Screen[] = ['counterparties', 'households', 'admin-pending'];
const [adminAnchor, setAdminAnchor] = useState<null | HTMLElement>(null);
const adminActive = ADMIN_SCREENS.includes(screen);
```

- [ ] **Step 3: Replace the three admin tabs + the `value={screen}` binding.** In the `<Tabs>` (lines 132-168):

Change the value binding so an active admin sub-screen doesn't collide with the removed tabs:
```tsx
          <Tabs
            value={adminActive ? false : screen}
            onChange={(_, v) => setScreen(v)}
```

Remove the three standalone admin `<Tab>`s (the `admin-pending` badge Tab at 154-164, the `households` Tab at 165, and the `directory` Tab at 166). Keep Directory top-level for admins by leaving a Directory tab, but move Households + Pending Activations + Counterparties under an Administration button. Replace lines 154-166 with:
```tsx
            {initialRole === 'admin' && <Tab label={t('nav.directory')} value="directory" />}
            {initialRole === 'admin' && (
              <Tab
                label={
                  <Box
                    component="span"
                    onClick={(e: React.MouseEvent<HTMLElement>) => { e.stopPropagation(); setAdminAnchor(e.currentTarget); }}
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <Badge badgeContent={pendingCount} color="error" max={99} invisible={pendingCount === 0}
                      sx={{ '& .MuiBadge-badge': { right: -6, top: 4 } }}>
                      <span>{t('nav.administration')}</span>
                    </Badge>
                    <span aria-hidden>▾</span>
                  </Box>
                }
                value="__admin__"
              />
            )}
```

- [ ] **Step 4: Add the Administration `Menu`** just after the closing `</Tabs>` `</Box>` (before `</AppBar>`, line 170):
```tsx
        <Menu
          anchorEl={adminAnchor}
          open={Boolean(adminAnchor)}
          onClose={() => setAdminAnchor(null)}
          slotProps={{ paper: { sx: { minWidth: 220 } } }}
        >
          <MenuItem onClick={() => { setScreen('counterparties'); setAdminAnchor(null); }}>
            {t('nav.counterparties')}
          </MenuItem>
          <MenuItem onClick={() => { setScreen('households'); setAdminAnchor(null); }}>
            {t('nav.households')}
          </MenuItem>
          <MenuItem onClick={() => { setScreen('admin-pending'); setAdminAnchor(null); }}>
            <Badge badgeContent={pendingCount} color="error" max={99} invisible={pendingCount === 0}
              sx={{ '& .MuiBadge-badge': { right: -12, top: 8 } }}>
              <span>{t('nav.adminPending')}</span>
            </Badge>
          </MenuItem>
        </Menu>
```

- [ ] **Step 5: Render the new screen.** After line 187 (`{screen === 'households' && ...}`):
```tsx
        {screen === 'counterparties' && initialRole === 'admin' && <CounterpartiesScreen />}
```

- [ ] **Step 6: Build + test** — `cd ui/react && npm run build && npm test` — Expected: PASS (fix any MUI `value` warning by confirming Step 3's sentinel).
- [ ] **Step 7: Commit** — `git add ui/react/src/App.tsx && git commit -m "feat(react): Administration nav group (counterparties/households/pending)"`

---

## Part C — Angular: shared nav → Administration menu → counterparty screen → Households port

Do C1→C2→C3→C4 **in order**. C1 (extract shared nav) is behaviour-preserving refactor; commit it green before adding anything.

### Task C1: Extract shared `<app-nav/>` component

**Files:** Create `ui/angular/src/app/nav/nav.component.ts`; Modify the ~10 components that inline `harmonia-header` (e.g. `directory/directory-list.component.ts`, `notification.component.ts`, plus the financial/reservations/privacy/admin-pending screens); Reference `ui/angular/src/styles.scss` for the `.harmonia-header`/`.nav-link`/`.nav-active`/`.role-toggle`/`.role-btn` CSS.

The inline header appears in two flavours: (a) components with a local `selectedRole` + role toggle (like `directory-list.component.ts` lines 50-68), and (b) components that receive `@Input() role`. The shared component must support the role toggle so admins keep the resident/admin switch.

- [ ] **Step 1: Write `<app-nav/>`** (lifts the header markup verbatim; exposes `role` two-way binding so parent screens reload on change)

```typescript
import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';
import { PendingBadgeComponent } from '../pending-badge/pending-badge.component';
import { RoleService } from '../role.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, LanguageSwitcherComponent, UserMenuComponent, PendingBadgeComponent],
  template: `
    <header class="harmonia-header">
      <span class="harmonia-logo">🏡 {{ 'app.brand' | translate }}</span>
      <span class="harmonia-subtitle">{{ 'app.subtitle' | translate }}</span>
      <div class="flex-spacer"></div>
      <a routerLink="/notifications" routerLinkActive="nav-active" class="nav-link">{{ 'nav.notifications' | translate }}</a>
      <a routerLink="/financial" routerLinkActive="nav-active" class="nav-link">{{ 'nav.finance' | translate }}</a>
      <a routerLink="/reservations" routerLinkActive="nav-active" class="nav-link">{{ 'nav.reservations' | translate }}</a>
      <a routerLink="/directory" routerLinkActive="nav-active" class="nav-link">{{ 'nav.directory' | translate }}</a>
      @if (isAdmin) {
        <span class="admin-menu" (mouseleave)="adminOpen = false">
          <a class="nav-link" (click)="adminOpen = !adminOpen">{{ 'nav.administration' | translate }} ▾<app-pending-badge /></a>
          @if (adminOpen) {
            <div class="admin-dropdown">
              <a routerLink="/counterparties" routerLinkActive="nav-active" class="admin-item" (click)="adminOpen = false">{{ 'nav.counterparties' | translate }}</a>
              <a routerLink="/households" routerLinkActive="nav-active" class="admin-item" (click)="adminOpen = false">{{ 'nav.households' | translate }}</a>
              <a routerLink="/admin-pending" routerLinkActive="nav-active" class="admin-item" (click)="adminOpen = false">{{ 'nav.adminPending' | translate }}<app-pending-badge /></a>
            </div>
          }
        </span>
      }
      <a routerLink="/privacy" routerLinkActive="nav-active" class="nav-link">{{ 'nav.privacy' | translate }}</a>
      @if (isAdmin) {
        <span class="role-toggle">
          <button [class.role-active]="role === 'resident'" (click)="setRole('resident')" class="role-btn">{{ 'app.roleResident' | translate }}</button>
          <button [class.role-active]="role === 'admin'" (click)="setRole('admin')" class="role-btn">{{ 'app.roleAdmin' | translate }}</button>
        </span>
      }
      <app-language-switcher />
      <app-user-menu />
    </header>
  `,
  styles: [`
    .admin-menu { position: relative; }
    .admin-dropdown {
      position: absolute; top: 100%; right: 0; z-index: 20; min-width: 12rem;
      background: var(--p-primary-color); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.25);
      display: flex; flex-direction: column; padding: 0.25rem;
    }
    .admin-item { color: rgba(255,255,255,.85); text-decoration: none; padding: 8px 12px; border-radius: 6px; font-size: .875rem; white-space: nowrap; }
    .admin-item:hover, .admin-item.nav-active { background: rgba(255,255,255,.18); color: #fff; }
  `],
})
export class NavComponent {
  readonly isAdmin = inject(RoleService).isAdmin;
  @Input() role: 'resident' | 'admin' = 'resident';
  @Output() roleChange = new EventEmitter<'resident' | 'admin'>();
  adminOpen = false;

  setRole(role: 'resident' | 'admin') {
    this.role = role;
    this.roleChange.emit(role);
  }
}
```

> The `.harmonia-header`, `.nav-link`, `.nav-active`, `.role-toggle`, `.role-btn`, `.harmonia-logo`, `.harmonia-subtitle`, `.flex-spacer` classes are already global in `styles.scss`, so the shared component only adds the dropdown-specific styles.

- [ ] **Step 2: Replace inline headers.** In each screen currently rendering `<header class="harmonia-header">…</header>`, delete that block and its now-unused header imports (`LanguageSwitcherComponent`, `UserMenuComponent`, `PendingBadgeComponent`, and the header nav links) and render instead:
```html
<app-nav [role]="selectedRole" (roleChange)="onRoleChange($event)" />
```
Add `NavComponent` to the component's `imports` array. For screens using `@Input() role` without a local toggle, bind `[role]="role"` and drop `(roleChange)` (or wire it to the screen's existing reload). Keep each screen's existing `onRoleChange`/`selectedRole` logic — only the header markup moves.

- [ ] **Step 3: Run Angular tests — verify green** — `cd ui/angular && npm test` — Expected: PASS. Existing screens still render a header and switch roles.
- [ ] **Step 4: Commit** — `git add ui/angular/src/app/nav ui/angular/src/app/**/**.component.ts && git commit -m "refactor(angular): extract shared <app-nav/> from inline headers"`

---

### Task C2: Administration menu (already in `<app-nav/>` from C1)

C1's `<app-nav/>` already renders the Administration dropdown with Counterparties / Households / Pending Activations. This task just verifies the routes it links to exist after C3/C4 and that `nav-active` highlights correctly.

- [ ] **Step 1:** No code change — confirm the dropdown links (`/counterparties`, `/households`, `/admin-pending`) resolve once C3/C4 add the routes. `/admin-pending` already exists.
- [ ] **Step 2:** After C3+C4, manually click each Administration item; Expected: navigates + `nav-active` on the open item.

---

### Task C3: Angular counterparty service + component + route

**Files:** Create `ui/angular/src/app/counterparties/counterparty.service.ts`, `counterparty.models.ts`, `counterparty-list.component.ts`; Modify `ui/angular/src/app/app.routes.ts`

Mirror `directory/directory.service.ts` (service) and `directory/directory-list.component.ts` (component: `p-card` + `p-table` + `p-dialog` add/edit + `p-dialog` delete confirm + `MessageService` toasts).

- [ ] **Step 1: Models** — `counterparty.models.ts`
```typescript
export interface Counterparty {
  id: string;
  name: string;
  category: string;
  parentCategory: string;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CounterpartyInput {
  name: string;
  category: string;
  parentCategory: string;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
}
```

- [ ] **Step 2: Service** — `counterparty.service.ts` (mirrors `directory.service.ts`: `inject(HttpClient)`, `const API = environment.apiUrl`)
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Counterparty, CounterpartyInput } from './counterparty.models';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class CounterpartyService {
  private readonly http = inject(HttpClient);

  list(): Observable<Counterparty[]> {
    return this.http.get<Counterparty[]>(`${API}/counterparties`);
  }
  create(input: CounterpartyInput): Observable<Counterparty> {
    return this.http.post<Counterparty>(`${API}/counterparties`, input);
  }
  update(id: string, input: CounterpartyInput): Observable<Counterparty> {
    return this.http.put<Counterparty>(`${API}/counterparties/${id}`, input);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/counterparties/${id}`);
  }
}
```

- [ ] **Step 3: Component** — `counterparty-list.component.ts`. Structure copies `directory-list.component.ts`: `<app-nav />` header, `p-card` with `p-table` (columns Name·Category·ParentCategory·VAT·Phone·Email·actions), an add button opening a shared add/edit `p-dialog`, and a delete-confirm `p-dialog`. Delete error handler inspects `err.status === 409` → show `counterparties.deleteHasBills`.

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { NavComponent } from '../nav/nav.component';
import { CounterpartyService } from './counterparty.service';
import { Counterparty, CounterpartyInput } from './counterparty.models';

const EMPTY: CounterpartyInput = { name: '', category: '', parentCategory: '', vatNumber: '', phone: '', email: '' };

@Component({
  selector: 'app-counterparty-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, ToastModule, CardModule, TranslatePipe, NavComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="harmonia-shell">
      <app-nav />
      <main class="harmonia-content wide">
        <p-card>
          <ng-template #title>
            <div class="card-title-row">
              <span>{{ 'counterparties.title' | translate }}</span>
              <p-button [label]="'counterparties.add' | translate" icon="pi pi-plus" [rounded]="true" (onClick)="openAdd()" />
            </div>
          </ng-template>

          @if (loading()) {
            <div class="loading-row"><i class="pi pi-spin pi-spinner"></i><span>{{ 'common.loading' | translate }}</span></div>
          } @else if (error()) {
            <div class="error-row">
              <i class="pi pi-exclamation-circle"></i><span>{{ error() }}</span>
              <p-button [label]="'common.retry' | translate" icon="pi pi-refresh" severity="secondary" (onClick)="load()" />
            </div>
          } @else {
            <p-table [value]="rows()" [paginator]="true" [rows]="25" [rowsPerPageOptions]="[25,50,100]"
                     styleClass="p-datatable-striped p-datatable-sm">
              <ng-template #header>
                <tr>
                  <th>{{ 'counterparties.name' | translate }}</th>
                  <th>{{ 'counterparties.category' | translate }}</th>
                  <th>{{ 'counterparties.parentCategory' | translate }}</th>
                  <th>{{ 'counterparties.vatNumber' | translate }}</th>
                  <th>{{ 'counterparties.phone' | translate }}</th>
                  <th>{{ 'counterparties.email' | translate }}</th>
                  <th style="width:8rem"></th>
                </tr>
              </ng-template>
              <ng-template #body let-c>
                <tr>
                  <td>{{ c.name }}</td>
                  <td>{{ c.category }}</td>
                  <td>{{ c.parentCategory }}</td>
                  <td>{{ c.vatNumber ?? '—' }}</td>
                  <td>{{ c.phone ?? '—' }}</td>
                  <td>{{ c.email ?? '—' }}</td>
                  <td>
                    <div class="action-cell">
                      <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="secondary" size="small" (onClick)="openEdit(c)" />
                      <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger" size="small" (onClick)="openDelete(c)" />
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr><td colspan="7" class="empty-message">{{ 'counterparties.empty' | translate }}</td></tr>
              </ng-template>
            </p-table>
          }
        </p-card>
      </main>
    </div>

    <p-dialog [(visible)]="dialogVisible" [header]="(editing ? 'counterparties.editTitle' : 'counterparties.addTitle') | translate"
              [modal]="true" [style]="{ width: '34rem' }" [draggable]="false" [resizable]="false">
      <div class="edit-form">
        <div class="field"><label>{{ 'counterparties.name' | translate }} *</label><input pInputText [(ngModel)]="form.name" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.category' | translate }} *</label><input pInputText [(ngModel)]="form.category" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.parentCategory' | translate }} *</label><input pInputText [(ngModel)]="form.parentCategory" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.vatNumber' | translate }}</label><input pInputText [(ngModel)]="form.vatNumber" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.phone' | translate }}</label><input pInputText [(ngModel)]="form.phone" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.email' | translate }}</label><input pInputText type="email" [(ngModel)]="form.email" class="w-full" /></div>
      </div>
      <ng-template #footer>
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="dialogVisible = false" />
        <p-button [label]="'common.save' | translate" icon="pi pi-check" [loading]="saving()" [disabled]="!formValid()" (onClick)="save()" />
      </ng-template>
    </p-dialog>

    <p-dialog [(visible)]="deleteVisible" [header]="'counterparties.deleteTitle' | translate"
              [modal]="true" [style]="{ width: '28rem' }" [draggable]="false" [resizable]="false" [closable]="!deleting()">
      <p class="depart-message">{{ t.instant('counterparties.deleteConfirm', { name: deleteTarget?.name }) }}</p>
      @if (deleteError()) { <p class="error-row">{{ deleteError() }}</p> }
      <ng-template #footer>
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times" severity="secondary" [outlined]="true" [disabled]="deleting()" (onClick)="deleteVisible = false" />
        <p-button [label]="'common.delete' | translate" icon="pi pi-trash" severity="danger" [loading]="deleting()" (onClick)="confirmDelete()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: var(--p-surface-ground); }
    .harmonia-content { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
    .card-title-row { display: flex; align-items: center; justify-content: space-between; }
    .action-cell { display: flex; gap: 0.125rem; }
    .loading-row, .error-row { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; color: var(--p-text-muted-color); }
    .error-row { color: var(--p-red-500, #ef4444); }
    .empty-message { text-align: center; padding: 2rem; color: var(--p-text-muted-color); }
    .edit-form { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.5rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    .field label { font-size: 0.875rem; font-weight: 500; }
    .w-full { width: 100%; }
    .depart-message { margin: 0; line-height: 1.6; }
  `],
})
export class CounterpartyListComponent implements OnInit {
  private readonly svc = inject(CounterpartyService);
  private readonly msg = inject(MessageService);
  readonly t = inject(TranslateService);

  rows = signal<Counterparty[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  dialogVisible = false;
  editing: Counterparty | null = null;
  form: CounterpartyInput = { ...EMPTY };
  saving = signal(false);

  deleteVisible = false;
  deleteTarget: Counterparty | null = null;
  deleting = signal(false);
  deleteError = signal<string | null>(null);

  formValid() {
    return this.form.name.trim() !== '' && this.form.category.trim() !== '' && this.form.parentCategory.trim() !== '';
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list().subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: () => { this.error.set(this.t.instant('counterparties.loadError')); this.loading.set(false); },
    });
  }

  openAdd() { this.editing = null; this.form = { ...EMPTY }; this.dialogVisible = true; }
  openEdit(c: Counterparty) {
    this.editing = c;
    this.form = { name: c.name, category: c.category, parentCategory: c.parentCategory,
      vatNumber: c.vatNumber ?? '', phone: c.phone ?? '', email: c.email ?? '' };
    this.dialogVisible = true;
  }

  private normalise(): CounterpartyInput {
    return {
      name: this.form.name.trim(),
      category: this.form.category.trim(),
      parentCategory: this.form.parentCategory.trim(),
      vatNumber: this.form.vatNumber?.trim() || null,
      phone: this.form.phone?.trim() || null,
      email: this.form.email?.trim() || null,
    };
  }

  save() {
    if (!this.formValid()) return;
    this.saving.set(true);
    const payload = this.normalise();
    const done = {
      next: () => {
        this.saving.set(false);
        this.dialogVisible = false;
        this.msg.add({ severity: 'success', summary: 'Saved', detail: this.t.instant(this.editing ? 'counterparties.updated' : 'counterparties.created') });
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('counterparties.saveError') });
      },
    };
    if (this.editing) this.svc.update(this.editing.id, payload).subscribe(done);
    else this.svc.create(payload).subscribe(done);
  }

  openDelete(c: Counterparty) { this.deleteTarget = c; this.deleteError.set(null); this.deleteVisible = true; }

  confirmDelete() {
    if (!this.deleteTarget) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.svc.remove(this.deleteTarget.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteVisible = false;
        this.msg.add({ severity: 'success', summary: 'Deleted', detail: this.t.instant('counterparties.deleted') });
        this.load();
      },
      error: (err: { status?: number }) => {
        this.deleting.set(false);
        this.deleteError.set(this.t.instant(err?.status === 409 ? 'counterparties.deleteHasBills' : 'counterparties.deleteError'));
      },
    });
  }
}
```

- [ ] **Step 4: Route** — in `app.routes.ts`, add (with the same `canActivate` guards the admin routes use — `[MsalGuard, adminGuard]` per `directory`):
```typescript
{
  path: 'counterparties',
  canActivate: [/* MsalGuard, adminGuard — match existing admin route guards */],
  loadComponent: () => import('./counterparties/counterparty-list.component').then(m => m.CounterpartyListComponent),
},
```

- [ ] **Step 5: Build + test** — `cd ui/angular && npm run build && npm test` — Expected: PASS.
- [ ] **Step 6: Commit** — `git add ui/angular/src/app/counterparties ui/angular/src/app/app.routes.ts && git commit -m "feat(angular): counterparties management screen + route"`

---

### Task C4: Port Households to Angular

**Files:** Create `ui/angular/src/app/households/household.service.ts`, `household.models.ts`, `household-list.component.ts`, `household-ref-picker.component.ts`; Modify `ui/angular/src/app/app.routes.ts`

Parity with React's `HouseholdsScreen.tsx` + `HouseholdRefPicker.tsx`. Backend already exists: GET `/households`, PUT/DELETE `/households/item?householdRef=` (query param — ref contains `/`), and GET `/directory/admin` for owner names.

- [ ] **Step 1: Models** — `household.models.ts`
```typescript
export interface Household {
  householdRef: string;
  sqMeters: number;
}
```

- [ ] **Step 2: Service** — `household.service.ts` (query-param for ref; reuses `DirectoryService.getAdminDirectory()` for names, or calls `/directory/admin` directly)
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Household } from './household.models';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly http = inject(HttpClient);

  list(): Observable<Household[]> {
    return this.http.get<Household[]>(`${API}/households`);
  }
  upsert(householdRef: string, sqMeters: number): Observable<void> {
    return this.http.put<void>(`${API}/households/item?householdRef=${encodeURIComponent(householdRef)}`, { sqMeters });
  }
  remove(householdRef: string): Observable<void> {
    return this.http.delete<void>(`${API}/households/item?householdRef=${encodeURIComponent(householdRef)}`);
  }
}
```

- [ ] **Step 3: Ref picker** — `household-ref-picker.component.ts` mirrors React `HouseholdRefPicker.tsx`: buildings X3 (АП1-19) and X4 (АП1-16); emits a composed ref via `(refChange)`. Standalone PrimeNG dropdowns/checkboxes; `@Output() refChange = new EventEmitter<string>()`. Compose the same way React's `buildRef` does (e.g. `X3 АП1/2 / X4 АП3`).

- [ ] **Step 4: Component** — `household-list.component.ts`: copy `counterparty-list.component.ts` structure but columns **Name · Apartment(s) · SqMeters · actions**, use `HouseholdService`, join owner names from `getAdminDirectory()` (build an owner-preferred `Map<ref,name>` like React's `residentNameByRef` `useMemo`), and use `<app-household-ref-picker>` in the add dialog. Delete confirm uses `households.deleteConfirm` with the ref. (Note the deferred backlog item [[project-tomorrow-backlog]]: Name before Apartment(s) — apply that column order here.)

- [ ] **Step 5: Route** — add to `app.routes.ts` with the admin guards:
```typescript
{
  path: 'households',
  canActivate: [/* MsalGuard, adminGuard */],
  loadComponent: () => import('./households/household-list.component').then(m => m.HouseholdListComponent),
},
```

- [ ] **Step 6: Build + test** — `cd ui/angular && npm run build && npm test` — Expected: PASS.
- [ ] **Step 7: Commit** — `git add ui/angular/src/app/households ui/angular/src/app/app.routes.ts && git commit -m "feat(angular): port Households management screen"`

---

## Part D — i18n keys (6 locale files)

**Files:** React `ui/react/src/i18n/locales/{en,bg,ru}.json`; Angular `ui/angular/public/assets/i18n/{en,bg,ru}.json`

Exploration confirmed: React `en.json` already has the full `households.*` set + `nav.households`; it needs only `nav.administration`, `nav.counterparties`, and the `counterparties.*` block (add to all three React locales). Angular locales need **all of that PLUS** `nav.households` and the full `households.*` set (mirror React's), because Angular had no Households screen before.

- [ ] **Step 1: Add to all 6 files — `nav` block:**
```json
"administration": "Administration",
"counterparties": "Counterparties",
"households": "Apartments"
```
(React locales already have `nav.households` — don't duplicate; add only the two new keys there.)

- [ ] **Step 2: Add the `counterparties` block to all 6 files** (translate for bg/ru). English:
```json
"counterparties": {
  "title": "Counterparties",
  "add": "Add counterparty",
  "addTitle": "Add counterparty",
  "editTitle": "Edit counterparty",
  "name": "Name",
  "category": "Category",
  "parentCategory": "Parent category",
  "vatNumber": "VAT number",
  "phone": "Phone",
  "email": "Email",
  "empty": "No counterparties yet.",
  "created": "Counterparty added",
  "updated": "Counterparty updated",
  "deleted": "Counterparty deleted",
  "deleteTitle": "Delete counterparty",
  "deleteConfirm": "Delete \"{{name}}\"? This cannot be undone.",
  "deleteHasBills": "Cannot delete — this counterparty has bills attached",
  "loadError": "Could not load counterparties.",
  "saveError": "Could not save counterparty.",
  "deleteError": "Could not delete counterparty."
}
```

- [ ] **Step 3: Add the full `households.*` block to the 3 Angular locales only** — copy the existing block verbatim from React `ui/react/src/i18n/locales/en.json` (`households.title`, `households.add`, `households.deleteConfirm`, etc.), translating for bg/ru. Also add any `common.*` keys the new Angular screens reference that are missing (`common.loading`, `common.edit`, `common.delete`, `common.retry`, `common.cancel`, `common.save`) — verify against existing `common` block first.

- [ ] **Step 4: Verify JSON validity** — `cd ui/react && npm run build` and `cd ui/angular && npm run build` — Expected: PASS (no i18n parse errors).
- [ ] **Step 5: Commit** — `git add ui/react/src/i18n ui/angular/public/assets/i18n && git commit -m "i18n(counterparties): add nav + counterparties + angular households keys"`

---

## Verification (end-to-end)

**Backend:**
```
dotnet build Harmonia.sln
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~Counterparty"
# Real SQL (R1/integration tier — never in-memory):
$env:HARMONIA_SQL_CONNSTR = "<local dev SQL Server connstr>"   # git-ignored; never commit
dotnet test tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj --filter "Category=Rel&FullyQualifiedName~Counterparty"
```
Expected: all green; the fixture applies `schema.sql`, creating `dbo.Counterparties`.

**React:** `cd ui/react && npm run build && npm test` — build clean, Jest green. Manual: sign in as admin → **Administration ▾** → Counterparties → add/edit/delete a counterparty; Households + Pending Activations still reachable under the same menu; Directory/Finance/Reservations still top-level.

**Angular:** `cd ui/angular && npm run build && npm test` — build clean, Vitest green. Manual: header renders via `<app-nav/>` on every screen, role toggle still works for admins, Administration dropdown navigates to Counterparties/Households/Pending Activations.

**Manual API smoke (admin token):**
```
GET    /counterparties            → 200 []
POST   /counterparties {…}        → 201 {id,…}
GET    /counterparties/{id}       → 200
PUT    /counterparties/{id} {…}   → 200
DELETE /counterparties/{id}       → 204
# resident token → 403 on every counterparty route
```

**Constraints honoured:** R2 — admin identity from `session.Resolve()`, never the body/query (the endpoints never read a role from input). R3 — no `householdRef`/PII logged (counterparty endpoints log nothing sensitive). C1 — no new Azure resources. No secrets committed (`HARMONIA_SQL_CONNSTR` is env-only).

---

## Self-Review

**Spec coverage** (`2026-08-12-counterparties-finance-reorg-design.md`, Phase 1 rows only):
- Data model `dbo.Counterparties` → Task A7 ✓
- 5 admin endpoints incl. DELETE→409 → A2/A3/A8 (+ A9 tests) ✓
- Request/response DTO shape → A8 (`CounterpartyRequest`/`CounterpartyDto`) ✓
- Administration nav (Counterparties + Households + Pending) → B3 (React), C1/C2 (Angular) ✓
- Counterparties management screen (Name·Category·ParentCategory·VAT·Phone·Email·Edit·Delete, add/edit dialog, delete confirm with 409 message) → B2 (React), C3 (Angular) ✓
- Error handling table (409 has-bills, 404 not-found, delete confirm) → A8 mapping + B2/C3 handlers ✓
- **Explicitly excluded (Phase 2):** `AssociationExpenses` migration, expense-endpoint changes, annual-report JOIN, finance-tab reorg, resident 2-tab split — none touched here ✓
- **Added beyond spec (from review):** shared `<app-nav/>` extraction (C1) + Angular Households port (C4) — required because Angular lacked both; noted in Context.

**Placeholder scan:** No TBD/TODO. C1 Step 2, C3 Step 4, C4 Steps 3-4, C4 route guards, and the D bg/ru translations are described-not-coded — these are deliberate: C1/C4-4 are mechanical copies of a fully-shown sibling file in the same plan (`counterparty-list.component.ts` / `HouseholdsScreen.tsx`) and the route-guard array must match whatever `directory` currently uses (read `app.routes.ts` at execution time). The executor reads the named reference file and mirrors it. All backend code (the TDD core) is complete and literal.

**Type consistency:** `CounterpartyInput`/`Counterparty(Dto)` field names identical across .NET DTO, React, and Angular (`name, category, parentCategory, vatNumber, phone, email` + `id, createdAt, updatedAt`). DU case names match between Ports (A2), use cases (A3), store (A6), endpoints (A8), and tests (A5/A9): `Refused/Ok/Created/NotFound/HasBills/Failed`. Store-level `UpdateCounterpartyStoreResult`/`DeleteCounterpartyStoreResult` (Ok/NotFound/HasBills) are distinct from use-case results (which add Refused/Failed) — the use case maps between them (A3). `WithBills` test hook is consistent between `FakeCounterpartyStore` (A4) and its use in A5/A9.
