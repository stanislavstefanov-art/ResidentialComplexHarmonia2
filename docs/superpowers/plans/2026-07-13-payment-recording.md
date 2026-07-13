# Payment Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an append-only payment ledger so admin can record bank-transfer payments per apartment, residents can view their own payment history, and a balance view shows total charged minus total paid per apartment for a period or YTD.

**Architecture:** Three-layer .NET 8 — pure domain record `MaintenanceFeePayment` in `Harmonia.Domain.Payments`; `IPaymentStore` port and four use cases (`RecordPayment`, `ListAllPayments`, `ListMyPayments`, `GetBalance`) in `Harmonia.Application.Payments`; static endpoint methods in `Harmonia.Api.Payments`; `SqlPaymentStore` (raw ADO.NET) in `Harmonia.Api.Reservations.Adapters`. `GetBalance` joins `IMaintenanceFeeStore` + `IPaymentStore` in-process — same pattern as `GetFinancialSummary`.

**Tech Stack:** .NET 8, C# 12, ASP.NET Core Minimal APIs, Microsoft.Data.SqlClient, xUnit, TypedResults.

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/Harmonia.Domain/Payments/MaintenanceFeePayment.cs` | Pure domain record, no I/O |
| Create | `src/Harmonia.Application/Payments/Ports.cs` | Result unions + `IPaymentStore` interface |
| Create | `src/Harmonia.Application/Payments/RecordPayment.cs` | Admin-only write use case |
| Create | `src/Harmonia.Application/Payments/ListAllPayments.cs` | Admin-only list all use case |
| Create | `src/Harmonia.Application/Payments/ListMyPayments.cs` | Resident read use case (R2) |
| Create | `src/Harmonia.Application/Payments/GetBalance.cs` | Charged-vs-paid use case (in-process join) |
| Create | `src/Harmonia.Api/Payments/PaymentEndpoints.cs` | DTOs + 4 static endpoint methods |
| Create | `src/Harmonia.Api/Adapters/SqlPaymentStore.cs` | SQL Server adapter (raw ADO.NET) |
| Modify | `tests/Harmonia.UnitTests/Fakes.cs` | Add `FakePaymentStore` + `FailingPaymentStore` |
| Create | `tests/Harmonia.UnitTests/Application/RecordPaymentTests.cs` | Unit tests for `RecordPayment` |
| Create | `tests/Harmonia.UnitTests/Application/ListAllPaymentsTests.cs` | Unit tests for `ListAllPayments` |
| Create | `tests/Harmonia.UnitTests/Application/ListMyPaymentsTests.cs` | Unit tests for `ListMyPayments` |
| Create | `tests/Harmonia.UnitTests/Application/GetBalanceTests.cs` | Unit tests for `GetBalance` |
| Create | `tests/Harmonia.UnitTests/Api/PaymentEndpointsTests.cs` | Unit tests for endpoint wiring |
| Create | `tests/Harmonia.IntegrationTests/SqlPaymentStoreTests.cs` | Rel tests against real SQL Server |
| Modify | `db/schema.sql` | Add `dbo.MaintenanceFeePayments` DDL |
| Modify | `src/Harmonia.Api/Program.cs` | Register store, use cases, routes |
| Modify | `src/Harmonia.Api/appsettings.json` | Add `"Payments": ""` connection string key |

---

## Task 1: Domain model, ports, and fakes (foundation)

**Test-first: yes — write `RecordPaymentTests.cs` referencing `FakePaymentStore` and `MaintenanceFeePayment` before either exists; `dotnet build` fails with CS0246.**

**Files:**
- Create: `src/Harmonia.Domain/Payments/MaintenanceFeePayment.cs`
- Create: `src/Harmonia.Application/Payments/Ports.cs`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs`
- Create: `tests/Harmonia.UnitTests/Application/RecordPaymentTests.cs`

---

- [ ] **Step 1: Write the skeleton test file (will fail to build)**

Create `tests/Harmonia.UnitTests/Application/RecordPaymentTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.UnitTests.Application;

public class RecordPaymentTests
{
    private static (RecordPayment UseCase, FakePaymentStore Store) Build(SessionContext? ctx)
    {
        var store = new FakePaymentStore();
        return (new RecordPayment(new FakeSession(ctx), store), store);
    }

    [Fact]
    public async Task Admin_creates_payment()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var (useCase, _) = Build(ctx);

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var created = Assert.IsType<RecordPaymentResult.Created>(result);
        Assert.Equal(new HouseholdRef("HH-1"), created.Payment.HouseholdRef);
        Assert.Equal(500m, created.Payment.AmountEur);
        Assert.Equal("2026-07", created.Payment.Period);
        Assert.Equal(new DateOnly(2026, 7, 10), created.Payment.DateReceived);
    }

    [Fact]
    public async Task Duplicate_idempotency_key_returns_Duplicate()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var (useCase, _) = Build(ctx);
        await useCase.ExecuteAsync("HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        Assert.IsType<RecordPaymentResult.Duplicate>(result);
    }

    [Fact]
    public async Task Non_admin_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var (useCase, _) = Build(ctx);

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        Assert.IsType<RecordPaymentResult.Refused>(result);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var (useCase, _) = Build(null);

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        Assert.IsType<RecordPaymentResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new RecordPayment(new FakeSession(ctx), new FailingPaymentStore());

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        Assert.IsType<RecordPaymentResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Verify build fails (RED)**

```
dotnet build tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
```

Expected: errors `CS0246 The type or namespace name 'FakePaymentStore' could not be found` and `CS0246 The type or namespace name 'RecordPaymentResult' could not be found`.

- [ ] **Step 3: Create the domain model**

Create `src/Harmonia.Domain/Payments/MaintenanceFeePayment.cs`:

```csharp
namespace Harmonia.Domain.Payments;

