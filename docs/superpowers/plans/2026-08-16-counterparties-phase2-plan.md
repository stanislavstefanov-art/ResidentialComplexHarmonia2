# Counterparties + Finance-Screen Reorg — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Phase-1 `Counterparties` entity into the expense/bills system (required FK, replacing free-text `Category`/`ParentCategory`), and reorganize the admin Finance screen into 3 tabs (Income[Charged/Received] · Outcome · Report) and the resident Finance screen into 2 tabs (Fees · Payments) in both React and Angular.

**Architecture:** Destructive-but-guarded schema migration (no production data to preserve) → backend domain/store/endpoint changes that make `counterpartyId` required on `POST /expenses` and join counterparty display fields into `GET /expenses` → matching UI rewrites in both frontends, reusing the Phase-1 counterparty list-fetch pattern for a picker. Dead pre-refactor screens/routes in both stacks are deleted (per your decision).

**Tech Stack:** .NET 8 minimal API, raw ADO.NET; React 18 + MUI 9; Angular 20/21 + PrimeNG 22.

---

## Context

Phase 1 (merged on this branch) added a standalone `Counterparties` CRUD entity and management screens but left `dbo.AssociationExpenses` and the Bills/Fees/Payments/Report tab structure untouched — `SqlCounterpartyStore.DeleteAsync` was deliberately left unconditional (comment: *"Phase 2 adds a 'has bills' pre-check"*) and `FakeCounterpartyStore.WithBills` was staged as the test seam for it. Phase 2 finishes that wiring: expenses now reference a counterparty instead of typing a category, and the Finance UI is reorganized around Income/Outcome/Report per the approved design spec (`docs/superpowers/specs/2026-08-12-counterparties-finance-reorg-design.md`).

