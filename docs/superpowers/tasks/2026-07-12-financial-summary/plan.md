# Financial Summary Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /financial-summary?period=YYYY-MM` that returns total maintenance fee charges billed and total association expenses for the requested period. Resident and admin read.

**Architecture:** New `GetFinancialSummary` use case in `Harmonia.Application.FinancialSummary` that calls the two existing stores and filters in-process. No new ports, SQL adapters, or schema. `IMaintenanceFeeStore.ListAllChargesAsync()` filters by `Period` string equality; `IExpenseStore.ListExpensesAsync()` filters by `ExpenseDate.Year/Month` parsed from the period string.

**Tech Stack:** .NET 8, xUnit, TypedResults, existing FakeMaintenanceFeeStore + FakeExpenseStore fakes.

---

### Task 1: GetFinancialSummary use case — TDD

**Files:**
- Create: `src/Harmonia.Application/FinancialSummary/GetFinancialSummary.cs`
- Create: `tests/Harmonia.UnitTests/Application/GetFinancialSummaryTests.cs`

**Test-first:** yes — write all tests before implementing the use case

- [ ] **Step 1: Write failing tests**

  Create `tests/Harmonia.UnitTests/Application/GetFinancialSummaryTests.cs`:

  ```csharp
  using Harmonia.Application;
  using Harmonia.Application.FinancialSummary;
  using Harmonia.Domain;
  using Harmonia.Domain.Expenses;
  using Harmonia.Domain.MaintenanceFees;

  namespace Harmonia.UnitTests.Application;

  public class GetFinancialSummaryTests
  {
      [Fact]
      public async Task Resident_gets_summary_with_correct_totals()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var feeStore = new FakeMaintenanceFeeStore();
          var expStore = new FakeExpenseStore();
          await feeStore.RecordChargeAsync(MakeCharge(150m, "2026-07", "c1"), default);
          await feeStore.RecordChargeAsync(MakeCharge(50m, "2026-06", "c2"), default); // different period — excluded
          await expStore.RecordExpenseAsync(MakeExpense(200m, new DateOnly(2026, 7, 15), "e1"), default);
          await expStore.RecordExpenseAsync(MakeExpense(99m, new DateOnly(2026, 6, 30), "e2"), default); // different month — excluded
          var useCase = new GetFinancialSummary(new FakeSession(ctx), feeStore, expStore);

          var result = await useCase.ExecuteAsync("2026-07");

          var ok = Assert.IsType<GetFinancialSummaryResult.Ok>(result);
          Assert.Equal("2026-07", ok.Period);
          Assert.Equal(150m, ok.TotalChargesEur);
          Assert.Equal(200m, ok.TotalExpensesEur);
      }

      [Fact]
      public async Task Admin_gets_summary()
      {
          var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
          var useCase = new GetFinancialSummary(new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakeExpenseStore());

          var result = await useCase.ExecuteAsync("2026-07");

          var ok = Assert.IsType<GetFinancialSummaryResult.Ok>(result);
          Assert.Equal(0m, ok.TotalChargesEur);
          Assert.Equal(0m, ok.TotalExpensesEur);
      }

      [Fact]
      public async Task No_session_returns_Refused()
      {
          var useCase = new GetFinancialSummary(new FakeSession(null), new FakeMaintenanceFeeStore(), new FakeExpenseStore());

          var result = await useCase.ExecuteAsync("2026-07");

          Assert.IsType<GetFinancialSummaryResult.Refused>(result);
      }

      [Fact]
      public async Task Invalid_period_format_returns_InvalidPeriod()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var useCase = new GetFinancialSummary(new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakeExpenseStore());

          Assert.IsType<GetFinancialSummaryResult.InvalidPeriod>(await useCase.ExecuteAsync("2026-7"));
          Assert.IsType<GetFinancialSummaryResult.InvalidPeriod>(await useCase.ExecuteAsync("202607"));
          Assert.IsType<GetFinancialSummaryResult.InvalidPeriod>(await useCase.ExecuteAsync(""));
          Assert.IsType<GetFinancialSummaryResult.InvalidPeriod>(await useCase.ExecuteAsync("2026-13")); // month out of range
      }

      [Fact]
      public async Task Store_error_returns_Failed()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var useCase = new GetFinancialSummary(new FakeSession(ctx), new FailingMaintenanceFeeStore(), new FakeExpenseStore());

          var result = await useCase.ExecuteAsync("2026-07");

          Assert.IsType<GetFinancialSummaryResult.Failed>(result);
      }

      [Fact]
      public async Task Period_boundary_expense_on_last_day_of_month_included()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var expStore = new FakeExpenseStore();
          await expStore.RecordExpenseAsync(MakeExpense(75m, new DateOnly(2026, 7, 31), "e-last"), default);
          var useCase = new GetFinancialSummary(new FakeSession(ctx), new FakeMaintenanceFeeStore(), expStore);

          var result = await useCase.ExecuteAsync("2026-07");

          var ok = Assert.IsType<GetFinancialSummaryResult.Ok>(result);
          Assert.Equal(75m, ok.TotalExpensesEur);
      }

      private static MaintenanceFeeCharge MakeCharge(decimal amount, string period, string key) =>
          new(Guid.NewGuid(), new HouseholdRef("HH-1"), amount, "Test", period, DateTimeOffset.UtcNow, key);

      private static AssociationExpense MakeExpense(decimal amount, DateOnly date, string key) =>
          new(Guid.NewGuid(), amount, "Test", "Maintenance", date, DateTimeOffset.UtcNow, key);
  }
  ```

