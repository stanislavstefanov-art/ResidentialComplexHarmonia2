# Expense Recording — Design

**Status:** Approved (autonomous spec.approved — tech-lead-reviewer)
**Closes:** nothing in gap-log; new feature slice

## Goal

Admin records complex-wide association expenses (gardening, cleaning, elevator maintenance, utilities, admin costs, etc.); residents and admin can list them. Append-only ledger, same idempotency-key pattern as the maintenance fee charge ledger.

## How this differs from the maintenance fee charge ledger

| Dimension | MaintenanceFeeCharge | AssociationExpense |
|---|---|---|
| Scope | Per-household | Complex-wide (no HouseholdRef) |
| Time field | `Period` (string, e.g. "2026-07") | `ExpenseDate` (DateOnly — accounting date) |
| Write guard | Admin only | Admin only |
| Read guard | Resident only (own household) | **Resident OR admin** |
| Idempotency PK | `(HouseholdRef, IdempotencyKey)` | `IdempotencyKey` alone |

Everything else — domain model shape, result union, ADO.NET store, endpoint pattern, TypedResults, test structure — is identical.

## Architecture

Three-layer: `Harmonia.Domain.Expenses` → `Harmonia.Application.Expenses` → `Harmonia.Api.Expenses`.
All names are symmetric with the maintenance fee ledger. No shared types are mutated.

### Domain — `src/Harmonia.Domain/Expenses/AssociationExpense.cs`

```csharp
namespace Harmonia.Domain.Expenses;

public sealed record AssociationExpense(
    Guid       Id,
    decimal    AmountEur,
    string     Description,
    string     Category,
    DateOnly   ExpenseDate,
    DateTimeOffset RecordedAt,
    string     IdempotencyKey);
```

`ExpenseDate` is the accounting date supplied by the admin (when the service occurred or invoice is dated). `RecordedAt` is server time at persistence (`DateTimeOffset.UtcNow` in the use case).

### Application — `src/Harmonia.Application/Expenses/Ports.cs`

```csharp
namespace Harmonia.Application.Expenses;

public abstract record RecordExpenseResult
{
    private RecordExpenseResult() { }
    public sealed record Refused  : RecordExpenseResult;
    public sealed record Created(AssociationExpense Expense) : RecordExpenseResult;
    public sealed record Duplicate(AssociationExpense Expense) : RecordExpenseResult;
    public sealed record Failed   : RecordExpenseResult;
}

public abstract record ListExpensesResult
{
    private ListExpensesResult() { }
    public sealed record Refused  : ListExpensesResult;
    public sealed record Ok(IReadOnlyList<AssociationExpense> Expenses) : ListExpensesResult;
    public sealed record Failed   : ListExpensesResult;
}

public interface IExpenseStore
{
    Task<RecordExpenseResult> RecordExpenseAsync(AssociationExpense expense, CancellationToken ct = default);
    Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(CancellationToken ct = default);
}
```

### Application — `src/Harmonia.Application/Expenses/RecordExpense.cs`

```csharp
public sealed class RecordExpense(ISession session, IExpenseStore store)
{
    public async Task<RecordExpenseResult> ExecuteAsync(
        decimal amountEur, string description, string category,
        DateOnly expenseDate, string idempotencyKey, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordExpenseResult.Refused();

        var expense = new AssociationExpense(
            Id: Guid.NewGuid(),
            AmountEur: amountEur,
            Description: description,
            Category: category,
            ExpenseDate: expenseDate,
            RecordedAt: DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        return await store.RecordExpenseAsync(expense, ct);
    }
}
```

### Application — `src/Harmonia.Application/Expenses/ListExpenses.cs`

```csharp
public sealed class ListExpenses(ISession session, IExpenseStore store)
{
    public async Task<ListExpensesResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new ListExpensesResult.Refused();

        try
        {
            var expenses = await store.ListExpensesAsync(ct);
            return new ListExpensesResult.Ok(expenses);
        }
        catch (Exception)
        {
            return new ListExpensesResult.Failed();
        }
    }
}
```

