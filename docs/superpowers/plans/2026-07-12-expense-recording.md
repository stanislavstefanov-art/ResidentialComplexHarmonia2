# Expense Recording — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add POST /expenses (admin write) and GET /expenses (resident + admin read) backed by an append-only SQL Server ledger with idempotency keys.

**Architecture:** New vertical slice — `Harmonia.Domain.Expenses` → `Harmonia.Application.Expenses` → `Harmonia.Api.Expenses` + `SqlExpenseStore` adapter. Direct mirror of the maintenance fee charge ledger; three key differences: no HouseholdRef on the record, DateOnly ExpenseDate instead of Period string, and the read guard allows both IsResident and IsAdmin.

**Tech Stack:** .NET 8, raw ADO.NET (`Microsoft.Data.SqlClient`), xUnit, TypedResults

---

### Task 1: Domain model, ports, and fakes

**Files:**
- Create: `src/Harmonia.Domain/Expenses/AssociationExpense.cs`
- Create: `src/Harmonia.Application/Expenses/Ports.cs`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs`

**Test-first:** no — pure type declarations and fakes; compile-verified

- [ ] **Step 1: Create `AssociationExpense` domain record**

  Create `src/Harmonia.Domain/Expenses/AssociationExpense.cs`:

  ```csharp
  namespace Harmonia.Domain.Expenses;

  public sealed record AssociationExpense(
      Guid           Id,
      decimal        AmountEur,
      string         Description,
      string         Category,
      DateOnly       ExpenseDate,
      DateTimeOffset RecordedAt,
      string         IdempotencyKey);
  ```

- [ ] **Step 2: Create application ports**

  Create `src/Harmonia.Application/Expenses/Ports.cs`:

  ```csharp
  using Harmonia.Domain.Expenses;

  namespace Harmonia.Application.Expenses;

  public abstract record RecordExpenseResult
  {
      private RecordExpenseResult() { }
      public sealed record Refused                            : RecordExpenseResult;
      public sealed record Created(AssociationExpense Expense) : RecordExpenseResult;
      public sealed record Duplicate(AssociationExpense Expense) : RecordExpenseResult;
      public sealed record Failed                             : RecordExpenseResult;
  }

  public abstract record ListExpensesResult
  {
      private ListExpensesResult() { }
      public sealed record Refused                                      : ListExpensesResult;
      public sealed record Ok(IReadOnlyList<AssociationExpense> Expenses) : ListExpensesResult;
      public sealed record Failed                                       : ListExpensesResult;
  }

  public interface IExpenseStore
  {
      Task<RecordExpenseResult> RecordExpenseAsync(
          AssociationExpense expense, CancellationToken ct = default);

      Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(
          CancellationToken ct = default);
  }
  ```

- [ ] **Step 3: Add fakes to `tests/Harmonia.UnitTests/Fakes.cs`**

  Append to the bottom of `Fakes.cs` (inside the namespace block):

  ```csharp
  public sealed class FakeExpenseStore : IExpenseStore
  {
      private readonly Dictionary<string, AssociationExpense> _byKey = [];

      public Task<RecordExpenseResult> RecordExpenseAsync(
          AssociationExpense expense, CancellationToken ct = default)
      {
          if (_byKey.TryGetValue(expense.IdempotencyKey, out var existing))
              return Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Duplicate(existing));
          _byKey[expense.IdempotencyKey] = expense;
          return Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Created(expense));
      }

      public Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(CancellationToken ct = default)
      {
          var list = _byKey.Values.OrderByDescending(e => e.RecordedAt).ToList();
          return Task.FromResult<IReadOnlyList<AssociationExpense>>(list);
      }
  }

  public sealed class FailingExpenseStore : IExpenseStore
  {
      public Task<RecordExpenseResult> RecordExpenseAsync(
          AssociationExpense expense, CancellationToken ct = default)
          => Task.FromResult<RecordExpenseResult>(new RecordExpenseResult.Failed());

      public Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(CancellationToken ct = default)
          => throw new InvalidOperationException("Simulated store failure");
  }
  ```

- [ ] **Step 4: Verify build**

  ```
  dotnet build Harmonia.sln --configuration Release --verbosity minimal
  ```

  Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 5: Commit**

  ```
  git add src/Harmonia.Domain/Expenses/ src/Harmonia.Application/Expenses/ tests/Harmonia.UnitTests/Fakes.cs
  git commit -m "feat: add AssociationExpense domain record, ports, and test fakes"
  ```

---

### Task 2: RecordExpense use case — TDD

**Files:**
- Create: `src/Harmonia.Application/Expenses/RecordExpense.cs`
- Create: `tests/Harmonia.UnitTests/Application/RecordExpenseTests.cs`

**Test-first:** yes — write all four failing tests before implementing the use case

- [ ] **Step 1: Write failing tests**

  Create `tests/Harmonia.UnitTests/Application/RecordExpenseTests.cs`:

  ```csharp
  using Harmonia.Application;
  using Harmonia.Application.Expenses;
  using Harmonia.Domain.Expenses;

  namespace Harmonia.UnitTests.Application;

  public class RecordExpenseTests
  {
      private static readonly DateOnly TestDate = new(2026, 7, 1);

      [Fact]
      public async Task Admin_records_expense_returns_Created()
      {
          var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
          var store = new FakeExpenseStore();
          var useCase = new RecordExpense(new FakeSession(ctx), store);

          var result = await useCase.ExecuteAsync(250m, "Gardening", "Maintenance", TestDate, "key-1");

          var created = Assert.IsType<RecordExpenseResult.Created>(result);
          Assert.Equal(250m, created.Expense.AmountEur);
          Assert.Equal("Gardening", created.Expense.Description);
          Assert.Equal("Maintenance", created.Expense.Category);
          Assert.Equal(TestDate, created.Expense.ExpenseDate);
      }

      [Fact]
      public async Task Duplicate_idempotency_key_returns_Duplicate()
      {
          var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
          var store = new FakeExpenseStore();
          var useCase = new RecordExpense(new FakeSession(ctx), store);
          await useCase.ExecuteAsync(100m, "Cleaning", "Cleaning", TestDate, "dup-key");

          var result = await useCase.ExecuteAsync(999m, "Different", "Other", TestDate, "dup-key");

          var dup = Assert.IsType<RecordExpenseResult.Duplicate>(result);
          Assert.Equal(100m, dup.Expense.AmountEur); // original amount preserved
      }

      [Fact]
      public async Task Resident_returns_Refused()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var useCase = new RecordExpense(new FakeSession(ctx), new FakeExpenseStore());

          var result = await useCase.ExecuteAsync(100m, "X", "Y", TestDate, "k");

          Assert.IsType<RecordExpenseResult.Refused>(result);
      }

      [Fact]
      public async Task No_session_returns_Refused()
      {
          var useCase = new RecordExpense(new FakeSession(null), new FakeExpenseStore());

          var result = await useCase.ExecuteAsync(100m, "X", "Y", TestDate, "k");

          Assert.IsType<RecordExpenseResult.Refused>(result);
      }

      [Fact]
      public async Task Store_error_returns_Failed()
      {
          var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
          var useCase = new RecordExpense(new FakeSession(ctx), new FailingExpenseStore());

          var result = await useCase.ExecuteAsync(100m, "X", "Y", TestDate, "k");

          Assert.IsType<RecordExpenseResult.Failed>(result);
      }
  }
  ```

- [ ] **Step 2: Run tests — confirm RED**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~RecordExpenseTests" --verbosity minimal
  ```

  Expected: build error (`RecordExpense` does not exist yet).