- [ ] **Step 2: Run tests — confirm RED**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~GetFinancialSummaryTests" --verbosity minimal
  ```

  Expected: build error — `GetFinancialSummary` and `GetFinancialSummaryResult` do not exist yet.

- [ ] **Step 3: Implement `GetFinancialSummary`**

  Create `src/Harmonia.Application/FinancialSummary/GetFinancialSummary.cs`:

  ```csharp
  using Harmonia.Application.Expenses;
  using Harmonia.Application.MaintenanceFees;

  namespace Harmonia.Application.FinancialSummary;

  public abstract record GetFinancialSummaryResult
  {
      private GetFinancialSummaryResult() { }
      public sealed record Refused       : GetFinancialSummaryResult;
      public sealed record InvalidPeriod : GetFinancialSummaryResult;
      public sealed record Ok(string Period, decimal TotalChargesEur, decimal TotalExpensesEur)
                                         : GetFinancialSummaryResult;
      public sealed record Failed        : GetFinancialSummaryResult;
  }

  public sealed class GetFinancialSummary(
      ISession session,
      IMaintenanceFeeStore feeStore,
      IExpenseStore expenseStore)
  {
      public async Task<GetFinancialSummaryResult> ExecuteAsync(
          string period, CancellationToken ct = default)
      {
          var ctx = session.Resolve();
          if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
              return new GetFinancialSummaryResult.Refused();

          if (!TryParsePeriod(period, out var year, out var month))
              return new GetFinancialSummaryResult.InvalidPeriod();

          try
          {
              var charges  = await feeStore.ListAllChargesAsync(ct);
              var expenses = await expenseStore.ListExpensesAsync(ct);

              var totalCharges  = charges
                  .Where(c => c.Period == period)
                  .Sum(c => c.AmountEur);

              var totalExpenses = expenses
                  .Where(e => e.ExpenseDate.Year == year && e.ExpenseDate.Month == month)
                  .Sum(e => e.AmountEur);

              return new GetFinancialSummaryResult.Ok(period, totalCharges, totalExpenses);
          }
          catch (Exception)
          {
              return new GetFinancialSummaryResult.Failed();
          }
      }

      private static bool TryParsePeriod(string period, out int year, out int month)
      {
          year = 0; month = 0;
          if (period is not { Length: 7 } || period[4] != '-')
              return false;
          return int.TryParse(period[..4], out year)
              && int.TryParse(period[5..], out month)
              && month is >= 1 and <= 12;
      }
  }
  ```

- [ ] **Step 4: Run tests — confirm GREEN**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~GetFinancialSummaryTests" --verbosity minimal
  ```

  Expected: `Passed! - Failed: 0, Passed: 6`

- [ ] **Step 5: Commit**

  ```
  git add src/Harmonia.Application/FinancialSummary/ tests/Harmonia.UnitTests/Application/GetFinancialSummaryTests.cs
  git commit -m "feat: add GetFinancialSummary use case (resident+admin, in-process period filter)"
  ```

---

### Task 2: FinancialSummaryEndpoints — TDD

**Files:**
- Create: `src/Harmonia.Api/FinancialSummary/FinancialSummaryEndpoints.cs`
- Create: `tests/Harmonia.UnitTests/Api/FinancialSummaryEndpointsTests.cs`

**Test-first:** yes — write endpoint tests before implementing the endpoint class