public sealed record MaintenanceFeePayment(
    Guid           Id,
    HouseholdRef   HouseholdRef,
    decimal        AmountEur,
    string         Period,
    DateOnly       DateReceived,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);
```

- [ ] **Step 4: Create the application ports**

Create `src/Harmonia.Application/Payments/Ports.cs`:

```csharp
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.Application.Payments;

public abstract record RecordPaymentResult
{
    private RecordPaymentResult() { }
    public sealed record Refused                                    : RecordPaymentResult;
    public sealed record Created(MaintenanceFeePayment Payment)    : RecordPaymentResult;
    public sealed record Duplicate(MaintenanceFeePayment Payment)  : RecordPaymentResult;
    public sealed record Failed                                     : RecordPaymentResult;
}

public abstract record ListPaymentsResult
{
    private ListPaymentsResult() { }
    public sealed record Refused                                             : ListPaymentsResult;
    public sealed record Ok(IReadOnlyList<MaintenanceFeePayment> Payments)  : ListPaymentsResult;
    public sealed record Failed                                              : ListPaymentsResult;
}

public sealed record BalanceLine(
    HouseholdRef HouseholdRef,
    decimal      TotalCharged,
    decimal      TotalPaid,
    decimal      Balance);

public abstract record GetBalanceResult
{
    private GetBalanceResult() { }
    public sealed record Refused                                              : GetBalanceResult;
    public sealed record InvalidPeriod                                        : GetBalanceResult;
    public sealed record Ok(string Label, IReadOnlyList<BalanceLine> Lines)  : GetBalanceResult;
    public sealed record Failed                                               : GetBalanceResult;
}

public interface IPaymentStore
{
    Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default);

    Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default);

    Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default);
}
```

- [ ] **Step 5: Add `FakePaymentStore` and `FailingPaymentStore` to `Fakes.cs`**

Append to the end of `tests/Harmonia.UnitTests/Fakes.cs` (inside the namespace, before the final `}`):

```csharp
public sealed class FakePaymentStore : IPaymentStore
{
    private readonly Dictionary<(HouseholdRef, string), MaintenanceFeePayment> _byKey = [];
    private readonly Dictionary<HouseholdRef, List<MaintenanceFeePayment>> _byHousehold = [];

    public Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default)
    {
        var key = (payment.HouseholdRef, payment.IdempotencyKey);
        if (_byKey.TryGetValue(key, out var existing))
            return Task.FromResult<RecordPaymentResult>(new RecordPaymentResult.Duplicate(existing));

        _byKey[key] = payment;
        if (!_byHousehold.TryGetValue(payment.HouseholdRef, out var list))
            _byHousehold[payment.HouseholdRef] = list = [];
        list.Add(payment);
        return Task.FromResult<RecordPaymentResult>(new RecordPaymentResult.Created(payment));
    }

    public Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        var payments = _byHousehold.TryGetValue(householdRef, out var list)
            ? (IReadOnlyList<MaintenanceFeePayment>)list.OrderByDescending(p => p.DateReceived).ToList()
            : [];
        return Task.FromResult(payments);
    }

    public Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default)
    {
        var all = _byHousehold.Values
            .SelectMany(x => x)
            .OrderBy(p => p.HouseholdRef.Value)
            .ThenByDescending(p => p.DateReceived)
            .ToList();
        return Task.FromResult<IReadOnlyList<MaintenanceFeePayment>>(all);
    }
}

public sealed class FailingPaymentStore : IPaymentStore
{
    public Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default)
        => Task.FromResult<RecordPaymentResult>(new RecordPaymentResult.Failed());

    public Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
}
```

Also add these two using directives at the top of `Fakes.cs` (with the existing usings):
```csharp
using Harmonia.Application.Payments;
using Harmonia.Domain.Payments;
```

- [ ] **Step 6: Create the `RecordPayment` use case**

Create `src/Harmonia.Application/Payments/RecordPayment.cs`:

```csharp
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.Application.Payments;