- [ ] **Step 3: Implement `RecordExpense`**

  Create `src/Harmonia.Application/Expenses/RecordExpense.cs`:

  ```csharp
  using Harmonia.Domain.Expenses;

  namespace Harmonia.Application.Expenses;

  public sealed class RecordExpense(ISession session, IExpenseStore store)
  {
      public async Task<RecordExpenseResult> ExecuteAsync(
          decimal amountEur,
          string description,
          string category,
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
              Category:       category,
              ExpenseDate:    expenseDate,
              RecordedAt:     DateTimeOffset.UtcNow,
              IdempotencyKey: idempotencyKey);

          return await store.RecordExpenseAsync(expense, ct);
      }
  }
  ```

- [ ] **Step 4: Run tests — confirm GREEN**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~RecordExpenseTests" --verbosity minimal
  ```

  Expected: `Passed! - Failed: 0, Passed: 5`

- [ ] **Step 5: Commit**

  ```
  git add src/Harmonia.Application/Expenses/RecordExpense.cs tests/Harmonia.UnitTests/Application/RecordExpenseTests.cs
  git commit -m "feat: add RecordExpense use case (admin-only write, idempotency)"
  ```

---

### Task 3: ListExpenses use case — TDD

**Files:**
- Create: `src/Harmonia.Application/Expenses/ListExpenses.cs`
- Create: `tests/Harmonia.UnitTests/Application/ListExpensesTests.cs`

**Test-first:** yes — write four failing tests first

- [ ] **Step 1: Write failing tests**

  Create `tests/Harmonia.UnitTests/Application/ListExpensesTests.cs`:

  ```csharp
  using Harmonia.Application;
  using Harmonia.Application.Expenses;
  using Harmonia.Domain.Expenses;

  namespace Harmonia.UnitTests.Application;

  public class ListExpensesTests
  {
      private static readonly DateOnly TestDate = new(2026, 7, 1);

      [Fact]
      public async Task Resident_can_list_expenses()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var store = new FakeExpenseStore();
          await store.RecordExpenseAsync(MakeExpense("k1"), default);
          var useCase = new ListExpenses(new FakeSession(ctx), store);

          var result = await useCase.ExecuteAsync();

          var ok = Assert.IsType<ListExpensesResult.Ok>(result);
          Assert.Single(ok.Expenses);
      }

      [Fact]
      public async Task Admin_can_list_expenses()
      {
          var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
          var store = new FakeExpenseStore();
          await store.RecordExpenseAsync(MakeExpense("k1"), default);
          var useCase = new ListExpenses(new FakeSession(ctx), store);

          var result = await useCase.ExecuteAsync();

          Assert.IsType<ListExpensesResult.Ok>(result);
      }

      [Fact]
      public async Task No_session_returns_Refused()
      {
          var useCase = new ListExpenses(new FakeSession(null), new FakeExpenseStore());

          var result = await useCase.ExecuteAsync();

          Assert.IsType<ListExpensesResult.Refused>(result);
      }

      [Fact]
      public async Task Store_error_returns_Failed()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var useCase = new ListExpenses(new FakeSession(ctx), new FailingExpenseStore());

          var result = await useCase.ExecuteAsync();

          Assert.IsType<ListExpensesResult.Failed>(result);
      }

      private static AssociationExpense MakeExpense(string key) =>
          new(Guid.NewGuid(), 100m, "Test", "Maintenance", TestDate, DateTimeOffset.UtcNow, key);
  }
  ```

- [ ] **Step 2: Run tests — confirm RED**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~ListExpensesTests" --verbosity minimal
  ```

  Expected: build error (`ListExpenses` does not exist yet).