- [ ] **Step 1: Write failing tests**

  Create `tests/Harmonia.UnitTests/Api/FinancialSummaryEndpointsTests.cs`:

  ```csharp
  using Microsoft.AspNetCore.Http;
  using Microsoft.Extensions.Logging.Abstractions;
  using Harmonia.Api.FinancialSummary;
  using Harmonia.Application;
  using Harmonia.Application.FinancialSummary;

  namespace Harmonia.UnitTests.Api;

  public class FinancialSummaryEndpointsTests
  {
      private static GetFinancialSummary UseCase(SessionContext? ctx) =>
          new(new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakeExpenseStore());

      [Fact]
      public async Task Resident_gets_200()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);

          var result = await FinancialSummaryEndpoints.GetSummaryEndpoint(
              UseCase(ctx), "2026-07", NullLogger.Instance, default);

          var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
      }

      [Fact]
      public async Task No_session_returns_403()
      {
          var result = await FinancialSummaryEndpoints.GetSummaryEndpoint(
              UseCase(null), "2026-07", NullLogger.Instance, default);

          var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
      }

      [Fact]
      public async Task Invalid_period_returns_400()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);

          var result = await FinancialSummaryEndpoints.GetSummaryEndpoint(
              UseCase(ctx), "bad-period", NullLogger.Instance, default);

          var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status400BadRequest, status.StatusCode);
      }

      [Fact]
      public async Task Store_failure_returns_500()
      {
          var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
          var useCase = new GetFinancialSummary(
              new FakeSession(ctx), new FailingMaintenanceFeeStore(), new FakeExpenseStore());

          var result = await FinancialSummaryEndpoints.GetSummaryEndpoint(
              useCase, "2026-07", NullLogger.Instance, default);

          var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
          Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
      }
  }
  ```

- [ ] **Step 2: Run tests — confirm RED**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~FinancialSummaryEndpointsTests" --verbosity minimal
  ```

  Expected: build error — `Harmonia.Api.FinancialSummary` namespace does not exist yet.

- [ ] **Step 3: Implement `FinancialSummaryEndpoints`**

  Create `src/Harmonia.Api/FinancialSummary/FinancialSummaryEndpoints.cs`:

  ```csharp
  using Microsoft.AspNetCore.Http.HttpResults;
  using Harmonia.Application.FinancialSummary;

  namespace Harmonia.Api.FinancialSummary;

  public sealed record FinancialSummaryDto(
      string  Period,
      decimal TotalChargesEur,
      decimal TotalExpensesEur);

  public static class FinancialSummaryEndpoints
  {
      public static async Task<IResult> GetSummaryEndpoint(
          GetFinancialSummary useCase, string period, ILogger logger, CancellationToken ct)
      {
          var result = await useCase.ExecuteAsync(period, ct);

          switch (result)
          {
              case GetFinancialSummaryResult.Refused:
                  return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
              case GetFinancialSummaryResult.InvalidPeriod:
                  return TypedResults.StatusCode(StatusCodes.Status400BadRequest);
              case GetFinancialSummaryResult.Ok ok:
                  logger.LogInformation("Financial summary returned for period {Period}", ok.Period);
                  return TypedResults.Json(
                      new FinancialSummaryDto(ok.Period, ok.TotalChargesEur, ok.TotalExpensesEur),
                      statusCode: StatusCodes.Status200OK);
              case GetFinancialSummaryResult.Failed:
                  return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
              default:
                  return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
          }
      }
  }
  ```

- [ ] **Step 4: Run tests — confirm GREEN**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~FinancialSummaryEndpointsTests" --verbosity minimal
  ```

  Expected: `Passed! - Failed: 0, Passed: 4`

- [ ] **Step 5: Run full unit suite — confirm no regressions**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity minimal
  ```

  Expected: all pass.

- [ ] **Step 6: Commit**

  ```
  git add src/Harmonia.Api/FinancialSummary/ tests/Harmonia.UnitTests/Api/FinancialSummaryEndpointsTests.cs
  git commit -m "feat: add FinancialSummaryEndpoints (GET /financial-summary)"
  ```

---

### Task 3: Program.cs wiring

**Files:**
- Modify: `src/Harmonia.Api/Program.cs`

**Test-first:** no — wiring task; regression-guarded by full unit suite before and after

- [ ] **Step 1: Run unit suite before changes**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity minimal
  ```

  Expected: all pass.

- [ ] **Step 2: Add usings and wire into `Program.cs`**

  Add at the top:
  ```csharp
  using Harmonia.Api.FinancialSummary;
  using Harmonia.Application.FinancialSummary;
  ```

  After `builder.Services.AddScoped<ListExpenses>();`, add:
  ```csharp
  builder.Services.AddScoped<GetFinancialSummary>();
  ```

  After the `app.MapGet("/expenses", ...)` block, add:
  ```csharp
  app.MapGet(
      "/financial-summary",
      (GetFinancialSummary useCase, string period, ILoggerFactory loggers, CancellationToken ct)
          => FinancialSummaryEndpoints.GetSummaryEndpoint(
              useCase, period, loggers.CreateLogger("FinancialSummary"), ct));
  ```

- [ ] **Step 3: Build**

  ```
  dotnet build Harmonia.sln --configuration Release --verbosity minimal
  ```

  Expected: `Build succeeded. 0 Warning(s). 0 Error(s).`

- [ ] **Step 4: Run unit suite — confirm no regressions**

  ```
  dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --verbosity minimal
  ```

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```
  git add src/Harmonia.Api/Program.cs
  git commit -m "feat: wire GET /financial-summary into Program.cs"
  ```