public sealed class RecordPayment(ISession session, IPaymentStore store)
{
    public async Task<RecordPaymentResult> ExecuteAsync(
        string householdRef,
        decimal amountEur,
        string period,
        DateOnly dateReceived,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordPaymentResult.Refused();

        var payment = new MaintenanceFeePayment(
            Id:             Guid.NewGuid(),
            HouseholdRef:   new HouseholdRef(householdRef),
            AmountEur:      amountEur,
            Period:         period,
            DateReceived:   dateReceived,
            RecordedAt:     DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        return await store.RecordPaymentAsync(payment, ct);
    }
}
```

- [ ] **Step 7: Run tests (GREEN)**

```
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~RecordPaymentTests" --no-build
```

Expected: `5 passed, 0 failed`.

- [ ] **Step 8: Commit**

```
git add src/Harmonia.Domain/Payments/ src/Harmonia.Application/Payments/Ports.cs src/Harmonia.Application/Payments/RecordPayment.cs tests/Harmonia.UnitTests/Fakes.cs tests/Harmonia.UnitTests/Application/RecordPaymentTests.cs
git commit -m "feat: add MaintenanceFeePayment domain, IPaymentStore port, RecordPayment use case"
```

---

## Task 2: ListAllPayments and ListMyPayments use cases

**Test-first: yes — write test files referencing `ListAllPayments` and `ListMyPayments` before either class exists; `dotnet build` fails with CS0246.**

**Files:**
- Create: `src/Harmonia.Application/Payments/ListAllPayments.cs`
- Create: `src/Harmonia.Application/Payments/ListMyPayments.cs`
- Create: `tests/Harmonia.UnitTests/Application/ListAllPaymentsTests.cs`
- Create: `tests/Harmonia.UnitTests/Application/ListMyPaymentsTests.cs`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/Harmonia.UnitTests/Application/ListAllPaymentsTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.UnitTests.Application;

public class ListAllPaymentsTests
{
    private static MaintenanceFeePayment MakePayment(string hh, string period, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(hh), 500m, period,
            new DateOnly(2026, 7, 10), DateTimeOffset.UtcNow, key);

    [Fact]
    public async Task Admin_returns_all_payments()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakePaymentStore();
        await store.RecordPaymentAsync(MakePayment("HH-1", "2026-07", "p1"), default);
        await store.RecordPaymentAsync(MakePayment("HH-2", "2026-07", "p2"), default);
        var useCase = new ListAllPayments(new FakeSession(ctx), store);

        var result = await useCase.ExecuteAsync();

        var ok = Assert.IsType<ListPaymentsResult.Ok>(result);
        Assert.Equal(2, ok.Payments.Count);
    }

    [Fact]
    public async Task Non_admin_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var useCase = new ListAllPayments(new FakeSession(ctx), new FakePaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Refused>(result);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new ListAllPayments(new FakeSession(null), new FakePaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new ListAllPayments(new FakeSession(ctx), new FailingPaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Failed>(result);
    }
}
```

Create `tests/Harmonia.UnitTests/Application/ListMyPaymentsTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.UnitTests.Application;

public class ListMyPaymentsTests
{
    private static MaintenanceFeePayment MakePayment(string hh, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(hh), 500m, "2026-07",
            new DateOnly(2026, 7, 10), DateTimeOffset.UtcNow, key);

    [Fact]
    public async Task Resident_sees_only_own_payments()
    {
        var hh = new HouseholdRef("HH-1");
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: hh);
        var store = new FakePaymentStore();
        await store.RecordPaymentAsync(MakePayment("HH-1", "p1"), default);
        await store.RecordPaymentAsync(MakePayment("HH-2", "p2"), default);
        var useCase = new ListMyPayments(new FakeSession(ctx), store);

        var result = await useCase.ExecuteAsync();

        var ok = Assert.IsType<ListPaymentsResult.Ok>(result);
        Assert.Single(ok.Payments);
        Assert.Equal(hh, ok.Payments[0].HouseholdRef);
    }

    [Fact]
    public async Task Admin_with_no_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new ListMyPayments(new FakeSession(ctx), new FakePaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Refused>(result);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new ListMyPayments(new FakeSession(null), new FakePaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var hh = new HouseholdRef("HH-1");
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: hh);
        var useCase = new ListMyPayments(new FakeSession(ctx), new FailingPaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Verify build fails (RED)**

```
dotnet build tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
```

Expected: `CS0246 The type or namespace name 'ListAllPayments' could not be found` and `CS0246 The type or namespace name 'ListMyPayments' could not be found`.

- [ ] **Step 3: Implement `ListAllPayments`**

Create `src/Harmonia.Application/Payments/ListAllPayments.cs`:

```csharp
namespace Harmonia.Application.Payments;

public sealed class ListAllPayments(ISession session, IPaymentStore store)
{
    public async Task<ListPaymentsResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new ListPaymentsResult.Refused();

        try
        {
            var payments = await store.ListAllPaymentsAsync(ct);
            return new ListPaymentsResult.Ok(payments);
        }
        catch (Exception)
        {
            return new ListPaymentsResult.Failed();
        }
    }
}
```

- [ ] **Step 4: Implement `ListMyPayments`**

Create `src/Harmonia.Application/Payments/ListMyPayments.cs`:

```csharp
namespace Harmonia.Application.Payments;

public sealed class ListMyPayments(ISession session, IPaymentStore store)
{
    public async Task<ListPaymentsResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new ListPaymentsResult.Refused();
        if (ctx.HouseholdRef is null)
            return new ListPaymentsResult.Refused();

        try
        {
            var payments = await store.ListPaymentsByHouseholdAsync(ctx.HouseholdRef, ct);
            return new ListPaymentsResult.Ok(payments);
        }
        catch (Exception)
        {
            return new ListPaymentsResult.Failed();
        }
    }
}
```

- [ ] **Step 5: Run tests (GREEN)**

```
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~ListAllPaymentsTests|FullyQualifiedName~ListMyPaymentsTests" --no-build
```

Expected: `8 passed, 0 failed`.

- [ ] **Step 6: Commit**

```
git add src/Harmonia.Application/Payments/ListAllPayments.cs src/Harmonia.Application/Payments/ListMyPayments.cs tests/Harmonia.UnitTests/Application/ListAllPaymentsTests.cs tests/Harmonia.UnitTests/Application/ListMyPaymentsTests.cs
git commit -m "feat: add ListAllPayments and ListMyPayments use cases"
```

---

## Task 3: GetBalance use case

**Test-first: yes — write `GetBalanceTests.cs` referencing `GetBalance` before the class exists; `dotnet build` fails with CS0246.**

**Files:**
- Create: `src/Harmonia.Application/Payments/GetBalance.cs`
- Create: `tests/Harmonia.UnitTests/Application/GetBalanceTests.cs`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/Harmonia.UnitTests/Application/GetBalanceTests.cs`:

```csharp
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;
using Harmonia.Domain.Payments;

namespace Harmonia.UnitTests.Application;

public class GetBalanceTests
{
    private static MaintenanceFeeCharge MakeCharge(
        string hh, decimal amount, string period, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(hh), amount, "Monthly fee", period,
            DateTimeOffset.UtcNow, key);

    private static MaintenanceFeePayment MakePayment(
        string hh, decimal amount, string period, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(hh), amount, period,
            new DateOnly(2026, 7, 10), DateTimeOffset.UtcNow, key);

    [Fact]
    public async Task Admin_sees_all_apartments_for_period()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var feeStore = new FakeMaintenanceFeeStore();
        var payStore = new FakePaymentStore();
        await feeStore.RecordChargeAsync(MakeCharge("HH-1", 300m, "2026-07", "c1"), default);
        await feeStore.RecordChargeAsync(MakeCharge("HH-2", 400m, "2026-07", "c2"), default);
        await payStore.RecordPaymentAsync(MakePayment("HH-1", 200m, "2026-07", "p1"), default);
        var useCase = new GetBalance(new FakeSession(ctx), feeStore, payStore);

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetBalanceResult.Ok>(result);
        Assert.Equal("2026-07", ok.Label);
        Assert.Equal(2, ok.Lines.Count);
        var hh1 = ok.Lines.Single(l => l.HouseholdRef.Value == "HH-1");
        Assert.Equal(300m, hh1.TotalCharged);
        Assert.Equal(200m, hh1.TotalPaid);
        Assert.Equal(100m, hh1.Balance);
        var hh2 = ok.Lines.Single(l => l.HouseholdRef.Value == "HH-2");
        Assert.Equal(400m, hh2.TotalCharged);
        Assert.Equal(0m,   hh2.TotalPaid);
        Assert.Equal(400m, hh2.Balance);
    }

    [Fact]
    public async Task Resident_sees_only_own_apartment()
    {
        var hh = new HouseholdRef("HH-1");
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: hh);
        var feeStore = new FakeMaintenanceFeeStore();
        var payStore = new FakePaymentStore();
        await feeStore.RecordChargeAsync(MakeCharge("HH-1", 300m, "2026-07", "c1"), default);
        await feeStore.RecordChargeAsync(MakeCharge("HH-2", 400m, "2026-07", "c2"), default);
        await payStore.RecordPaymentAsync(MakePayment("HH-1", 150m, "2026-07", "p1"), default);
        var useCase = new GetBalance(new FakeSession(ctx), feeStore, payStore);

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetBalanceResult.Ok>(result);
        Assert.Single(ok.Lines);
        Assert.Equal("HH-1", ok.Lines[0].HouseholdRef.Value);
        Assert.Equal(300m, ok.Lines[0].TotalCharged);
        Assert.Equal(150m, ok.Lines[0].TotalPaid);
        Assert.Equal(150m, ok.Lines[0].Balance);
    }

    [Fact]
    public async Task YTD_label_and_filter_applied_when_no_period()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var feeStore = new FakeMaintenanceFeeStore();
        var payStore = new FakePaymentStore();
        var year = DateTime.UtcNow.Year;
        await feeStore.RecordChargeAsync(
            MakeCharge("HH-1", 100m, $"{year}-01", "c1"), default);
        await feeStore.RecordChargeAsync(
            MakeCharge("HH-1", 100m, $"{year - 1}-12", "c2"), default);
        var useCase = new GetBalance(new FakeSession(ctx), feeStore, payStore);

        var result = await useCase.ExecuteAsync(null);

        var ok = Assert.IsType<GetBalanceResult.Ok>(result);
        Assert.Equal($"YTD-{year}", ok.Label);
        Assert.Single(ok.Lines);
        Assert.Equal(100m, ok.Lines[0].TotalCharged);
    }

    [Fact]
    public async Task Invalid_period_returns_InvalidPeriod()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var useCase = new GetBalance(
            new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakePaymentStore());

        var result = await useCase.ExecuteAsync("bad-period");

        Assert.IsType<GetBalanceResult.InvalidPeriod>(result);
    }

    [Fact]
    public async Task Empty_data_returns_empty_lines()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new GetBalance(
            new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakePaymentStore());

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetBalanceResult.Ok>(result);
        Assert.Empty(ok.Lines);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new GetBalance(
            new FakeSession(null), new FakeMaintenanceFeeStore(), new FakePaymentStore());

        var result = await useCase.ExecuteAsync("2026-07");

        Assert.IsType<GetBalanceResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new GetBalance(
            new FakeSession(ctx), new FailingMaintenanceFeeStore(), new FakePaymentStore());

        var result = await useCase.ExecuteAsync("2026-07");

        Assert.IsType<GetBalanceResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Verify build fails (RED)**

```
dotnet build tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
```

Expected: `CS0246 The type or namespace name 'GetBalance' could not be found`.

- [ ] **Step 3: Implement `GetBalance`**

Create `src/Harmonia.Application/Payments/GetBalance.cs`:

```csharp
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain.MaintenanceFees;
using Harmonia.Domain.Payments;

namespace Harmonia.Application.Payments;

public sealed class GetBalance(
    ISession session,
    IMaintenanceFeeStore feeStore,
    IPaymentStore paymentStore)
{
    public async Task<GetBalanceResult> ExecuteAsync(
        string? period, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new GetBalanceResult.Refused();

        string label;
        Func<MaintenanceFeeCharge,  bool> chargeFilter;
        Func<MaintenanceFeePayment, bool> paymentFilter;

        if (!string.IsNullOrEmpty(period))
        {
            if (!TryParsePeriod(period))
                return new GetBalanceResult.InvalidPeriod();
            label         = period;
            chargeFilter  = c => c.Period == period;
            paymentFilter = p => p.Period == period;
        }
        else
        {
            var prefix    = $"{DateTime.UtcNow.Year}-";
            label         = $"YTD-{DateTime.UtcNow.Year}";
            chargeFilter  = c => c.Period.StartsWith(prefix);
            paymentFilter = p => p.Period.StartsWith(prefix);
        }

        try
        {
            IReadOnlyList<MaintenanceFeeCharge>  charges;
            IReadOnlyList<MaintenanceFeePayment> payments;

            if (ctx.IsAdmin)
            {
                charges  = await feeStore.ListAllChargesAsync(ct);
                payments = await paymentStore.ListAllPaymentsAsync(ct);
            }
            else
            {
                if (ctx.HouseholdRef is null)
                    return new GetBalanceResult.Refused();
                var hh = ctx.HouseholdRef;
                charges  = await feeStore.ListChargesAsync(hh, ct);
                payments = await paymentStore.ListPaymentsByHouseholdAsync(hh, ct);
            }

            var chargedByHh = charges
                .Where(chargeFilter)
                .GroupBy(c => c.HouseholdRef)
                .ToDictionary(g => g.Key, g => g.Sum(c => c.AmountEur));

            var paidByHh = payments
                .Where(paymentFilter)
                .GroupBy(p => p.HouseholdRef)
                .ToDictionary(g => g.Key, g => g.Sum(p => p.AmountEur));

            var households = chargedByHh.Keys.Union(paidByHh.Keys)
                                        .OrderBy(h => h.Value)
                                        .ToList();

            var lines = households
                .Select(hh =>
                {
                    var charged = chargedByHh.GetValueOrDefault(hh, 0m);
                    var paid    = paidByHh.GetValueOrDefault(hh, 0m);
                    return new BalanceLine(hh, charged, paid, charged - paid);
                })
                .ToList();

            return new GetBalanceResult.Ok(label, lines);
        }
        catch (Exception)
        {
            return new GetBalanceResult.Failed();
        }
    }

    private static bool TryParsePeriod(string period)
    {
        if (period is not { Length: 7 } || period[4] != '-')
            return false;
        return int.TryParse(period[..4], out _)
            && int.TryParse(period[5..], out var month)
            && month is >= 1 and <= 12;
    }
}
```

- [ ] **Step 4: Run tests (GREEN)**

```
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~GetBalanceTests" --no-build
```

Expected: `7 passed, 0 failed`.

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Application/Payments/GetBalance.cs tests/Harmonia.UnitTests/Application/GetBalanceTests.cs
git commit -m "feat: add GetBalance use case with in-process charge/payment join"
```