- [ ] **Step 3: Implement `ListExpenses`**

  Create `src/Harmonia.Application/Expenses/ListExpenses.cs`:

  ```csharp
  namespace Harmonia.Application.Expenses;

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

- [ ] **Step 4: Run tests — confirm GREEN**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~ListExpensesTests" --verbosity minimal
  ```

  Expected: `Passed! - Failed: 0, Passed: 4`

- [ ] **Step 5: Commit**

  ```
  git add src/Harmonia.Application/Expenses/ListExpenses.cs tests/Harmonia.UnitTests/Application/ListExpensesTests.cs
  git commit -m "feat: add ListExpenses use case (resident + admin read)"
  ```

---

### Task 4: ExpenseEndpoints — TDD

**Files:**
- Create: `src/Harmonia.Api/Expenses/ExpenseEndpoints.cs`
- Create: `tests/Harmonia.UnitTests/Api/ExpenseEndpointsTests.cs`

**Test-first:** yes — write endpoint tests before implementing the endpoint class

- [ ] **Step 1: Write failing tests**

  Create `tests/Harmonia.UnitTests/Api/ExpenseEndpointsTests.cs`:

  ```csharp
  using Microsoft.AspNetCore.Http;
  using Microsoft.AspNetCore.Http.HttpResults;
  using Microsoft.Extensions.Logging.Abstractions;
  using Harmonia.Api.Expenses;
  using Harmonia.Application;
  using Harmonia.Application.Expenses;
  using Harmonia.Domain.Expenses;

  namespace Harmonia.UnitTests.Api;

  public class ExpenseEndpointsTests
  {
      private static readonly DateOnly TestDate = new(2026, 7, 1);

      private static RecordExpenseRequest TestRequest(string key = "k1") =>
          new(150m, "Gardening", "Maintenance", TestDate, key);

      [Fact]
      public async Task Admin_record_returns_201()
      {
          var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
          var useCase = new RecordExpense(new FakeSession(ctx), new FakeExpenseStore());

          var result = await ExpenseEndpoints.RecordExpenseEndpoint(useCase, TestRequest(), NullLogger.Instance, default);

          var json = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status201Created, json.StatusCode);
      }

      [Fact]
      public async Task Duplicate_key_returns_200()
      {
          var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
          var store = new FakeExpenseStore();
          var useCase = new RecordExpense(new FakeSession(ctx), store);
          await useCase.ExecuteAsync(100m, "X", "Y", TestDate, "dup");

          var result = await ExpenseEndpoints.RecordExpenseEndpoint(useCase, TestRequest("dup"), NullLogger.Instance, default);

          var json = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
      }

      [Fact]
      public async Task Non_admin_record_returns_403()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var useCase = new RecordExpense(new FakeSession(ctx), new FakeExpenseStore());

          var result = await ExpenseEndpoints.RecordExpenseEndpoint(useCase, TestRequest(), NullLogger.Instance, default);

          var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
      }

      [Fact]
      public async Task No_session_record_returns_403()
      {
          var useCase = new RecordExpense(new FakeSession(null), new FakeExpenseStore());

          var result = await ExpenseEndpoints.RecordExpenseEndpoint(useCase, TestRequest(), NullLogger.Instance, default);

          var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
      }

      [Fact]
      public async Task Resident_list_returns_200_with_expenses()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var store = new FakeExpenseStore();
          await store.RecordExpenseAsync(new AssociationExpense(Guid.NewGuid(), 100m, "X", "Y", TestDate, DateTimeOffset.UtcNow, "k1"), default);
          var useCase = new ListExpenses(new FakeSession(ctx), store);

          var result = await ExpenseEndpoints.ListExpensesEndpoint(useCase, NullLogger.Instance, default);

          var json = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
      }

      [Fact]
      public async Task No_session_list_returns_403()
      {
          var useCase = new ListExpenses(new FakeSession(null), new FakeExpenseStore());

          var result = await ExpenseEndpoints.ListExpensesEndpoint(useCase, NullLogger.Instance, default);

          var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
      }
  }
  ```