Read guard: resident OR admin. A user with neither flag (authenticated but no role claim) is refused.

### API adapter — `src/Harmonia.Api/Adapters/SqlExpenseStore.cs`

```csharp
public sealed class SqlExpenseStore(string connectionString) : IExpenseStore
{
    private const int UniqueIndexViolation     = 2601;
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
                "(Id, AmountEur, Description, Category, ExpenseDate, RecordedAt, IdempotencyKey) " +
                "VALUES (@Id, @AmountEur, @Description, @Category, @ExpenseDate, @RecordedAt, @IdempotencyKey);";
            cmd.Parameters.AddWithValue("@Id", expense.Id);
            cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal) { Value = expense.AmountEur, Precision = 18, Scale = 2 });
            cmd.Parameters.AddWithValue("@Description", expense.Description);
            cmd.Parameters.AddWithValue("@Category", expense.Category);
            cmd.Parameters.Add(new SqlParameter("@ExpenseDate", SqlDbType.Date) { Value = expense.ExpenseDate.ToDateTime(TimeOnly.MinValue) });
            cmd.Parameters.Add(new SqlParameter("@RecordedAt", SqlDbType.DateTimeOffset) { Value = expense.RecordedAt });
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

    public async Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, AmountEur, Description, Category, ExpenseDate, RecordedAt, IdempotencyKey " +
            "FROM dbo.AssociationExpenses " +
            "ORDER BY RecordedAt DESC;";

        var results = new List<AssociationExpense>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new AssociationExpense(
                Id:             reader.GetGuid(0),
                AmountEur:      reader.GetDecimal(1),
                Description:    reader.GetString(2),
                Category:       reader.GetString(3),
                ExpenseDate:    DateOnly.FromDateTime(reader.GetDateTime(4)),
                RecordedAt:     reader.GetDateTimeOffset(5),
                IdempotencyKey: reader.GetString(6)));
        }
        return results;
    }

    private async Task<AssociationExpense> LoadExistingAsync(string idempotencyKey, CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, AmountEur, Description, Category, ExpenseDate, RecordedAt, IdempotencyKey " +
            "FROM dbo.AssociationExpenses WHERE IdempotencyKey = @IdempotencyKey;";
        cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return new AssociationExpense(
            Id:             reader.GetGuid(0),
            AmountEur:      reader.GetDecimal(1),
            Description:    reader.GetString(2),
            Category:       reader.GetString(3),
            ExpenseDate:    DateOnly.FromDateTime(reader.GetDateTime(4)),
            RecordedAt:     reader.GetDateTimeOffset(5),
            IdempotencyKey: reader.GetString(6));
    }
}
```

### API endpoints — `src/Harmonia.Api/Expenses/ExpenseEndpoints.cs`

```csharp
public sealed record RecordExpenseRequest(
    decimal  AmountEur,
    string   Description,
    string   Category,
    DateOnly ExpenseDate,
    string   IdempotencyKey);

public sealed record ExpenseDto(
    Guid     Id,
    decimal  AmountEur,
    string   Description,
    string   Category,
    DateOnly ExpenseDate,
    DateTimeOffset RecordedAt,
    string   IdempotencyKey);

public static class ExpenseEndpoints
{
    public static async Task<IResult> RecordExpenseEndpoint(
        RecordExpense useCase, RecordExpenseRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            body.AmountEur, body.Description, body.Category, body.ExpenseDate, body.IdempotencyKey, ct);
        return result switch
        {
            RecordExpenseResult.Refused   => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            RecordExpenseResult.Created c => { logger.LogInformation("Expense recorded: created"); return TypedResults.Json(ToDto(c.Expense), statusCode: 201); },
            RecordExpenseResult.Duplicate d => { logger.LogInformation("Expense recorded: duplicate"); return TypedResults.Json(ToDto(d.Expense), statusCode: 200); },
            RecordExpenseResult.Failed    => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                             => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> ListExpensesEndpoint(
        ListExpenses useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        return result switch
        {
            ListExpensesResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            ListExpensesResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            ListExpensesResult.Ok ok    => { logger.LogInformation("Expenses listed: {Count}", ok.Expenses.Count); return TypedResults.Json(ok.Expenses.Select(ToDto).ToList(), statusCode: 200); },
            _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static ExpenseDto ToDto(AssociationExpense e) =>
        new(e.Id, e.AmountEur, e.Description, e.Category, e.ExpenseDate, e.RecordedAt, e.IdempotencyKey);
}
```