---

## Task 4: PaymentEndpoints and endpoint unit tests

**Test-first: yes — write `PaymentEndpointsTests.cs` referencing `PaymentEndpoints` before the class exists; `dotnet build` fails with CS0246.**

**Files:**
- Create: `src/Harmonia.Api/Payments/PaymentEndpoints.cs`
- Create: `tests/Harmonia.UnitTests/Api/PaymentEndpointsTests.cs`

---

- [ ] **Step 1: Write the failing endpoint tests**

Create `tests/Harmonia.UnitTests/Api/PaymentEndpointsTests.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Payments;
using Harmonia.Application;
using Harmonia.Application.Payments;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Api;

public class PaymentEndpointsTests
{
    private static RecordPayment RecordUseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakePaymentStore());

    private static ListAllPayments ListAllUseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakePaymentStore());

    private static ListMyPayments ListMyUseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakePaymentStore());

    private static GetBalance BalanceUseCase(SessionContext? ctx) =>
        new(new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakePaymentStore());

    [Fact]
    public async Task RecordPayment_admin_returns_201()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var body = new RecordPaymentRequest(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var result = await PaymentEndpoints.RecordPaymentEndpoint(
            RecordUseCase(ctx), body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status201Created, status.StatusCode);
    }

    [Fact]
    public async Task RecordPayment_duplicate_returns_200()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakePaymentStore();
        var body = new RecordPaymentRequest(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");
        var useCase = new RecordPayment(new FakeSession(ctx), store);
        await useCase.ExecuteAsync("HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var result = await PaymentEndpoints.RecordPaymentEndpoint(
            useCase, body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task RecordPayment_no_session_returns_403()
    {
        var body = new RecordPaymentRequest(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var result = await PaymentEndpoints.RecordPaymentEndpoint(
            RecordUseCase(null), body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task ListAllPayments_admin_returns_200()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);

        var result = await PaymentEndpoints.ListAllPaymentsEndpoint(
            ListAllUseCase(ctx), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task ListMyPayments_resident_returns_200()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));

        var result = await PaymentEndpoints.ListMyPaymentsEndpoint(
            ListMyUseCase(ctx), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task GetBalance_valid_period_returns_200()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);

        var result = await PaymentEndpoints.GetBalanceEndpoint(
            BalanceUseCase(ctx), "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task GetBalance_invalid_period_returns_400()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));

        var result = await PaymentEndpoints.GetBalanceEndpoint(
            BalanceUseCase(ctx), "not-a-period", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, status.StatusCode);
    }

    [Fact]
    public async Task GetBalance_no_session_returns_403()
    {
        var result = await PaymentEndpoints.GetBalanceEndpoint(
            BalanceUseCase(null), "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task GetBalance_store_failure_returns_500()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new GetBalance(
            new FakeSession(ctx), new FailingMaintenanceFeeStore(), new FakePaymentStore());

        var result = await PaymentEndpoints.GetBalanceEndpoint(
            useCase, "2026-07", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }
}
```

- [ ] **Step 2: Verify build fails (RED)**

```
dotnet build tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
```

Expected: `CS0246 The type or namespace name 'PaymentEndpoints' could not be found` and `CS0246 The type or namespace name 'RecordPaymentRequest' could not be found`.

- [ ] **Step 3: Implement `PaymentEndpoints`**