- [ ] **Step 2: Run tests — confirm RED**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~ExpenseEndpointsTests" --verbosity minimal
  ```

  Expected: build error (`ExpenseEndpoints` does not exist yet).

- [ ] **Step 3: Implement `ExpenseEndpoints`**

  Create `src/Harmonia.Api/Expenses/ExpenseEndpoints.cs`:

  ```csharp
  using Microsoft.AspNetCore.Http.HttpResults;
  using Harmonia.Application.Expenses;
  using Harmonia.Domain.Expenses;

  namespace Harmonia.Api.Expenses;

  public sealed record RecordExpenseRequest(
      decimal  AmountEur,
      string   Description,
      string   Category,
      DateOnly ExpenseDate,
      string   IdempotencyKey);

  public sealed record ExpenseDto(
      Guid           Id,
      decimal        AmountEur,
      string         Description,
      string         Category,
      DateOnly       ExpenseDate,
      DateTimeOffset RecordedAt,
      string         IdempotencyKey);

  public static class ExpenseEndpoints
  {
      public static async Task<IResult> RecordExpenseEndpoint(
          RecordExpense useCase, RecordExpenseRequest body, ILogger logger, CancellationToken ct)
      {
          var result = await useCase.ExecuteAsync(
              body.AmountEur, body.Description, body.Category, body.ExpenseDate, body.IdempotencyKey, ct);

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
                      ok.Expenses.Select(ToDto).ToList(),
                      statusCode: StatusCodes.Status200OK);
              default:
                  return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
          }
      }

      private static ExpenseDto ToDto(AssociationExpense e) =>
          new(e.Id, e.AmountEur, e.Description, e.Category, e.ExpenseDate, e.RecordedAt, e.IdempotencyKey);
  }
  ```

- [ ] **Step 4: Run tests — confirm GREEN**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~ExpenseEndpointsTests" --verbosity minimal
  ```

  Expected: `Passed! - Failed: 0, Passed: 6`