Note: `switch` expression with statement bodies isn't valid C# — the plan will use the `switch` statement form (same as `MaintenanceFeeEndpoints`) for both methods.

### `db/schema.sql` addition

```sql
IF OBJECT_ID(N'dbo.AssociationExpenses', N'U') IS NULL
CREATE TABLE dbo.AssociationExpenses
(
    Id             uniqueidentifier  NOT NULL,
    AmountEur      decimal(18, 2)    NOT NULL,
    Description    nvarchar(256)     NOT NULL,
    Category       nvarchar(128)     NOT NULL,
    ExpenseDate    date              NOT NULL,
    RecordedAt     datetimeoffset(3) NOT NULL,
    IdempotencyKey nvarchar(128)     NOT NULL,
    CONSTRAINT PK_AssociationExpenses PRIMARY KEY (IdempotencyKey),
    CONSTRAINT UQ_AssociationExpenses_Id UNIQUE (Id)
);
```

`IdempotencyKey` is the sole PK — expenses are complex-wide so there is no household to scope it under. Duplicate INSERT on the same key → SQL error 2627 → `Duplicate` result.

### `Program.cs` additions

```csharp
// Connection string
var expConnString = builder.Configuration.GetConnectionString("Expenses");
if (string.IsNullOrWhiteSpace(expConnString))
    throw new InvalidOperationException("ConnectionStrings:Expenses is not configured.");
builder.Services.AddSingleton<IExpenseStore>(new SqlExpenseStore(expConnString));

// Use cases
builder.Services.AddScoped<RecordExpense>();
builder.Services.AddScoped<ListExpenses>();

// Endpoints (after app.Build(), after middleware block)
app.MapPost("/expenses",
    (RecordExpense useCase, RecordExpenseRequest body, ILoggerFactory loggers, CancellationToken ct)
        => ExpenseEndpoints.RecordExpenseEndpoint(useCase, body, loggers.CreateLogger("Expenses"), ct));
app.MapGet("/expenses",
    (ListExpenses useCase, ILoggerFactory loggers, CancellationToken ct)
        => ExpenseEndpoints.ListExpensesEndpoint(useCase, loggers.CreateLogger("Expenses"), ct));
```

### `appsettings.json` addition

```json
"ConnectionStrings": {
  "Reservations": "",
  "MaintenanceFees": "",
  "Expenses": ""
}
```

## Testing

### Unit tests

- `RecordExpenseTests` — admin creates, resident refused, no session refused, store error fails
- `ListExpensesTests` — resident lists, admin lists, no session refused, store error fails
- `ExpenseEndpointsTests` — 201 on created, 200 on duplicate, 403 on refused, 500 on failed, 403 for no-session on both endpoints

### Rel test

- `SqlExpenseStoreTests` — record two expenses, list returns both newest-first; duplicate key returns Duplicate with original data

### Fakes

- `FakeExpenseStore`: in-memory dictionary keyed by `IdempotencyKey`; `ListExpensesAsync` returns newest-first by insertion order (or `RecordedAt`)
- `FailingExpenseStore`: `RecordExpenseAsync` returns `Failed`; `ListExpensesAsync` throws

## Out of scope

- Expense categories enum/validation (free-form string, same as `Description` and `Period` in maintenance fees)
- Pagination (list all, same as `ListAllCharges`)
- Admin-only read filter by category or date range