Create `src/Harmonia.Api/Payments/PaymentEndpoints.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Payments;
using Harmonia.Domain.Payments;

namespace Harmonia.Api.Payments;

public sealed record RecordPaymentRequest(
    string   HouseholdRef,
    decimal  AmountEur,
    string   Period,
    DateOnly DateReceived,
    string   IdempotencyKey);

public sealed record PaymentDto(
    Guid           Id,
    string         HouseholdRef,
    decimal        AmountEur,
    string         Period,
    DateOnly       DateReceived,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

public sealed record BalanceLineDto(
    string  HouseholdRef,
    decimal TotalCharged,
    decimal TotalPaid,
    decimal Balance);

public sealed record BalanceDto(string Label, IReadOnlyList<BalanceLineDto> Lines);

public static class PaymentEndpoints
{
    public static async Task<IResult> RecordPaymentEndpoint(
        RecordPayment useCase,
        RecordPaymentRequest body,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            body.HouseholdRef, body.AmountEur, body.Period,
            body.DateReceived, body.IdempotencyKey, ct);
        switch (result)
        {
            case RecordPaymentResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case RecordPaymentResult.Created created:
                return TypedResults.Json(ToDto(created.Payment),
                    statusCode: StatusCodes.Status201Created);
            case RecordPaymentResult.Duplicate duplicate:
                return TypedResults.Json(ToDto(duplicate.Payment),
                    statusCode: StatusCodes.Status200OK);
            case RecordPaymentResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> ListAllPaymentsEndpoint(
        ListAllPayments useCase,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        switch (result)
        {
            case ListPaymentsResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case ListPaymentsResult.Ok ok:
                return TypedResults.Json(
                    ok.Payments.Select(ToDto).ToList(),
                    statusCode: StatusCodes.Status200OK);
            case ListPaymentsResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> ListMyPaymentsEndpoint(
        ListMyPayments useCase,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        switch (result)
        {
            case ListPaymentsResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case ListPaymentsResult.Ok ok:
                return TypedResults.Json(
                    ok.Payments.Select(ToDto).ToList(),
                    statusCode: StatusCodes.Status200OK);
            case ListPaymentsResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> GetBalanceEndpoint(
        GetBalance useCase,
        string? period,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(period, ct);
        switch (result)
        {
            case GetBalanceResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case GetBalanceResult.InvalidPeriod:
                return TypedResults.BadRequest("Period must be in YYYY-MM format.");
            case GetBalanceResult.Ok ok:
                return TypedResults.Json(
                    new BalanceDto(ok.Label, ok.Lines
                        .Select(l => new BalanceLineDto(
                            l.HouseholdRef.Value, l.TotalCharged, l.TotalPaid, l.Balance))
                        .ToList()),
                    statusCode: StatusCodes.Status200OK);
            case GetBalanceResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private static PaymentDto ToDto(MaintenanceFeePayment p) =>
        new(p.Id, p.HouseholdRef.Value, p.AmountEur, p.Period,
            p.DateReceived, p.RecordedAt, p.IdempotencyKey);
}
```

- [ ] **Step 4: Run tests (GREEN)**

```
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj --filter "FullyQualifiedName~PaymentEndpointsTests" --no-build
```

Expected: `9 passed, 0 failed`.

- [ ] **Step 5: Run full unit test suite to check for regressions**

```
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/Harmonia.Api/Payments/PaymentEndpoints.cs tests/Harmonia.UnitTests/Api/PaymentEndpointsTests.cs
git commit -m "feat: add PaymentEndpoints (POST /payments, GET /payments/all, GET /payments, GET /balance)"
```

---

## Task 5: SQL schema and SqlPaymentStore with Rel integration tests

**Test-first: yes — write `SqlPaymentStoreTests.cs` referencing `SqlPaymentStore` before it exists; `dotnet build` fails with CS0246. The Rel tests also fail until the SQL table exists.**

**Files:**
- Modify: `db/schema.sql`
- Create: `src/Harmonia.Api/Adapters/SqlPaymentStore.cs`
- Create: `tests/Harmonia.IntegrationTests/SqlPaymentStoreTests.cs`

---

- [ ] **Step 1: Write the failing integration tests**

Create `tests/Harmonia.IntegrationTests/SqlPaymentStoreTests.cs`:

```csharp
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlPaymentStoreTests(SqlServerFixture fixture)
{
    private SqlPaymentStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task Record_first_time_returns_Created_and_duplicate_returns_same_payment()
    {
        var store = Store;
        var payment = new MaintenanceFeePayment(
            Id:             Guid.NewGuid(),
            HouseholdRef:   new HouseholdRef("HH-PAY-TEST"),
            AmountEur:      750m,
            Period:         "2026-07",
            DateReceived:   new DateOnly(2026, 7, 15),
            RecordedAt:     DateTimeOffset.UtcNow,
            IdempotencyKey: $"pay-rel-{Guid.NewGuid():N}");

        var first  = await store.RecordPaymentAsync(payment);
        var second = await store.RecordPaymentAsync(payment);

        var created   = Assert.IsType<RecordPaymentResult.Created>(first);
        var duplicate = Assert.IsType<RecordPaymentResult.Duplicate>(second);
        Assert.Equal(created.Payment.Id, duplicate.Payment.Id);
        Assert.Equal(750m, duplicate.Payment.AmountEur);
        Assert.Equal(new DateOnly(2026, 7, 15), duplicate.Payment.DateReceived);
    }

    [Fact]
    public async Task ListPaymentsByHousehold_returns_only_that_household_ordered_desc()
    {
        var store = Store;
        var hh = new HouseholdRef($"HH-LIST-{Guid.NewGuid():N}");
        var p1 = MakePayment(hh, "2026-05", new DateOnly(2026, 5, 10),  $"k1-{Guid.NewGuid():N}");
        var p2 = MakePayment(hh, "2026-07", new DateOnly(2026, 7, 1),   $"k2-{Guid.NewGuid():N}");
        var other = MakePayment(
            new HouseholdRef("HH-OTHER"), "2026-07", new DateOnly(2026, 7, 5), $"k3-{Guid.NewGuid():N}");

        await store.RecordPaymentAsync(p1);
        await store.RecordPaymentAsync(p2);
        await store.RecordPaymentAsync(other);

        var payments = await store.ListPaymentsByHouseholdAsync(hh);
        Assert.Equal(2, payments.Count);
        Assert.All(payments, p => Assert.Equal(hh, p.HouseholdRef));
        Assert.True(payments[0].DateReceived >= payments[1].DateReceived);
    }

    private static MaintenanceFeePayment MakePayment(
        HouseholdRef hh, string period, DateOnly dateReceived, string key) =>
        new(Guid.NewGuid(), hh, 500m, period, dateReceived, DateTimeOffset.UtcNow, key);
}
```