- [ ] **Step 5: Run full unit suite to confirm no regressions**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity minimal
  ```

  Expected: all pass (65 pre-existing + new tests).

- [ ] **Step 6: Commit**

  ```
  git add src/Harmonia.Api/Expenses/ tests/Harmonia.UnitTests/Api/ExpenseEndpointsTests.cs
  git commit -m "feat: add ExpenseEndpoints (POST /expenses admin write, GET /expenses resident+admin read)"
  ```

---

### Task 5: Schema + SqlExpenseStore + Rel test — TDD

**Files:**
- Modify: `db/schema.sql`
- Create: `src/Harmonia.Api/Adapters/SqlExpenseStore.cs`
- Create: `tests/Harmonia.IntegrationTests/SqlExpenseStoreTests.cs`

**Test-first:** yes — write the Rel test first (it will fail until the table and store exist)

- [ ] **Step 1: Add schema table**

  Append to `db/schema.sql`:

  ```sql

  -- Association expense ledger (append-only; no UPDATE or DELETE ever executed).
  -- PK on IdempotencyKey guarantees idempotent POST semantics at the DB layer.
  -- Expenses are complex-wide; no HouseholdRef.
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
      CONSTRAINT PK_AssociationExpenses  PRIMARY KEY (IdempotencyKey),
      CONSTRAINT UQ_AssociationExpenses_Id UNIQUE (Id)
  );
  ```

- [ ] **Step 2: Write the Rel test**

  Create `tests/Harmonia.IntegrationTests/SqlExpenseStoreTests.cs`:

  ```csharp
  using Harmonia.Api.Reservations.Adapters;
  using Harmonia.Application.Expenses;
  using Harmonia.Domain.Expenses;

  namespace Harmonia.IntegrationTests;

  [Trait("Category", "Rel")]
  public class SqlExpenseStoreTests(SqlServerFixture db) : IClassFixture<SqlServerFixture>
  {
      private static readonly DateOnly TestDate = new(2026, 7, 1);

      [Fact]
      public async Task Record_and_list_expenses_newest_first()
      {
          var store = new SqlExpenseStore(db.ConnectionString);
          var key1 = $"rel-exp-{Guid.NewGuid():N}";
          var key2 = $"rel-exp-{Guid.NewGuid():N}";

          var r1 = await store.RecordExpenseAsync(
              new AssociationExpense(Guid.NewGuid(), 100m, "Gardening", "Maintenance", TestDate,
                  DateTimeOffset.UtcNow.AddMinutes(-1), key1));
          var r2 = await store.RecordExpenseAsync(
              new AssociationExpense(Guid.NewGuid(), 200m, "Cleaning", "Cleaning", TestDate,
                  DateTimeOffset.UtcNow, key2));

          Assert.IsType<RecordExpenseResult.Created>(r1);
          Assert.IsType<RecordExpenseResult.Created>(r2);

          var all = await store.ListExpensesAsync();
          var ours = all.Where(e => e.IdempotencyKey == key1 || e.IdempotencyKey == key2)
                        .OrderByDescending(e => e.RecordedAt).ToList();
          Assert.Equal(2, ours.Count);
          Assert.Equal(key2, ours[0].IdempotencyKey); // newest first
      }

      [Fact]
      public async Task Duplicate_idempotency_key_returns_Duplicate_with_original_data()
      {
          var store = new SqlExpenseStore(db.ConnectionString);
          var key = $"rel-dup-{Guid.NewGuid():N}";

          await store.RecordExpenseAsync(
              new AssociationExpense(Guid.NewGuid(), 300m, "Elevator", "Maintenance", TestDate,
                  DateTimeOffset.UtcNow, key));

          var result = await store.RecordExpenseAsync(
              new AssociationExpense(Guid.NewGuid(), 999m, "Different", "Other", TestDate,
                  DateTimeOffset.UtcNow, key));

          var dup = Assert.IsType<RecordExpenseResult.Duplicate>(result);
          Assert.Equal(300m, dup.Expense.AmountEur); // original data preserved
          Assert.Equal("Elevator", dup.Expense.Description);
      }
  }
  ```

- [ ] **Step 3: Implement `SqlExpenseStore`**

  Create `src/Harmonia.Api/Adapters/SqlExpenseStore.cs`:

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
                  "(Id, AmountEur, Description, Category, ExpenseDate, RecordedAt, IdempotencyKey) " +
                  "VALUES (@Id, @AmountEur, @Description, @Category, @ExpenseDate, @RecordedAt, @IdempotencyKey);";
              cmd.Parameters.AddWithValue("@Id", expense.Id);
              cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal)
                  { Value = expense.AmountEur, Precision = 18, Scale = 2 });
              cmd.Parameters.AddWithValue("@Description", expense.Description);
              cmd.Parameters.AddWithValue("@Category", expense.Category);
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

- [ ] **Step 4: Build to verify compilation**

  ```
  dotnet build Harmonia.sln --configuration Release --verbosity minimal
  ```

  Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 5: Commit**

  ```
  git add db/schema.sql src/Harmonia.Api/Adapters/SqlExpenseStore.cs tests/Harmonia.IntegrationTests/SqlExpenseStoreTests.cs
  git commit -m "feat: add SqlExpenseStore + AssociationExpenses schema + Rel tests"
  ```

---

### Task 6: Program.cs wiring + appsettings.json

**Files:**
- Modify: `src/Harmonia.Api/Program.cs`
- Modify: `src/Harmonia.Api/appsettings.json`

**Test-first:** no — wiring task; regression-guarded by full unit suite before and after

- [ ] **Step 1: Confirm unit tests green before changes**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity minimal
  ```

  Expected: all pass.