Exploration (this session) surfaced two things not obvious from the spec:
1. **The resident Finance view has zero tabs today, in both stacks.** "Simplify to 2 tabs: Fees, Payments" is actually *introducing* tabs, not removing a bills tab (residents already never see bills).
2. **Both stacks carry dead pre-refactor screens.** React: `ExpensesScreen.tsx`/`PaymentsScreen.tsx`/`MaintenanceFeesScreen.tsx` (unrouted, unimported, duplicate `financial/*Tab.tsx` logic). Angular: `expense.component.ts`/`maintenance-fee.component.ts`/`payment.component.ts` are routed but shadow three already-dead `redirectTo: 'financial'` entries beneath them (Angular's router first-match-wins, so those redirects never fire) and are unreachable from any nav link. **Decision (confirmed):** delete both the components and the dead routes as part of this phase.

**Hard ordering constraint:** Part A (backend) must land and be verified *before* any frontend work, because dropping `category`/`parentCategory` from `POST /expenses` and requiring `counterpartyId` is a breaking request-shape change. Same discipline as Phase 1 (backend → React → Angular → i18n).

---

## Part A — Backend

### File structure (Part A)

| File | Change |
|------|--------|
| `db/schema.sql` | Add self-guarding migration block (TRUNCATE + drop columns + add required FK) |
| `src/Harmonia.Domain/Expenses/AssociationExpense.cs` | `Category`/`ParentCategory` → `CounterpartyId` |
| `src/Harmonia.Application/Expenses/Ports.cs` | Add `ExpenseListItem` read-model; `IExpenseStore.ListExpensesAsync` returns it |
| `src/Harmonia.Application/Expenses/RecordExpense.cs` | Signature: `counterpartyId` replaces `category`/`parentCategory` |
| `src/Harmonia.Application/Expenses/ListExpenses.cs` | No signature change (return type flows through `Ok`) |
| `src/Harmonia.Api/Expenses/ExpenseEndpoints.cs` | `RecordExpenseRequest`/`ExpenseDto` (create) + new `ExpenseListItemDto` (list) |
| `src/Harmonia.Api/Adapters/SqlExpenseStore.cs` (namespace `Harmonia.Api.Reservations.Adapters` — pre-existing quirk, keep it) | All 4 SQL statements updated |
| `src/Harmonia.Api/Adapters/SqlCounterpartyStore.cs` | `DeleteAsync` gets the real `HasBills` pre-check |
| `tests/Harmonia.UnitTests/Fakes.cs` | `FakeExpenseStore`/`FailingExpenseStore` updated to new interface shape |
| `tests/Harmonia.UnitTests/Application/RecordExpenseTests.cs`, `ListExpensesTests.cs` | Updated for new signature/type |
| `tests/Harmonia.UnitTests/Api/ExpenseEndpointsTests.cs` | Updated `TestRequest`/assertions |
| `tests/Harmonia.IntegrationTests/SqlExpenseStoreTests.cs` | New tests: `CounterpartyId` round-trip, JOIN-based annual report |
| `tests/Harmonia.IntegrationTests/SqlCounterpartyStoreTests.cs` | New test: delete with a referencing expense → `HasBills` |

**Design decision on the joined-read model:** the append-only `AssociationExpense` domain record stays lean — `CounterpartyId` only, no display fields. A separate `ExpenseListItem` (Application-layer record, alongside the existing `ExpenseMonthRow`) carries the joined `CounterpartyName`/`CounterpartyCategory`/`CounterpartyParentCategory` for `GET /expenses` only. The `POST /expenses` 201 response stays lean too (no join — the client already knows what counterparty it just picked), using a plain `ExpenseDto`; `GET /expenses` uses a distinct `ExpenseListItemDto`. This avoids an extra DB round-trip on create and keeps the domain record pure.

---

### Task A0: Schema migration

**Files:** Modify `db/schema.sql`

**Placement is critical:** the new block references `dbo.Counterparties(Id)`, and `schema.sql` runs top-to-bottom as one unbatched script. `dbo.Counterparties` is defined *after* `dbo.AssociationExpenses` in the file (Phase 1 appended it near the end). So this migration block must go **after** the `dbo.Counterparties` `CREATE TABLE` block (search for `CONSTRAINT PK_Counterparties PRIMARY KEY (Id)` — insert immediately after that closing `);`), **not** next to the `AssociationExpenses` table definition earlier in the file.

- [ ] **Step 1: Append the migration block right after the `Counterparties` table**

```sql
-- Phase 2: expenses reference a counterparty instead of typing a free-text category.
-- No production data to preserve — truncate first so the required FK can be added.
-- Self-guarding on CounterpartyId so this runs exactly once even though schema.sql
-- re-executes on every test/deploy run.
IF COL_LENGTH('dbo.AssociationExpenses', 'CounterpartyId') IS NULL
BEGIN
    TRUNCATE TABLE dbo.AssociationExpenses;
    ALTER TABLE dbo.AssociationExpenses DROP COLUMN Category;
    ALTER TABLE dbo.AssociationExpenses DROP COLUMN ParentCategory;
    ALTER TABLE dbo.AssociationExpenses
        ADD CounterpartyId uniqueidentifier NOT NULL
        REFERENCES dbo.Counterparties(Id);
END
```

- [ ] **Step 2: Commit** — `git add db/schema.sql && git commit -m "feat(expenses): migrate AssociationExpenses to CounterpartyId FK"`

---

### Task A1: Domain record

**Files:** Modify `src/Harmonia.Domain/Expenses/AssociationExpense.cs`

- [ ] **Step 1: Replace the record**

```csharp
namespace Harmonia.Domain.Expenses;

public sealed record AssociationExpense(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    Guid           CounterpartyId,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);
```

- [ ] **Step 2: Build** — `dotnet build src/Harmonia.Domain/Harmonia.Domain.csproj` — Expected: FAIL (downstream references to `.Category`/`.ParentCategory` break). This is expected — fix in subsequent tasks, don't chase every red build here.
- [ ] **Step 3: Commit** — `git add src/Harmonia.Domain/Expenses/AssociationExpense.cs && git commit -m "feat(expenses): replace Category/ParentCategory with CounterpartyId on domain record"`

---

### Task A2: Application ports — add `ExpenseListItem`, update `IExpenseStore`

**Files:** Modify `src/Harmonia.Application/Expenses/Ports.cs`

- [ ] **Step 1: Update the interface and add the read-model**

```csharp
using Harmonia.Domain.Expenses;

namespace Harmonia.Application.Expenses;

public abstract record RecordExpenseResult
{
    private RecordExpenseResult() { }
    public sealed record Refused                               : RecordExpenseResult;
    public sealed record Created(AssociationExpense Expense)   : RecordExpenseResult;
    public sealed record Duplicate(AssociationExpense Expense) : RecordExpenseResult;
    public sealed record Failed                                : RecordExpenseResult;
}

public abstract record ListExpensesResult
{
    private ListExpensesResult() { }
    public sealed record Refused                                    : ListExpensesResult;
    public sealed record Ok(IReadOnlyList<ExpenseListItem> Expenses) : ListExpensesResult;
    public sealed record Failed                                     : ListExpensesResult;
}

public interface IExpenseStore
{
    Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default);

    Task<IReadOnlyList<ExpenseListItem>> ListExpensesAsync(
        CancellationToken ct = default);

    Task<AnnualExpenseData> GetAnnualExpensesAsync(
        int year, CancellationToken ct = default);
}

/// Read-only projection for GET /expenses — joins Counterparty display fields.
/// AssociationExpense (the append-only write-side domain record) stays lean.
public sealed record ExpenseListItem(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    Guid           CounterpartyId,
    string         CounterpartyName,
    string         CounterpartyCategory,
    string         CounterpartyParentCategory,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

public sealed record ExpenseMonthRow(string ParentCategory, string SubCategory, int MonthNum, decimal Total);

public sealed record AnnualExpenseData(IReadOnlyList<ExpenseMonthRow> Rows);
```

- [ ] **Step 2: Commit** — `git add src/Harmonia.Application/Expenses/Ports.cs && git commit -m "feat(expenses): add ExpenseListItem read-model, update IExpenseStore"`

---

### Task A3: Use cases

**Files:** Modify `src/Harmonia.Application/Expenses/RecordExpense.cs`; `ListExpenses.cs` needs no signature change (verify it still compiles once A2/A4 land — its body doesn't reference `Category`).

- [ ] **Step 1: Update `RecordExpense`**

```csharp
using Harmonia.Domain.Expenses;

namespace Harmonia.Application.Expenses;

public sealed class RecordExpense(ISession session, IExpenseStore store)
{
    public async Task<RecordExpenseResult> ExecuteAsync(
        decimal amountEur,
        string description,
        Guid counterpartyId,
        DateOnly expenseDate,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordExpenseResult.Refused();

        var expense = new AssociationExpense(
            Id:             Guid.NewGuid(),
            AmountEur:      amountEur,
            Description:    description,
            CounterpartyId: counterpartyId,
            ExpenseDate:    expenseDate,
            RecordedAt:     DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        return await store.RecordExpenseAsync(expense, ct);
    }
}
```

- [ ] **Step 2: Build** — `dotnet build src/Harmonia.Application/Harmonia.Application.csproj` — Expected: still FAIL (`Financial/GetAnnualReport.cs` and `SqlExpenseStore` not yet updated) — confirm the *only* remaining errors are in those two areas, not new ones you introduced.
- [ ] **Step 3: Commit** — `git add src/Harmonia.Application/Expenses/RecordExpense.cs && git commit -m "feat(expenses): RecordExpense takes counterpartyId instead of category/parentCategory"`

---

### Task A4: SQL store — all 4 statements

**Files:** Modify `src/Harmonia.Api/Adapters/SqlExpenseStore.cs` (namespace stays `Harmonia.Api.Reservations.Adapters` — do not "fix" this pre-existing quirk as part of this task).

- [ ] **Step 1: Rewrite the file**

```csharp
using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.Api.Reservations.Adapters;

public sealed class SqlExpenseStore(string connectionString) : IExpenseStore
{
    private const int UniqueIndexViolation      = 2601;
    private const int UniqueConstraintViolation = 2627;

    public async Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "INSERT INTO dbo.AssociationExpenses " +
                "(Id, AmountEur, Description, CounterpartyId, ExpenseDate, RecordedAt, IdempotencyKey) " +
                "VALUES (@Id, @AmountEur, @Description, @CounterpartyId, @ExpenseDate, @RecordedAt, @IdempotencyKey);";
            cmd.Parameters.AddWithValue("@Id", expense.Id);
            cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal)
                { Value = expense.AmountEur, Precision = 18, Scale = 2 });
            cmd.Parameters.AddWithValue("@Description", expense.Description);
            cmd.Parameters.AddWithValue("@CounterpartyId", expense.CounterpartyId);
            cmd.Parameters.Add(new SqlParameter("@ExpenseDate", SqlDbType.Date)
                { Value = expense.ExpenseDate.ToDateTime(TimeOnly.MinValue) });
            cmd.Parameters.Add(new SqlParameter("@RecordedAt", SqlDbType.DateTimeOffset)
                { Value = expense.RecordedAt });
            cmd.Parameters.AddWithValue("@IdempotencyKey", expense.IdempotencyKey);
            await cmd.ExecuteNonQueryAsync(ct);
            return new RecordExpenseResult.Created(expense);
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            var existing = await LoadExistingAsync(expense.IdempotencyKey, ct);
            return new RecordExpenseResult.Duplicate(existing);
        }
        catch (Exception)
        {
            return new RecordExpenseResult.Failed();
        }
    }

    public async Task<IReadOnlyList<ExpenseListItem>> ListExpensesAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT e.Id, e.AmountEur, e.Description, e.CounterpartyId, " +
            "       c.Name, c.Category, c.ParentCategory, " +
            "       e.ExpenseDate, e.RecordedAt, e.IdempotencyKey " +
            "FROM dbo.AssociationExpenses e " +
            "JOIN dbo.Counterparties c ON c.Id = e.CounterpartyId " +
            "ORDER BY e.RecordedAt DESC;";

        var results = new List<ExpenseListItem>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new ExpenseListItem(
                Id:                         reader.GetGuid(0),
                AmountEur:                  reader.GetDecimal(1),
                Description:                reader.GetString(2),
                CounterpartyId:             reader.GetGuid(3),
                CounterpartyName:           reader.GetString(4),
                CounterpartyCategory:       reader.GetString(5),
                CounterpartyParentCategory: reader.GetString(6),
                ExpenseDate:                DateOnly.FromDateTime(reader.GetDateTime(7)),
                RecordedAt:                 reader.GetDateTimeOffset(8),
                IdempotencyKey:             reader.GetString(9)));
        }
        return results;
    }

    public async Task<AnnualExpenseData> GetAnnualExpensesAsync(int year, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT c.ParentCategory, c.Category, " +
            "       MONTH(e.ExpenseDate) AS MonthNum, " +
            "       SUM(e.AmountEur) AS Total " +
            "FROM dbo.AssociationExpenses e " +
            "JOIN dbo.Counterparties c ON c.Id = e.CounterpartyId " +
            "WHERE YEAR(e.ExpenseDate) = @Year " +
            "GROUP BY c.ParentCategory, c.Category, MONTH(e.ExpenseDate);";
        cmd.Parameters.AddWithValue("@Year", year);

        var rows = new List<ExpenseMonthRow>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new ExpenseMonthRow(
                ParentCategory: reader.GetString(0),
                SubCategory:    reader.GetString(1),
                MonthNum:       reader.GetInt32(2),
                Total:          reader.GetDecimal(3)));
        }
        return new AnnualExpenseData(rows);
    }

    private async Task<AssociationExpense> LoadExistingAsync(string idempotencyKey, CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, AmountEur, Description, CounterpartyId, ExpenseDate, RecordedAt, IdempotencyKey " +
            "FROM dbo.AssociationExpenses WHERE IdempotencyKey = @IdempotencyKey;";
        cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return new AssociationExpense(
            Id:             reader.GetGuid(0),
            AmountEur:      reader.GetDecimal(1),
            Description:    reader.GetString(2),
            CounterpartyId: reader.GetGuid(3),
            ExpenseDate:    DateOnly.FromDateTime(reader.GetDateTime(4)),
            RecordedAt:     reader.GetDateTimeOffset(5),
            IdempotencyKey: reader.GetString(6));
    }
}
```

- [ ] **Step 2: Build** — `dotnet build src/Harmonia.Api/Harmonia.Api.csproj` — Expected: still FAIL only in `ExpenseEndpoints.cs` (not yet updated) and `GetAnnualReport.cs`/its tests if they reference removed members — check the exact remaining errors before proceeding.
- [ ] **Step 3: Commit** — `git add src/Harmonia.Api/Adapters/SqlExpenseStore.cs && git commit -m "feat(expenses): join Counterparties in list/annual-report queries"`

---

### Task A5: Wire the real `HasBills` pre-check into `SqlCounterpartyStore`

**Files:** Modify `src/Harmonia.Api/Adapters/SqlCounterpartyStore.cs`

- [ ] **Step 1: Replace `DeleteAsync`** (remove the Phase-1 "unconditional" comment; add a pre-check in the same connection before the DELETE)

```csharp
public async Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default)
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync(ct);

    await using (var checkCmd = conn.CreateCommand())
    {
        checkCmd.CommandText = "SELECT COUNT(1) FROM dbo.AssociationExpenses WHERE CounterpartyId = @Id;";
        checkCmd.Parameters.AddWithValue("@Id", id);
        var billCount = (int)await checkCmd.ExecuteScalarAsync(ct);
        if (billCount > 0)
            return new DeleteCounterpartyStoreResult.HasBills();
    }

    await using var cmd = conn.CreateCommand();
    cmd.CommandText = "DELETE FROM dbo.Counterparties WHERE Id = @Id;";
    cmd.Parameters.AddWithValue("@Id", id);
    var rows = await cmd.ExecuteNonQueryAsync(ct);
    return rows == 0
        ? new DeleteCounterpartyStoreResult.NotFound()
        : new DeleteCounterpartyStoreResult.Ok();
}
```

- [ ] **Step 2: Build** — `dotnet build src/Harmonia.Api/Harmonia.Api.csproj` — Expected: PASS (this file was self-contained; A4's build should already be green by now once A6 lands).
- [ ] **Step 3: Commit** — `git add src/Harmonia.Api/Adapters/SqlCounterpartyStore.cs && git commit -m "feat(counterparties): wire real HasBills pre-check on delete"`

---

### Task A6: Endpoints — split create vs. list DTOs

**Files:** Modify `src/Harmonia.Api/Expenses/ExpenseEndpoints.cs`

- [ ] **Step 1: Rewrite the file**

```csharp
using Microsoft.AspNetCore.Http.HttpResults;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.Api.Expenses;

public sealed record RecordExpenseRequest(
    decimal  AmountEur,
    string   Description,
    Guid     CounterpartyId,
    DateOnly ExpenseDate,
    string   IdempotencyKey);

// POST response — no join; the client already knows the counterparty it picked.
public sealed record ExpenseDto(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    Guid           CounterpartyId,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

// GET list response — joined counterparty display fields.
public sealed record ExpenseListItemDto(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    Guid           CounterpartyId,
    string         CounterpartyName,
    string         CounterpartyCategory,
    string         CounterpartyParentCategory,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

public static class ExpenseEndpoints
{
    public static async Task<IResult> RecordExpenseEndpoint(
        RecordExpense useCase, RecordExpenseRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            body.AmountEur, body.Description, body.CounterpartyId, body.ExpenseDate, body.IdempotencyKey, ct);

        switch (result)
        {
            case RecordExpenseResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case RecordExpenseResult.Created created:
                logger.LogInformation("Expense recorded: created");
                return TypedResults.Json(ToDto(created.Expense), statusCode: StatusCodes.Status201Created);
            case RecordExpenseResult.Duplicate duplicate:
                logger.LogInformation("Expense recorded: duplicate (idempotent)");
                return TypedResults.Json(ToDto(duplicate.Expense), statusCode: StatusCodes.Status200OK);
            case RecordExpenseResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> ListExpensesEndpoint(
        ListExpenses useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);

        switch (result)
        {
            case ListExpensesResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case ListExpensesResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            case ListExpensesResult.Ok ok:
                logger.LogInformation("Expenses listed: {Count}", ok.Expenses.Count);
                return TypedResults.Json(
                    ok.Expenses.Select(ToListDto).ToList(),
                    statusCode: StatusCodes.Status200OK);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private static ExpenseDto ToDto(AssociationExpense e) =>
        new(e.Id, e.AmountEur, e.Description, e.CounterpartyId, e.ExpenseDate, e.RecordedAt, e.IdempotencyKey);

    private static ExpenseListItemDto ToListDto(ExpenseListItem e) =>
        new(e.Id, e.AmountEur, e.Description, e.CounterpartyId, e.CounterpartyName,
            e.CounterpartyCategory, e.CounterpartyParentCategory, e.ExpenseDate, e.RecordedAt, e.IdempotencyKey);
}
```

- [ ] **Step 2: Build full solution** — `dotnet build Harmonia.sln` — Expected: FAIL only in test projects (Fakes.cs / RecordExpenseTests.cs / ListExpensesTests.cs / ExpenseEndpointsTests.cs / SqlExpenseStoreTests.cs — all updated in A7-A9). Confirm no other production-code errors remain.
- [ ] **Step 3: Commit** — `git add src/Harmonia.Api/Expenses/ExpenseEndpoints.cs && git commit -m "feat(expenses): split create/list DTOs; drop category/parentCategory from request"`

---

### Task A7: Update `Fakes.cs`

**Files:** Modify `tests/Harmonia.UnitTests/Fakes.cs`

- [ ] **Step 1: Replace `FakeExpenseStore`/`FailingExpenseStore`** to match the new `IExpenseStore` shape. `FakeExpenseStore` needs to fabricate a joined `ExpenseListItem` for `ListExpensesAsync` — since it has no real `Counterparties` table to join against, store a lookup the test can seed, defaulting to placeholder joined values when not seeded:

```csharp
public sealed class FakeExpenseStore : IExpenseStore
{
    private readonly Dictionary<string, AssociationExpense> _byKey = [];

    // Optional seam: tests can register counterparty display fields for a given
    // CounterpartyId to assert exact joined output; unseeded ids get placeholders.
    public Dictionary<Guid, (string Name, string Category, string ParentCategory)> Counterparties { get; } = [];

    public Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default)
    {
        if (_byKey.TryGetValue(expense.IdempotencyKey, out var existing))
            return Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Duplicate(existing));
        _byKey[expense.IdempotencyKey] = expense;
        return Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Created(expense));
    }

    public Task<IReadOnlyList<ExpenseListItem>> ListExpensesAsync(CancellationToken ct = default)
    {
        var list = _byKey.Values
            .OrderByDescending(e => e.RecordedAt)
            .Select(e =>
            {
                var (name, category, parentCategory) = Counterparties.TryGetValue(e.CounterpartyId, out var cp)
                    ? cp
                    : ("Unknown Counterparty", "Unknown", "Unknown");
                return new ExpenseListItem(
                    e.Id, e.AmountEur, e.Description, e.CounterpartyId,
                    name, category, parentCategory, e.ExpenseDate, e.RecordedAt, e.IdempotencyKey);
            })
            .ToList();
        return Task.FromResult<IReadOnlyList<ExpenseListItem>>(list);
    }

    public Task<AnnualExpenseData> GetAnnualExpensesAsync(int year, CancellationToken ct = default)
        => Task.FromResult(new AnnualExpenseData([]));
}

public sealed class FailingExpenseStore : IExpenseStore
{
    public Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default)
        => Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Failed());

    public Task<IReadOnlyList<ExpenseListItem>> ListExpensesAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<AnnualExpenseData> GetAnnualExpensesAsync(int year, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
}
```

- [ ] **Step 2: Build** — `dotnet build tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj` — Expected: FAIL only in the three test files not yet updated (A8/A9).
- [ ] **Step 3: Commit** — `git add tests/Harmonia.UnitTests/Fakes.cs && git commit -m "test(expenses): update fakes for CounterpartyId/ExpenseListItem shape"`

---

### Task A8: Update use-case + endpoint unit tests

**Files:** Modify `tests/Harmonia.UnitTests/Application/RecordExpenseTests.cs`, `ListExpensesTests.cs`, `tests/Harmonia.UnitTests/Api/ExpenseEndpointsTests.cs`

- [ ] **Step 1: Update `RecordExpenseTests.cs`** — every call site that passed `(amount, description, category, parentCategory, date, key)` becomes `(amount, description, counterpartyId, date, key)`. Use a fixed `Guid` per test (e.g. `var counterpartyId = Guid.NewGuid();`) and assert `created.Expense.CounterpartyId == counterpartyId` instead of asserting on `.Category`.

- [ ] **Step 2: Update `ListExpensesTests.cs`** — assertions against `ListExpensesResult.Ok.Expenses` now operate on `ExpenseListItem`, not `AssociationExpense`; if a test seeds `FakeExpenseStore` and asserts category/parentCategory, seed `store.Counterparties[counterpartyId] = ("PowerCo", "Electricity", "Utilities")` first and assert against `CounterpartyCategory`/`CounterpartyParentCategory`.

- [ ] **Step 3: Update `ExpenseEndpointsTests.cs`** — the `TestRequest` helper (or equivalent) that builds a `RecordExpenseRequest` positional record needs its `Category`/`ParentCategory` args replaced with a single `CounterpartyId` (`Guid.NewGuid()`). Any assertion reading the endpoint's JSON response for `category`/`parentCategory` should instead check `counterpartyId` is present (for the create-response `ExpenseDto`) — do not assert joined fields here since `ExpenseDto` (create) has none; a separate list-endpoint test (if one exists) would assert `ExpenseListItemDto`'s joined fields against a `FakeExpenseStore` seeded via `Counterparties`.

- [ ] **Step 4: Run** — `dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~Expense"` — Expected: all PASS.
- [ ] **Step 5: Commit** — `git add tests/Harmonia.UnitTests/Application/RecordExpenseTests.cs tests/Harmonia.UnitTests/Application/ListExpensesTests.cs tests/Harmonia.UnitTests/Api/ExpenseEndpointsTests.cs && git commit -m "test(expenses): update unit tests for CounterpartyId shape"`

---

### Task A9: Integration tests (real SQL)

**Files:** Modify `tests/Harmonia.IntegrationTests/SqlExpenseStoreTests.cs`; Modify `tests/Harmonia.IntegrationTests/SqlCounterpartyStoreTests.cs`

- [ ] **Step 1: Add to `SqlExpenseStoreTests.cs`** — a round-trip test proving `CounterpartyId` persists and `ListExpensesAsync` returns the correct joined name/category, plus a `GetAnnualExpensesAsync` test proving the JOIN groups by the counterparty's `ParentCategory`/`Category`:

```csharp
[Fact]
public async Task Record_then_List_returns_joined_counterparty_fields()
{
    var cpStore = new SqlCounterpartyStore(db.ConnectionString);
    var cp = await cpStore.CreateAsync($"rel-vendor-{Guid.NewGuid():N}", "Electricity", "Utilities", null, null, null);

    var store = new SqlExpenseStore(db.ConnectionString);
    var key = $"rel-exp-{Guid.NewGuid():N}";
    await store.RecordExpenseAsync(new AssociationExpense(
        Guid.NewGuid(), 142.50m, "March electricity bill", cp.Id,
        new DateOnly(2026, 3, 31), DateTimeOffset.UtcNow, key));

    var all = await store.ListExpensesAsync();
    var found = Assert.Single(all.Where(e => e.IdempotencyKey == key));
    Assert.Equal(cp.Id, found.CounterpartyId);
    Assert.Equal(cp.Name, found.CounterpartyName);
    Assert.Equal("Electricity", found.CounterpartyCategory);
    Assert.Equal("Utilities", found.CounterpartyParentCategory);
}

[Fact]
public async Task GetAnnualExpensesAsync_groups_by_counterparty_category()
{
    var cpStore = new SqlCounterpartyStore(db.ConnectionString);
    var cp = await cpStore.CreateAsync($"rel-vendor-{Guid.NewGuid():N}", "Water", "Utilities", null, null, null);

    var store = new SqlExpenseStore(db.ConnectionString);
    var year = 2031; // far-future year avoids collisions with other tests' rows
    await store.RecordExpenseAsync(new AssociationExpense(
        Guid.NewGuid(), 50m, "Test", cp.Id, new DateOnly(year, 5, 1), DateTimeOffset.UtcNow, $"rel-{Guid.NewGuid():N}"));

    var report = await store.GetAnnualExpensesAsync(year);
    var row = Assert.Single(report.Rows.Where(r => r.SubCategory == "Water" && r.MonthNum == 5));
    Assert.Equal("Utilities", row.ParentCategory);
    Assert.Equal(50m, row.Total);
}
```

- [ ] **Step 2: Add to `SqlCounterpartyStoreTests.cs`** — a test proving `DeleteAsync` now returns `HasBills` when a real expense row references the counterparty:

```csharp
[Fact]
public async Task Delete_with_referencing_expense_returns_has_bills()
{
    var store = Store();
    var cp = await store.CreateAsync($"rel-cp-{Guid.NewGuid():N}", "Electricity", "Utilities", null, null, null);

    var expenseStore = new SqlExpenseStore(db.ConnectionString);
    await expenseStore.RecordExpenseAsync(new AssociationExpense(
        Guid.NewGuid(), 10m, "Test bill", cp.Id, new DateOnly(2026, 1, 1), DateTimeOffset.UtcNow, $"rel-{Guid.NewGuid():N}"));

    Assert.IsType<DeleteCounterpartyStoreResult.HasBills>(await store.DeleteAsync(cp.Id));
}
```

- [ ] **Step 3: Add the necessary `using Harmonia.Domain.Expenses;` / `using Harmonia.Api.Reservations.Adapters;` imports to both files if not already present.**
- [ ] **Step 4: Run against real SQL** — `HARMONIA_SQL_CONNSTR=<connstr> dotnet test tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj --filter "Category=Rel&(FullyQualifiedName~Expense|FullyQualifiedName~Counterparty)"` — Expected: all PASS. (If `HARMONIA_SQL_CONNSTR` is unavailable in the execution environment, confirm the project builds and flag as an open gap — same handling as Phase 1.)
- [ ] **Step 5: Commit** — `git add tests/Harmonia.IntegrationTests/SqlExpenseStoreTests.cs tests/Harmonia.IntegrationTests/SqlCounterpartyStoreTests.cs && git commit -m "test(expenses): integration tests for CounterpartyId join and HasBills delete"`

---

### Task A10: Full backend regression

- [ ] **Step 1:** `dotnet build Harmonia.sln` — Expected: PASS, 0 warnings, 0 errors.
- [ ] **Step 2:** `dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj` — Expected: all PASS (337 existing + new expense/counterparty test changes).
- [ ] **Step 3:** If a live `HARMONIA_SQL_CONNSTR` is available, run the full Rel-tier suite once more to confirm nothing else regressed.

---

## Part B — React

### File structure (Part B)

| File | Change |
|------|--------|
| `src/types/index.ts` | Drop `EXPENSE_CATEGORIES`/`PARENT_CATEGORIES`; `ExpenseDto` splits into create/list shapes; `RecordExpenseRequest` gets `counterpartyId` |
| `src/api/expenses.ts` | No new functions — types flow through |
| Create `src/components/financial/CounterpartyPicker.tsx` | Searchable MUI Autocomplete over `getCounterparties()` |
| `src/components/financial/BillsTab.tsx` → rename `OutcomeTab.tsx` | Replace category dropdowns with picker; keep scan-invoice vendor→description mapping |
| Create `src/components/financial/IncomeTab.tsx` | Wraps existing `FeesTab`("Charged")/`PaymentsTab`("Received") as PrimeNG-equivalent MUI sub-tabs |
| `src/components/financial/FeesTab.tsx` | Add Outstanding column (client-side join of `getAllCharges()` + `getBalance()` by householdRef) |
| `src/components/FinancialScreen.tsx` | 3 top tabs: Income / Outcome / Report |
| `src/components/financial/ResidentFinancial.tsx` | Restructure into 2 tabs: Fees / Payments |
| Delete `src/components/ExpensesScreen.tsx` + `.test.tsx` | Dead, unrouted |
| Delete `src/components/PaymentsScreen.tsx` + `.test.tsx` | Dead, unrouted |
| Delete `src/components/MaintenanceFeesScreen.tsx` + `.test.tsx` | Dead, unrouted |

### Task B0: Delete dead screens

- [ ] **Step 1:** `git rm ui/react/src/components/ExpensesScreen.tsx ui/react/src/components/ExpensesScreen.test.tsx ui/react/src/components/PaymentsScreen.tsx ui/react/src/components/PaymentsScreen.test.tsx ui/react/src/components/MaintenanceFeesScreen.tsx ui/react/src/components/MaintenanceFeesScreen.test.tsx`
- [ ] **Step 2:** `grep -rn "ExpensesScreen\|PaymentsScreen\|MaintenanceFeesScreen" ui/react/src` — Expected: no hits (confirms they truly weren't imported anywhere).
- [ ] **Step 3:** `cd ui/react && npm run build` — Expected: PASS.
- [ ] **Step 4: Commit** — `git commit -m "chore(react): remove dead pre-refactor finance screens"`

### Task B1: Update types

**Files:** Modify `src/types/index.ts`

- [ ] **Step 1:** Remove `EXPENSE_CATEGORIES`/`PARENT_CATEGORIES` consts. Update:

```typescript
export interface ExpenseDto {
  id: string; amountEur: number; description: string;
  counterpartyId: string; expenseDate: string; recordedAt: string; idempotencyKey: string;
}

export interface ExpenseListItemDto {
  id: string; amountEur: number; description: string;
  counterpartyId: string; counterpartyName: string;
  counterpartyCategory: string; counterpartyParentCategory: string;
  expenseDate: string; recordedAt: string; idempotencyKey: string;
}

export interface RecordExpenseRequest {
  amountEur: number; description: string; counterpartyId: string;
  expenseDate: string; idempotencyKey: string;
}
```

- [ ] **Step 2:** In `src/api/expenses.ts`, change `getExpenses(): Promise<ExpenseDto[]>` to `getExpenses(): Promise<ExpenseListItemDto[]>` (body unchanged, only the return type) and change `recordExpense(body: RecordExpenseRequest): Promise<ExpenseDto>` — request/response types now match the new backend shapes; no other logic changes.
- [ ] **Step 3: Commit** — `git add ui/react/src/types/index.ts ui/react/src/api/expenses.ts && git commit -m "feat(react): expense types use counterpartyId"`

### Task B2: `CounterpartyPicker` component

**Files:** Create `src/components/financial/CounterpartyPicker.tsx`

- [ ] **Step 1: Write the picker** — MUI `Autocomplete`, fetches via the existing Phase-1 `getCounterparties()`, shows `Name (Category)` in the option list, calls back with the selected `CounterpartyDto | null`:

```tsx
import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getCounterparties, CounterpartyDto } from '../../api/counterparties';

interface Props {
  value: CounterpartyDto | null;
  onChange: (cp: CounterpartyDto | null) => void;
}

export default function CounterpartyPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<CounterpartyDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCounterparties().then(setOptions).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Autocomplete
        options={options}
        loading={loading}
        value={value}
        onChange={(_, v) => onChange(v)}
        getOptionLabel={(o) => `${o.name} (${o.category})`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => (
          <TextField {...params} label={t('finance.counterpartyLabel')} required size="small" />
        )}
      />
      {value && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {value.category} / {value.parentCategory}
        </Typography>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit** — `git add ui/react/src/components/financial/CounterpartyPicker.tsx && git commit -m "feat(react): counterparty picker for the Outcome tab"`

### Task B3: `BillsTab.tsx` → `OutcomeTab.tsx`

**Files:** Read the current `src/components/financial/BillsTab.tsx` in full first (it wasn't captured verbatim during exploration — only its category-dropdown and scan-mapping logic was confirmed). Rename to `OutcomeTab.tsx`.

- [ ] **Step 1:** Read `src/components/financial/BillsTab.tsx` to confirm its exact current form-state shape, scan handler, and table rendering.
- [ ] **Step 2:** Create `src/components/financial/OutcomeTab.tsx` as a copy, with these specific changes:
  - Replace the two category/parentCategory `TextField select` dropdowns with `<CounterpartyPicker value={counterparty} onChange={setCounterparty} />` plus the read-only Category/ParentCategory caption (already inside `CounterpartyPicker`, per B2 — remove any duplicate caption from the old form).
  - `handleSubmit` calls `recordExpense({ amountEur, description: desc, counterpartyId: counterparty!.id, expenseDate: date, idempotencyKey })`; disable submit until `counterparty !== null` (client-side required-field validation per the spec's error-handling table).
  - Keep the invoice-scan handler's `dto.vendor → desc` mapping exactly as today; scanning does **not** auto-select a counterparty (spec: "counterparty must still be selected manually").
  - Expense table columns become: Date · Counterparty · Category · Description · Amount, reading `e.counterpartyName`/`e.counterpartyCategory` from `ExpenseListItemDto` (via `getExpenses()`).
- [ ] **Step 3:** `git rm src/components/financial/BillsTab.tsx` (old file's logic is now folded into `OutcomeTab.tsx`).
- [ ] **Step 4: Build** — `cd ui/react && npm run build` — Expected: FAIL only where `FinancialScreen.tsx` still imports `BillsTab` (fixed in B5).
- [ ] **Step 5: Commit** — `git add ui/react/src/components/financial/OutcomeTab.tsx && git add -u ui/react/src/components/financial/BillsTab.tsx && git commit -m "feat(react): BillsTab -> OutcomeTab with counterparty picker"`

### Task B4: `IncomeTab.tsx` (Charged/Received sub-tabs)

**Files:** Read `src/components/financial/FeesTab.tsx` and `PaymentsTab.tsx` in full first (not captured verbatim during exploration). Create `src/components/financial/IncomeTab.tsx`.

- [ ] **Step 1:** Read both existing tab files to confirm their current form/table structure and the `getAllCharges()`/`getBalance()`/`getAllPayments()` API calls each already makes.
- [ ] **Step 2:** Add an **Outstanding** column to `FeesTab.tsx`'s charges table — per spec, Outstanding is household-level (`SUM(charges) − SUM(payments)` per household), composed client-side from the existing `getAllCharges()` (charge rows) + `getBalance()` (per-household totals, already returns `BalanceLineDto[]` with `totalCharged`/`totalPaid`/`balance` per the DTO shapes found in exploration). Build a `Map<householdRef, number>` from `getBalance()`'s lines and render it as an extra column (or a small summary row per household group) — no new backend endpoint needed, matching the spec exactly.
- [ ] **Step 3:** Confirm `PaymentsTab.tsx`'s table already matches the spec's "Household · Period · Amount · Date Received" column set for the Received sub-tab; adjust column order/labels only if it currently differs.
- [ ] **Step 4:** Write `IncomeTab.tsx` as a thin wrapper with an MUI `Tabs` sub-strip:

```tsx
import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FeesTab from './FeesTab';
import PaymentsTab from './PaymentsTab';

type SubTab = 'charged' | 'received';

export default function IncomeTab() {
  const { t } = useTranslation();
  const [sub, setSub] = useState<SubTab>('charged');

  return (
    <Box>
      <Tabs value={sub} onChange={(_, v) => setSub(v)} sx={{ mb: 2 }}>
        <Tab label={t('finance.subTabCharged')} value="charged" />
        <Tab label={t('finance.subTabReceived')} value="received" />
      </Tabs>
      {sub === 'charged' && <FeesTab />}
      {sub === 'received' && <PaymentsTab />}
    </Box>
  );
}
```

- [ ] **Step 5: Commit** — `git add ui/react/src/components/financial/IncomeTab.tsx ui/react/src/components/financial/FeesTab.tsx ui/react/src/components/financial/PaymentsTab.tsx && git commit -m "feat(react): Income tab with Charged/Received sub-tabs, Outstanding column"`

### Task B5: `FinancialScreen.tsx` — 3 top tabs

**Files:** Modify `src/components/FinancialScreen.tsx`

- [ ] **Step 1: Rewrite**

```tsx
import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import IncomeTab from './financial/IncomeTab';
import OutcomeTab from './financial/OutcomeTab';
import ReportTab from './financial/ReportTab';
import ResidentFinancial from './financial/ResidentFinancial';

interface Props { role: 'resident' | 'admin'; }
type FinTab = 'income' | 'outcome' | 'report';

export default function FinancialScreen({ role }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FinTab>('income');

  if (role !== 'admin') return <ResidentFinancial />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label={t('finance.tabIncome')} value="income" />
        <Tab label={t('finance.tabOutcome')} value="outcome" />
        <Tab label={t('finance.tabReport')} value="report" />
      </Tabs>
      {tab === 'income' && <IncomeTab />}
      {tab === 'outcome' && <OutcomeTab />}
      {tab === 'report' && <ReportTab />}
    </Box>
  );
}
```

- [ ] **Step 2: Build** — `cd ui/react && npm run build` — Expected: PASS.
- [ ] **Step 3: Commit** — `git add ui/react/src/components/FinancialScreen.tsx && git commit -m "feat(react): Finance screen reorg to Income/Outcome/Report"`

### Task B6: `ResidentFinancial.tsx` — 2 tabs

**Files:** Read `src/components/financial/ResidentFinancial.tsx` in full first (already know its 4 sections: period-summary card, Fees section, Payments/balance section, Request-Payment dialog — but need exact JSX to restructure precisely).

- [ ] **Step 1:** Read the file to confirm exact current markup for each section.
- [ ] **Step 2:** Restructure into MUI `Tabs`: keep the period-summary card **above** the tabs (it summarizes both fees and expenses, doesn't belong to one tab); put the Fees section's content inside a "Fees" tab panel; put the Payments/balance section **and** the "Request Payment" button+dialog inside a "Payments" tab panel (payment-related UI belongs together):

```tsx
// Structural sketch — implementer fills in the exact existing JSX for each section body.
<Box>
  {/* existing period-summary card, unchanged, stays above the tabs */}
  <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 2, mb: 2 }}>
    <Tab label={t('finance.residentTabFees')} value="fees" />
    <Tab label={t('finance.residentTabPayments')} value="payments" />
  </Tabs>
  {tab === 'fees' && ( /* existing Fees section JSX, unchanged */ )}
  {tab === 'payments' && ( /* existing Payments/balance section JSX + Request Payment button/dialog, unchanged */ )}
</Box>
```

- [ ] **Step 3: Build + test** — `cd ui/react && npm run build && npm test` — Expected: PASS. `FinancialScreen.test.tsx`'s `'resident view has no tabs'` test will need updating (see B7) since residents now legitimately have tabs.
- [ ] **Step 4: Commit** — `git add ui/react/src/components/financial/ResidentFinancial.tsx && git commit -m "feat(react): resident Finance screen split into Fees/Payments tabs"`

### Task B7: Update existing React tests for the new tab structure

**Files:** Modify `src/components/FinancialScreen.test.tsx` and any test referencing `finance.tabBills`/`BillsTab`/no-tabs-for-resident.

- [ ] **Step 1:** Update `'resident view has no tabs'` → `'resident view has Fees and Payments tabs'` (assert `screen.getAllByRole('tab')` has length 2 with the right labels) since the underlying behavior changed intentionally.
- [ ] **Step 2:** Update `'admin sees Bills as the default active tab'` → `'admin sees Income as the default active tab'`.
- [ ] **Step 3:** Rename/adjust any `BillsTab.test.tsx` to `OutcomeTab.test.tsx` if one exists (check `src/components/financial/*.test.tsx` — none were explicitly found during exploration, but verify before assuming).
- [ ] **Step 4: Run** — `npm test` — Expected: PASS, no new failures beyond the pre-existing baseline noted in Phase 1 (`App.statusgate.test.tsx`, `ContactEditScreen.test.tsx`, `ExpensesScreen.test.tsx` [now deleted, so that failure disappears], `ReservationScreen.test.tsx`).
- [ ] **Step 5: Commit** — `git add ui/react/src/components/FinancialScreen.test.tsx && git commit -m "test(react): update finance screen tests for Income/Outcome/Report tabs"`

---

## Part C — Angular

Mirrors Part B 1:1 in Angular/PrimeNG idiom.

### File structure (Part C)

| File | Change |
|------|--------|
| Delete `src/app/expenses/expense.component.ts` (+ spec, + service if unused elsewhere) | Dead |
| Delete `src/app/maintenance-fees/maintenance-fee.component.ts` (+ spec) — **keep `maintenance-fee.service.ts`**, it's used by `fees-tab.component.ts` | Dead component only |
| Delete `src/app/payments/payment.component.ts` (+ spec) — **keep `payment.service.ts`**, used by `payments-tab.component.ts` | Dead component only |
| Modify `src/app/app.routes.ts` | Remove the 3 live dead-component routes AND the 3 already-unreachable redirect entries beneath them |
| `src/app/expenses/models.ts` | Drop `EXPENSE_CATEGORIES`/`PARENT_CATEGORIES`; add `counterpartyId` to request; split `ExpenseDto`/`ExpenseListItemDto` |
| `src/app/expenses/expense.service.ts` | Return-type update for `getExpenses()` |
| Create `src/app/financial/counterparty-picker.component.ts` | PrimeNG `p-select`/searchable picker over `CounterpartyService.list()` |
| `src/app/financial/tabs/bills-tab.component.ts` → rename `outcome-tab.component.ts` | Picker replaces dropdowns |
| Create `src/app/financial/tabs/income-tab.component.ts` | `p-tabs` wrapping `fees-tab`("Charged")/`payments-tab`("Received") |
| `src/app/financial/tabs/fees-tab.component.ts` | Add Outstanding column |
| `src/app/financial.component.ts` | 3 top `p-tab`s: Income / Outcome / Report |
| `src/app/financial/tabs/resident-financial.component.ts` | Restructure into 2 `p-tab`s |

**Note on `expense.service.ts`:** Angular's `expense.service.ts` is used both by the doomed standalone `expense.component.ts` (deleted in C0) *and* by `bills-tab.component.ts`/`report-tab.component.ts` (kept, renamed to `outcome-tab.component.ts` in C4). Do not delete `expense.service.ts` — only the standalone component.

### Task C0: Delete dead components + dead routes

- [ ] **Step 1:** `git rm ui/angular/src/app/expenses/expense.component.ts ui/angular/src/app/expenses/expense.component.spec.ts ui/angular/src/app/maintenance-fees/maintenance-fee.component.ts ui/angular/src/app/maintenance-fees/maintenance-fee.component.spec.ts ui/angular/src/app/payments/payment.component.ts ui/angular/src/app/payments/payment.component.spec.ts` (verify each spec file's exact name first with `ls` — don't guess).
- [ ] **Step 2:** In `src/app/app.routes.ts`, remove BOTH of these groups entirely (the live component routes and the already-unreachable redirects beneath them):
```typescript
// REMOVE:
{ path: 'expenses', component: ExpenseComponent, canActivate: guard },
{ path: 'maintenance-fees', component: MaintenanceFeeComponent, canActivate: guard },
{ path: 'payments', component: PaymentComponent, canActivate: guard },
{ path: 'expenses', redirectTo: 'financial', pathMatch: 'full' },
{ path: 'maintenance-fees', redirectTo: 'financial', pathMatch: 'full' },
{ path: 'payments', redirectTo: 'financial', pathMatch: 'full' },
```
Also remove the now-unused `ExpenseComponent`/`MaintenanceFeeComponent`/`PaymentComponent` imports at the top of `app.routes.ts`.
- [ ] **Step 3:** `grep -rn "ExpenseComponent\b" ui/angular/src/app/app.routes.ts` — Expected: no hits. Confirm `expense.service.ts`, `maintenance-fee.service.ts`, `payment.service.ts` are NOT deleted (still used by the `financial/tabs/*` components).
- [ ] **Step 4:** `cd ui/angular && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A ui/angular/src/app/expenses ui/angular/src/app/maintenance-fees ui/angular/src/app/payments ui/angular/src/app/app.routes.ts && git commit -m "chore(angular): remove dead pre-refactor finance components and shadowed routes"`

### Task C1: Update `expenses/models.ts` + `expense.service.ts`

**Files:** Read `src/app/expenses/models.ts` and `src/app/expenses/expense.service.ts` in full first (referenced but not captured verbatim during exploration beyond `EXPENSE_CATEGORIES`/`PARENT_CATEGORIES`/`ExpenseDto`/`ScannedInvoiceDto`).

- [ ] **Step 1:** Read both files.
- [ ] **Step 2:** In `models.ts`: remove `EXPENSE_CATEGORIES`/`PARENT_CATEGORIES`; mirror the React B1 type split:

```typescript
export interface ExpenseDto {
  id: string; amountEur: number; description: string;
  counterpartyId: string; expenseDate: string; recordedAt: string; idempotencyKey: string;
}

export interface ExpenseListItemDto {
  id: string; amountEur: number; description: string;
  counterpartyId: string; counterpartyName: string;
  counterpartyCategory: string; counterpartyParentCategory: string;
  expenseDate: string; recordedAt: string; idempotencyKey: string;
}

export interface RecordExpenseRequest {
  amountEur: number; description: string; counterpartyId: string;
  expenseDate: string; idempotencyKey: string;
}
```
(Keep `ScannedInvoiceDto` and any income/annual-report types in this file unchanged.)
- [ ] **Step 3:** In `expense.service.ts`, change `getExpenses(): Observable<ExpenseDto[]>` to `getExpenses(): Observable<ExpenseListItemDto[]>` — body/URL unchanged.
- [ ] **Step 4: Commit** — `git add ui/angular/src/app/expenses/models.ts ui/angular/src/app/expenses/expense.service.ts && git commit -m "feat(angular): expense types use counterpartyId"`

### Task C2: `CounterpartyPickerComponent`

**Files:** Create `src/app/financial/counterparty-picker.component.ts`

- [ ] **Step 1:** Use the same PrimeNG `p-select`/`SelectModule` API confirmed during Phase 1's Households ref-picker work (`primeng/select`, selector `p-select`, `[options]`/`optionLabel`/`optionValue`). Mirror `CounterpartyService.list()` (Phase 1) for the fetch pattern:

```typescript
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CounterpartyService } from '../counterparties/counterparty.service';
import { Counterparty } from '../counterparties/counterparty.models';

@Component({
  selector: 'app-counterparty-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, TranslatePipe],
  template: `
    <p-select
      [options]="options"
      [(ngModel)]="selectedId"
      (onChange)="onSelect()"
      optionLabel="label" optionValue="value"
      [filter]="true"
      [placeholder]="'finance.counterpartyLabel' | translate"
      styleClass="w-full"
    />
    @if (selected) {
      <div class="picker-caption">{{ selected.category }} / {{ selected.parentCategory }}</div>
    }
  `,
  styles: [`
    .picker-caption { font-size: 0.8125rem; color: var(--p-text-muted-color); margin-top: 0.25rem; }
    .w-full { width: 100%; }
  `],
})
export class CounterpartyPickerComponent implements OnInit {
  private readonly svc = inject(CounterpartyService);
  readonly t = inject(TranslateService);

  @Output() counterpartyChange = new EventEmitter<Counterparty | null>();

  counterparties: Counterparty[] = [];
  options: { label: string; value: string }[] = [];
  selectedId: string | null = null;
  selected: Counterparty | null = null;

  ngOnInit() {
    this.svc.list().subscribe(list => {
      this.counterparties = list;
      this.options = list.map(c => ({ label: `${c.name} (${c.category})`, value: c.id }));
    });
  }

  onSelect() {
    this.selected = this.counterparties.find(c => c.id === this.selectedId) ?? null;
    this.counterpartyChange.emit(this.selected);
  }
}
```

- [ ] **Step 2: Commit** — `git add ui/angular/src/app/financial/counterparty-picker.component.ts && git commit -m "feat(angular): counterparty picker for the Outcome tab"`

### Task C3: `bills-tab.component.ts` → `outcome-tab.component.ts`

**Files:** Already have the full current content of `bills-tab.component.ts` (captured during exploration — see plan Context / Angular findings above). Create `src/app/financial/tabs/outcome-tab.component.ts`.

- [ ] **Step 1:** Copy `bills-tab.component.ts`'s structure into `outcome-tab.component.ts`, replacing:
  - The two `<select name="billCat">`/`<select name="billParent">` blocks (and their `expCategories`/`parentCategories` bindings) with `<app-counterparty-picker (counterpartyChange)="onCounterpartyChange($event)" />`.
  - `billForm` drops `category`/`parentCategory`; add `selectedCounterparty: Counterparty | null = null`.
  - `onSubmit()`'s validation gains: `if (!this.selectedCounterparty) { this.formErr.set(this.t.instant('finance.errCounterpartyRequired')); return; }` before the existing amount check, and the `recordExpense(...)` call sends `counterpartyId: this.selectedCounterparty.id` instead of `category`/`parentCategory`.
  - `onInvoiceSelected`'s scan-result mapping keeps `description: dto.vendor ?? ''` exactly as today; do **not** auto-select a counterparty from the scan result (spec: manual selection required).
  - The expenses table's `<th>{{ 'expenses.category' | translate }}</th>`/`<td>{{ e.category }}</td>` becomes a Counterparty column reading `e.counterpartyName`/`e.counterpartyCategory` from `ExpenseListItemDto` (via `ExpenseService.getExpenses()`).
  - Import `CounterpartyPickerComponent` and add it to the component's `imports:` array.
- [ ] **Step 2:** `git rm ui/angular/src/app/financial/tabs/bills-tab.component.ts` (and its spec file, mirrored into `outcome-tab.component.spec.ts` if a meaningful test existed — check `bills-tab.component.spec.ts`'s content first before deciding whether to port or rewrite it).
- [ ] **Step 3: Build** — `cd ui/angular && npm run build` — Expected: FAIL only where `financial.component.ts` still imports `BillsTabComponent` (fixed in C5).
- [ ] **Step 4: Commit** — `git add ui/angular/src/app/financial/tabs/outcome-tab.component.ts && git add -u ui/angular/src/app/financial/tabs/bills-tab.component.ts && git commit -m "feat(angular): bills-tab -> outcome-tab with counterparty picker"`

### Task C4: `income-tab.component.ts` (Charged/Received sub-tabs)

**Files:** Read `src/app/financial/tabs/fees-tab.component.ts` and `payments-tab.component.ts` in full first. Create `src/app/financial/tabs/income-tab.component.ts`.

- [ ] **Step 1:** Read both files to confirm current form/table structure and existing `MaintenanceFeeService`/`PaymentService` calls (`getAllCharges`, `getBalance`, `getAllPayments` per signatures already confirmed during exploration).
- [ ] **Step 2:** Add an Outstanding column to `fees-tab.component.ts`'s charges table — client-side join of `getAllCharges()` rows against a `Map<householdRef, number>` built from `PaymentService.getBalance()`'s `BalanceDto.lines` (`{householdRef, totalCharged, totalPaid, balance}` per already-confirmed shape), same approach as React B4 — no new backend endpoint.
- [ ] **Step 3:** Confirm `payments-tab.component.ts`'s table matches "Household · Period · Amount · Date Received"; adjust only if it currently differs.
- [ ] **Step 4:** Write `income-tab.component.ts` using PrimeNG `p-tabs` (same API as `financial.component.ts` already uses):

```typescript
import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { TranslatePipe } from '@ngx-translate/core';
import { FeesTabComponent } from './fees-tab.component';
import { PaymentsTabComponent } from './payments-tab.component';

@Component({
  selector: 'app-income-tab',
  standalone: true,
  imports: [TabsModule, TranslatePipe, FeesTabComponent, PaymentsTabComponent],
  template: `
    <p-tabs value="charged">
      <p-tablist>
        <p-tab value="charged">{{ 'finance.subTabCharged' | translate }}</p-tab>
        <p-tab value="received">{{ 'finance.subTabReceived' | translate }}</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="charged"><app-fees-tab /></p-tabpanel>
        <p-tabpanel value="received"><app-payments-tab /></p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
})
export class IncomeTabComponent {}
```

- [ ] **Step 5: Commit** — `git add ui/angular/src/app/financial/tabs/income-tab.component.ts ui/angular/src/app/financial/tabs/fees-tab.component.ts && git commit -m "feat(angular): Income tab with Charged/Received sub-tabs, Outstanding column"`

### Task C5: `financial.component.ts` — 3 top tabs

**Files:** Modify `src/app/financial.component.ts`

- [ ] **Step 1:** Replace the 4-tab `p-tabs` block with 3 tabs (Income/Outcome/Report), swapping the imports (`IncomeTabComponent`, `OutcomeTabComponent` replacing `BillsTabComponent`/`FeesTabComponent`/`PaymentsTabComponent` at the top level — `FeesTabComponent`/`PaymentsTabComponent` are still used, just nested inside `IncomeTabComponent` now, not imported directly here):

```typescript
@Component({
  // ...
  imports: [
    CommonModule, RouterModule,
    CardModule, ButtonModule, TabsModule,
    TranslatePipe, NavComponent,
    IncomeTabComponent, OutcomeTabComponent, ReportTabComponent,
    ResidentFinancialComponent,
  ],
  template: `
    <div class="harmonia-shell">
      <app-nav [role]="role" (roleChange)="role = $event" />
      <main class="harmonia-content">
        <p-card>
          <ng-template #content>
            @if (role === 'admin') {
              <p-tabs value="income">
                <p-tablist>
                  <p-tab value="income">{{ 'finance.tabIncome' | translate }}</p-tab>
                  <p-tab value="outcome">{{ 'finance.tabOutcome' | translate }}</p-tab>
                  <p-tab value="report">{{ 'finance.tabReport' | translate }}</p-tab>
                </p-tablist>
                <p-tabpanels>
                  <p-tabpanel value="income"><app-income-tab /></p-tabpanel>
                  <p-tabpanel value="outcome"><app-outcome-tab /></p-tabpanel>
                  <p-tabpanel value="report"><app-report-tab /></p-tabpanel>
                </p-tabpanels>
              </p-tabs>
            } @else {
              <app-resident-financial />
            }
          </ng-template>
        </p-card>
      </main>
    </div>
  `,
  // styles: unchanged shell CSS
})
export class FinancialComponent {
  readonly isAdmin = inject(RoleService).isAdmin;
  role: 'resident' | 'admin' = inject(RoleService).isAdmin ? 'admin' : 'resident';
}
```

- [ ] **Step 2: Build** — `cd ui/angular && npm run build` — Expected: PASS.
- [ ] **Step 3: Commit** — `git add ui/angular/src/app/financial.component.ts && git commit -m "feat(angular): Finance screen reorg to Income/Outcome/Report"`

### Task C6: `resident-financial.component.ts` — 2 tabs

**Files:** Read `src/app/financial/tabs/resident-financial.component.ts` in full first (same 4-section structure as React's `ResidentFinancial.tsx`, confirmed during exploration, but exact PrimeNG markup not captured verbatim).

- [ ] **Step 1:** Read the file to confirm exact current section markup.
- [ ] **Step 2:** Restructure using PrimeNG `p-tabs`, same layout decision as React B6: period-summary card stays above the tabs; Fees section becomes the "Fees" tab; Payments/balance section + Request-Payment dialog become the "Payments" tab.
- [ ] **Step 3: Build + test** — `cd ui/angular && npm run build && npm test` — Expected: PASS (accounting for the same pre-existing 8-failure baseline from Phase 1: `expense.component.spec.ts`'s failure disappears since that file is now deleted — confirm the baseline count drops to 7, not 8, and that the 7 remaining are exactly `contact-edit` (3) + `reservations` (4)).
- [ ] **Step 4: Commit** — `git add ui/angular/src/app/financial/tabs/resident-financial.component.ts && git commit -m "feat(angular): resident Finance screen split into Fees/Payments tabs"`

### Task C7: Update existing Angular tests + i18n-parity check

**Files:** Modify `src/app/financial.component.spec.ts` if one exists (verify first), `bills-tab.component.spec.ts` → port relevant assertions into a new `outcome-tab.component.spec.ts` or confirm none are lost.

- [ ] **Step 1:** Run `npm test` and fix any spec asserting on the old 4-tab structure, `finance.tabBills`, or the deleted `bills-tab`/`expense`/`maintenance-fee`/`payment` components.
- [ ] **Step 2:** Confirm `i18n-parity.spec.ts` still passes once Part D's i18n keys land (this task's code changes alone shouldn't affect it, but re-run after Part D too).
- [ ] **Step 3: Commit** — `git add -A ui/angular/src/app && git commit -m "test(angular): update finance screen tests for Income/Outcome/Report tabs"`

---

## Part D — i18n

### New/renamed keys (both apps, all 6 locale files)

Add to `finance.*` (React `src/i18n/locales/{en,bg,ru}.json`; Angular `public/assets/i18n/{en,bg,ru}.json`):

```json
"tabIncome": "Income",
"tabOutcome": "Outcome",
"subTabCharged": "Charged",
"subTabReceived": "Received",
"counterpartyLabel": "Counterparty",
"errCounterpartyRequired": "Please select a counterparty.",
"residentTabFees": "Fees",
"residentTabPayments": "Payments"
```

Remove (now dead — no longer referenced by any component after B3-B6/C3-C6): `finance.tabBills`, `finance.tabFees`, `finance.tabPayments`, `finance.addBill` (replaced conceptually but the Outcome tab reuses `finance.scanInvoice`/`orEnterManually`/`clearForm` as-is — verify each is still referenced before removing), plus the already-orphaned leftovers found during exploration if convenient to clean up in the same pass: `finance.myCharges`/`myPayments`/`noCharges`/`noPayments` (React — verify unused first), `expenses.ledger`, `fees.allCharges`/`myCharges` (Angular has different unused set — verify per-app before deleting, since a key orphaned in one app may still be referenced in the other).

**`expenses.category`/`expenses.parentCategory`** stay (still referenced by the Outcome tab's expense table headers, now showing `counterpartyCategory`/`counterpartyParentCategory` values under the same generic labels) — do not remove.

- [ ] **Step 1:** Add the 8 new `finance.*` keys above to all 6 locale files, translating bg/ru naturally.
- [ ] **Step 2:** For each of the "remove" candidates, `grep -rn "'finance\.tabBills'\|finance\.tabBills" ui/react/src ui/angular/src` (repeat per key) to confirm zero remaining references before deleting from the locale files — do this per app since usage differs.
- [ ] **Step 3:** Angular — run `npm test` and confirm `i18n-parity.spec.ts`'s 2 tests pass (bg/ru key sets exactly match en after your additions+removals).
- [ ] **Step 4:** `cd ui/react && npm run build` and `cd ui/angular && npm run build && npm test` — Expected: PASS, same known baselines (Angular: 7 failures now, per C6 note — `contact-edit` 3 + `reservations` 4, since `expense.component.spec.ts`'s failure is gone with the file).
- [ ] **Step 5: Commit** — `git add ui/react/src/i18n ui/angular/public/assets/i18n && git commit -m "i18n(finance): add Income/Outcome/Charged/Received keys, prune dead Bills-tab keys"`

---

## Verification (end-to-end)

**Backend:**
```
dotnet build Harmonia.sln
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
# Real SQL (never in-memory):
$env:HARMONIA_SQL_CONNSTR = "<local dev SQL Server connstr>"   # git-ignored; never commit
dotnet test tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj --filter "Category=Rel&(FullyQualifiedName~Expense|FullyQualifiedName~Counterparty)"
```
Expected: all green. **Before running the integration tests against a shared/dev database, confirm with the human that TRUNCATE TABLE dbo.AssociationExpenses is acceptable in that environment** — the migration is destructive by design (spec-approved, no production data to preserve) but must never run against a database anyone cares about without that explicit check.

**React:** `cd ui/react && npm run build && npm test` — build clean; Jest green (same pre-existing baseline as Phase 1, minus `ExpensesScreen.test.tsx`'s failure since that file is deleted). Manual: sign in as admin → Finance → Income tab shows Charged/Received sub-tabs with Outstanding column; Outcome tab requires picking a counterparty before submit, scan still pre-fills amount/date/description only; Report tab unchanged. Sign in as resident → Finance shows Fees/Payments tabs.

**Angular:** `cd ui/angular && npm run build && npm test` — build clean; Vitest green (7 known pre-existing failures, not 8, per C6). Manual: same admin/resident checks as React, PrimeNG `p-tabs` variant.

**Manual API smoke (admin token):**
```
POST /expenses { amountEur, description, counterpartyId, expenseDate, idempotencyKey } → 201, no category/parentCategory in body
GET  /expenses → 200, each item has counterpartyId/counterpartyName/counterpartyCategory/counterpartyParentCategory, no category/parentCategory
DELETE /counterparties/{id-with-a-real-expense} → 409
DELETE /counterparties/{id-with-no-expenses} → 204
```

**Constraints honoured:** R2 — admin identity unchanged (`session.Resolve()`, still gating `RecordExpense`/`ListExpenses`). R3 — no PII logged (unchanged). C1 — no new Azure resources. No secrets committed. TDD — every backend task pairs a code change with its test update in the same or immediately following task.

---

## Self-Review

**Spec coverage** (governing Phase 2 spec, section by section):
- Modified `AssociationExpenses` table (TRUNCATE + drop columns + required FK) → Task A0, placed correctly after `Counterparties` in file order ✓
- Annual report JOIN, unchanged output shape → Task A4 (SQL only; `GetAnnualReport.cs`/`ExcelReportBuilder.cs` untouched, confirmed no changes needed) ✓
- `POST /expenses` counterpartyId required, category/parentCategory removed → Tasks A3/A6 (use case + endpoint) ✓
- `GET /expenses` joined response → Tasks A2/A4/A6 (`ExpenseListItem`/`ExpenseListItemDto`) ✓
- Delete-with-bills → 409 → Task A5 (real pre-check; DU/endpoint mapping already existed from Phase 1) ✓
- Income tab: Charged sub-tab (form unchanged + charges table + Outstanding, client-side composition, no new endpoint) → Tasks B4/C4 ✓
- Income tab: Received sub-tab (form unchanged + payments table) → Tasks B4/C4 ✓
- Outcome tab: required counterparty picker, auto-fill Category/ParentCategory read-only, scan pre-fills Amount/Date/Description only, manual counterparty selection required → Tasks B2/B3/C2/C3 ✓
- Report tab unchanged in structure → no task touches `ReportTab.tsx`/`report-tab.component.ts` beyond what the JOIN already handles transparently ✓
- Resident: 2 tabs, Fees/Payments, no bills tab → Tasks B6/C6 (confirmed: nothing to remove, tabs are new) ✓
- Error handling table (409/required-field/duplicate/404) → A5 (409), B3/C3 (required-field), unchanged idempotency Duplicate path (A4/A6), existing 404 on counterparty GET (Phase 1, untouched) ✓
- Out-of-scope items (settlement linking, bulk import, expense edit/delete, invoice attachment storage) — none introduced ✓
- User's dead-code decision → Tasks B0/C0 ✓

**Placeholder scan:** Tasks B3/B4/B6/C3/C4/C6 open with an explicit "read the current file first" step because `BillsTab.tsx`/`FeesTab.tsx`/`PaymentsTab.tsx`/`ResidentFinancial.tsx` and their Angular counterparts were not captured verbatim during exploration (only their responsibilities and key API calls were) — this is a deliberate, bounded exception to "no placeholders," consistent with how Phase 1 handled screens whose sibling reference file was fully shown elsewhere; every OTHER task in this plan has complete, literal code. No TBD/TODO anywhere.

**Type consistency:** `CounterpartyId`/`counterpartyId` naming is consistent across the domain record (A1), ports (A2), use case (A3), SQL store (A4), endpoints (A6), fakes (A7), and both frontends' types (B1/C1). `ExpenseListItem`/`ExpenseListItemDto` field names (`counterpartyName`/`counterpartyCategory`/`counterpartyParentCategory`) match exactly between the Application-layer record (A2), the SQL projection (A4), the endpoint DTO (A6), and both frontend interfaces (B1/C1). `HasBills` DU case name unchanged from Phase 1 through to the real implementation (A5).