- [ ] **Step 2: Verify build fails (RED)**

```
dotnet build tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj
```

Expected: `CS0246 The type or namespace name 'SqlPaymentStore' could not be found`.

- [ ] **Step 3: Add the table DDL to `db/schema.sql`**

Append to the end of `db/schema.sql`:

```sql

-- Payment ledger (append-only; no UPDATE or DELETE ever executed against this table).
-- PK on (HouseholdRef, IdempotencyKey) mirrors MaintenanceFeeCharges.
-- DateReceived is admin-supplied (supports backfilling); RecordedAt is server-stamped.
IF OBJECT_ID(N'dbo.MaintenanceFeePayments', N'U') IS NULL
CREATE TABLE dbo.MaintenanceFeePayments
(
    Id             uniqueidentifier  NOT NULL,
    HouseholdRef   nvarchar(128)     NOT NULL,
    AmountEur      decimal(18, 2)    NOT NULL,
    Period         nvarchar(16)      NOT NULL,
    DateReceived   date              NOT NULL,
    RecordedAt     datetimeoffset(3) NOT NULL,
    IdempotencyKey nvarchar(128)     NOT NULL,
    CONSTRAINT PK_MaintenanceFeePayments  PRIMARY KEY (HouseholdRef, IdempotencyKey),
    CONSTRAINT UQ_MaintenanceFeePayments_Id UNIQUE (Id)
);
```

- [ ] **Step 4: Implement `SqlPaymentStore`**

Create `src/Harmonia.Api/Adapters/SqlPaymentStore.cs`:

```csharp
using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// SQL Server adapter for <see cref="IPaymentStore"/>.
/// Append-only: no UPDATE or DELETE ever executed.
/// Idempotency: PK on (HouseholdRef, IdempotencyKey) — a duplicate INSERT returns the existing row.
/// HouseholdRef values are personal data (R3) and must never appear in log lines.
/// </summary>
public sealed class SqlPaymentStore(string connectionString) : IPaymentStore
{
    private const int UniqueIndexViolation      = 2601;
    private const int UniqueConstraintViolation = 2627;

    public async Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "INSERT INTO dbo.MaintenanceFeePayments " +
                "(Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey) " +
                "VALUES (@Id, @HouseholdRef, @AmountEur, @Period, @DateReceived, @RecordedAt, @IdempotencyKey);";
            cmd.Parameters.AddWithValue("@Id", payment.Id);
            cmd.Parameters.AddWithValue("@HouseholdRef", payment.HouseholdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal)
                { Value = payment.AmountEur, Precision = 18, Scale = 2 });
            cmd.Parameters.AddWithValue("@Period", payment.Period);
            cmd.Parameters.Add(new SqlParameter("@DateReceived", SqlDbType.Date)
                { Value = payment.DateReceived.ToDateTime(TimeOnly.MinValue) });
            cmd.Parameters.Add(new SqlParameter("@RecordedAt", SqlDbType.DateTimeOffset)
                { Value = payment.RecordedAt });
            cmd.Parameters.AddWithValue("@IdempotencyKey", payment.IdempotencyKey);
            await cmd.ExecuteNonQueryAsync(ct);
            return new RecordPaymentResult.Created(payment);
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            var existing = await LoadExistingAsync(
                payment.HouseholdRef, payment.IdempotencyKey, ct);
            return new RecordPaymentResult.Duplicate(existing);
        }
        catch (Exception)
        {
            return new RecordPaymentResult.Failed();
        }
    }

    public async Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeePayments " +
            "WHERE HouseholdRef = @HouseholdRef " +
            "ORDER BY DateReceived DESC;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);

        var results = new List<MaintenanceFeePayment>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    public async Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeePayments " +
            "ORDER BY HouseholdRef ASC, DateReceived DESC;";

        var results = new List<MaintenanceFeePayment>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    private static MaintenanceFeePayment ReadRow(System.Data.Common.DbDataReader r) =>
        new(Id:             r.GetGuid(0),
            HouseholdRef:   new HouseholdRef(r.GetString(1)),
            AmountEur:      r.GetDecimal(2),
            Period:         r.GetString(3),
            DateReceived:   DateOnly.FromDateTime(r.GetDateTime(4)),
            RecordedAt:     r.GetDateTimeOffset(5),
            IdempotencyKey: r.GetString(6));

    private async Task<MaintenanceFeePayment> LoadExistingAsync(
        HouseholdRef householdRef, string idempotencyKey, CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeePayments " +
            "WHERE HouseholdRef = @HouseholdRef AND IdempotencyKey = @IdempotencyKey;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return ReadRow(reader);
    }
}
```

- [ ] **Step 5: Build succeeds**

```
dotnet build tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj
```

Expected: `Build succeeded, 0 errors`.

- [ ] **Step 6: Apply the schema to the test database**

The `SqlServerFixture` applies `db/schema.sql` on startup. Recreate the test database by running the integration tests (the fixture will pick up the new DDL on the next run). If the database already exists with old schema, the `IF OBJECT_ID … IS NULL` guard means the new statement is simply appended and applied.

- [ ] **Step 7: Run the Rel integration tests**

```
dotnet test tests/Harmonia.IntegrationTests/Harmonia.IntegrationTests.csproj --filter "Category=Rel&FullyQualifiedName~SqlPaymentStoreTests"
```

Expected: `2 passed, 0 failed`.

- [ ] **Step 8: Commit**

```
git add db/schema.sql src/Harmonia.Api/Adapters/SqlPaymentStore.cs tests/Harmonia.IntegrationTests/SqlPaymentStoreTests.cs
git commit -m "feat: add dbo.MaintenanceFeePayments schema and SqlPaymentStore"
```

---

## Task 6: Program.cs wiring and build verification

**Test-first: yes — build fails with missing registrations until wiring is added; no new unit tests needed (all logic already covered).**