- [ ] **Step 2: Add `Expenses` connection string to `appsettings.json`**

  In `src/Harmonia.Api/appsettings.json`, add `"Expenses": ""` inside `ConnectionStrings`:

  ```json
  "ConnectionStrings": {
    "Reservations": "",
    "MaintenanceFees": "",
    "Expenses": ""
  }
  ```

- [ ] **Step 3: Wire expenses into `Program.cs`**

  After the `feeConnString` block and before `if (builder.Environment.IsDevelopment())`, add:

  ```csharp
  var expConnString = builder.Configuration.GetConnectionString("Expenses");
  if (string.IsNullOrWhiteSpace(expConnString))
  {
      throw new InvalidOperationException(
          "ConnectionStrings:Expenses is not configured. Supply it via environment " +
          "(ConnectionStrings__Expenses) or a git-ignored local config file.");
  }
  builder.Services.AddSingleton<IExpenseStore>(new SqlExpenseStore(expConnString));
  ```

  After `builder.Services.AddScoped<ListAllCharges>();`, add:

  ```csharp
  builder.Services.AddScoped<RecordExpense>();
  builder.Services.AddScoped<ListExpenses>();
  ```

  After the last `app.MapGet("/maintenance-fees/charges/all", ...)` block, add:

  ```csharp
  app.MapPost(
      "/expenses",
      (RecordExpense useCase, RecordExpenseRequest body, ILoggerFactory loggers, CancellationToken ct)
          => ExpenseEndpoints.RecordExpenseEndpoint(
              useCase, body, loggers.CreateLogger("Expenses"), ct));

  app.MapGet(
      "/expenses",
      (ListExpenses useCase, ILoggerFactory loggers, CancellationToken ct)
          => ExpenseEndpoints.ListExpensesEndpoint(
              useCase, loggers.CreateLogger("Expenses"), ct));
  ```

  Add the required using directives at the top of `Program.cs`:

  ```csharp
  using Harmonia.Api.Expenses;
  using Harmonia.Application.Expenses;
  ```

- [ ] **Step 4: Build**

  ```
  dotnet build Harmonia.sln --configuration Release --verbosity minimal
  ```

  Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 5: Run unit tests — confirm no regressions**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity minimal
  ```

  Expected: all pass.

- [ ] **Step 6: Commit**

  ```
  git add src/Harmonia.Api/Program.cs src/Harmonia.Api/appsettings.json
  git commit -m "feat: wire expense endpoints into Program.cs (POST /expenses, GET /expenses)"
  ```

---

## Verification (after all tasks)

```
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity minimal
```
Expected: all pass.

Rel tests (require `HARMONIA_SQL_CONNSTR`):
```
dotnet test tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj --filter "Category=Rel" --verbosity minimal
```
Expected: all pass including the two new `SqlExpenseStoreTests`.