**Files:**
- Modify: `src/Harmonia.Api/appsettings.json`
- Modify: `src/Harmonia.Api/Program.cs`

---

- [ ] **Step 1: Add the connection string key to `appsettings.json`**

In `src/Harmonia.Api/appsettings.json`, add `"Payments": ""` to the `ConnectionStrings` section:

```json
"ConnectionStrings": {
  "Reservations": "",
  "MaintenanceFees": "",
  "Expenses": "",
  "Payments": ""
}
```

- [ ] **Step 2: Wire `Program.cs`**

In `src/Harmonia.Api/Program.cs`, make the following additions.

**Add using directives** (alongside the existing usings at the top):

```csharp
using Harmonia.Api.Payments;
using Harmonia.Application.Payments;
```

**Add the connection string guard and singleton** (after the Expenses guard, before `if (builder.Environment.IsDevelopment())`):

```csharp
var payConnString = builder.Configuration.GetConnectionString("Payments");
if (string.IsNullOrWhiteSpace(payConnString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Payments is not configured. Supply it via environment " +
        "(ConnectionStrings__Payments) or a git-ignored local config file.");
}
builder.Services.AddSingleton<IPaymentStore>(new SqlPaymentStore(payConnString));
```

**Register the use cases** (after `builder.Services.AddScoped<GetFinancialSummary>()`):

```csharp
builder.Services.AddScoped<RecordPayment>();
builder.Services.AddScoped<ListAllPayments>();
builder.Services.AddScoped<ListMyPayments>();
builder.Services.AddScoped<GetBalance>();
```

**Add the route mappings** (after the `/financial-summary` route, before `app.Run()`):

```csharp
app.MapPost(
    "/payments",
    (RecordPayment useCase, RecordPaymentRequest body, ILoggerFactory loggers, CancellationToken ct)
        => PaymentEndpoints.RecordPaymentEndpoint(
            useCase, body, loggers.CreateLogger("Payments"), ct));

app.MapGet(
    "/payments/all",
    (ListAllPayments useCase, ILoggerFactory loggers, CancellationToken ct)
        => PaymentEndpoints.ListAllPaymentsEndpoint(
            useCase, loggers.CreateLogger("Payments"), ct));

app.MapGet(
    "/payments",
    (ListMyPayments useCase, ILoggerFactory loggers, CancellationToken ct)
        => PaymentEndpoints.ListMyPaymentsEndpoint(
            useCase, loggers.CreateLogger("Payments"), ct));

app.MapGet(
    "/balance",
    (GetBalance useCase, string? period, ILoggerFactory loggers, CancellationToken ct)
        => PaymentEndpoints.GetBalanceEndpoint(
            useCase, period, loggers.CreateLogger("Payments"), ct));
```

- [ ] **Step 3: Build the API project**

```
dotnet build src/Harmonia.Api/Harmonia.Api.csproj
```

Expected: `Build succeeded, 0 errors, 0 warnings`.

- [ ] **Step 4: Run the full unit test suite**

```
dotnet test tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/Harmonia.Api/appsettings.json src/Harmonia.Api/Program.cs
git commit -m "feat: wire payment endpoints into Program.cs (POST /payments, GET /payments/all, GET /payments, GET /balance)"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Covered by task |
|-----------------|----------------|
| Admin records payment (amount, period, DateReceived, IdempotencyKey) | Task 1 (RecordPayment) |
| Admin sees all payments across all apartments | Task 2 (ListAllPayments) |
| Resident sees own apartment's payments — R2 enforced | Task 2 (ListMyPayments) |
| Balance view per apartment (period or YTD) | Task 3 (GetBalance) |
| POST /payments → 201/200/403/500 | Task 4 (PaymentEndpoints) |
| GET /payments/all → 200/403/500 | Task 4 (PaymentEndpoints) |
| GET /payments → 200/403/500 | Task 4 (PaymentEndpoints) |
| GET /balance?period → 200/400/403/500 | Task 4 (PaymentEndpoints) |
| SQL table dbo.MaintenanceFeePayments, PK(HouseholdRef, IdempotencyKey) | Task 5 (schema) |
| SqlPaymentStore, namespace Harmonia.Api.Reservations.Adapters | Task 5 (SqlPaymentStore) |
| Idempotency via SqlException 2601/2627 + LoadExistingAsync | Task 5 (SqlPaymentStore) |
| No UPDATE or DELETE | All tasks (append-only by design) |
| Program.cs wiring + connection string guard | Task 6 |
| FakePaymentStore + FailingPaymentStore in Fakes.cs | Task 1 |
| Rel integration test with [Collection("Database")] + [Trait("Category","Rel")] | Task 5 |
| ListMyPayments for admin with no HouseholdRef → Refused | Task 2 test |
| GetBalance admin uses ListAllChargesAsync + ListAllPaymentsAsync | Task 3 |
| GetBalance resident uses ListChargesAsync(hh) + ListPaymentsByHouseholdAsync(hh) | Task 3 |
| YTD via `period.StartsWith($"{DateTime.UtcNow.Year}-")` | Task 3 |
| TypedResults throughout (not Results.*), switch statement form | Tasks 4, 5 |

No gaps found.

**Placeholder scan:** No "TBD", "TODO", or incomplete code blocks detected.

**Type consistency:**
- `MaintenanceFeePayment` constructor parameters consistent across all tasks (Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey)
- `RecordPaymentResult`, `ListPaymentsResult`, `GetBalanceResult` case names consistent across use case implementations, fake stores, tests, and endpoints
- `RecordPaymentRequest` record properties match `RecordPayment.ExecuteAsync` parameters
- `FakePaymentStore` uses composite key `(HouseholdRef, string)` matching the SQL PK
- `TypedResults.StatusCode(StatusCodes.Status403Forbidden)` used consistently (not `TypedResults.Forbid()`)
