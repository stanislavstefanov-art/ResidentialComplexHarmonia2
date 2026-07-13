# Payment Recording Design

## Goal

Add a payment ledger so the association can record maintenance fee payments received by bank transfer and derive per-apartment balances (total charged minus total paid), enabling the board to track who owes vs who has settled.

## Architecture

Same three-layer architecture as every existing feature:
- **`Harmonia.Domain.Payments`** — pure domain record, no I/O
- **`Harmonia.Application.Payments`** — result unions, `IPaymentStore` port, four use cases
- **`Harmonia.Api.Payments`** — DTOs, static endpoint methods (`TypedResults` throughout)
- **`Harmonia.Api.Reservations.Adapters`** — `SqlPaymentStore` (raw ADO.NET, follows `SqlMaintenanceFeeStore` exactly)
- **`db/schema.sql`** — `dbo.MaintenanceFeePayments` table (IF NOT EXISTS guard)

`GetBalance` use case takes both `IMaintenanceFeeStore` (existing) and `IPaymentStore` (new) and does in-process join — same pattern as `GetFinancialSummary`.

## Domain Model

```csharp
// Harmonia.Domain/Payments/MaintenanceFeePayment.cs
namespace Harmonia.Domain.Payments;

public sealed record MaintenanceFeePayment(
    Guid           Id,
    HouseholdRef   HouseholdRef,
    decimal        AmountEur,
    string         Period,         // YYYY-MM — accounting period
    DateOnly       DateReceived,   // admin-supplied; supports backfilling
    DateTimeOffset RecordedAt,     // server-stamped (DateTimeOffset.UtcNow)
    string         IdempotencyKey);
```

No `Description` field — payments need only amount + period + date received. Mirrors `MaintenanceFeeCharge` structure (per-household, period string).

## Application Ports

```csharp
// Harmonia.Application/Payments/Ports.cs
public abstract record RecordPaymentResult {
    public sealed record Refused                                    : RecordPaymentResult;
    public sealed record Created(MaintenanceFeePayment Payment)    : RecordPaymentResult;
    public sealed record Duplicate(MaintenanceFeePayment Payment)  : RecordPaymentResult;
    public sealed record Failed                                     : RecordPaymentResult;
}

public abstract record ListPaymentsResult {
    public sealed record Refused                                              : ListPaymentsResult;
    public sealed record Ok(IReadOnlyList<MaintenanceFeePayment> Payments)   : ListPaymentsResult;
    public sealed record Failed                                               : ListPaymentsResult;
}

public sealed record BalanceLine(
    HouseholdRef HouseholdRef,
    decimal TotalCharged,
    decimal TotalPaid,
    decimal Balance);          // TotalCharged − TotalPaid

public abstract record GetBalanceResult {
    public sealed record Refused                                             : GetBalanceResult;
    public sealed record InvalidPeriod                                       : GetBalanceResult;
    public sealed record Ok(string Label, IReadOnlyList<BalanceLine> Lines) : GetBalanceResult;
    public sealed record Failed                                              : GetBalanceResult;
}

public interface IPaymentStore {
    Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default);

    Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default);

    Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default);
}
```

## Use Cases

### RecordPayment (admin-only write)
- Guard: `ctx is not { IsAdmin: true }` → `Refused`
- `HouseholdRef` comes from **request body** — admin is recording on behalf of a resident; caller authorization is still session-derived (R2 applies to the session check, not to the target household)
- Constructs `MaintenanceFeePayment` with `Guid.NewGuid()` and `DateTimeOffset.UtcNow` for `RecordedAt`; delegates to `IPaymentStore.RecordPaymentAsync`

### ListAllPayments (admin-only read)
- Guard: `ctx is not { IsAdmin: true }` → `Refused`
- Delegates to `IPaymentStore.ListAllPaymentsAsync()`

### ListMyPayments (resident read — R2)
- Guard: `ctx is not ({ IsResident: true } or { IsAdmin: true })` → `Refused`
- HouseholdRef from `ctx.HouseholdRef` (session only — R2); if null, return `Refused`
- Delegates to `IPaymentStore.ListPaymentsByHouseholdAsync(ctx.HouseholdRef)`

### GetBalance (resident sees own, admin sees all)
- Guard: `ctx is not ({ IsResident: true } or { IsAdmin: true })` → `Refused`
- Period filter:
  - `period` param supplied → validate YYYY-MM with `TryParsePeriod` (same helper as `GetFinancialSummary`); `InvalidPeriod` on failure; filter charges by `c.Period == period`, payments by `p.Period == period`
  - No `period` param (null/empty) → YTD: filter charges and payments where period starts with current year (e.g. `c.Period.StartsWith("2026-")`)
- Data fetch:
  - Admin: `IMaintenanceFeeStore.ListAllChargesAsync()` + `IPaymentStore.ListAllPaymentsAsync()`
  - Resident: `IMaintenanceFeeStore.ListChargesAsync(ctx.HouseholdRef)` + `IPaymentStore.ListPaymentsByHouseholdAsync(ctx.HouseholdRef)`
- In-process join: group filtered charges and payments by HouseholdRef; union of households; compute `BalanceLine` per household; order by HouseholdRef ASC
- Label: `period` if supplied, else `"YTD-{year}"` (e.g. `"YTD-2026"`)
- Returns `Ok(Label, Lines)` even if Lines is empty

## API Endpoints

All in `Harmonia.Api.Payments.PaymentEndpoints` (static class), switch statement form, `TypedResults` throughout.

| Method | Route | Use case | Auth | 201 | 200 | 400 | 403 | 500 |
|--------|-------|----------|------|-----|-----|-----|-----|-----|
| POST | `/payments` | `RecordPayment` | Admin | Created | Duplicate | — | Refused | Failed |
| GET | `/payments/all` | `ListAllPayments` | Admin | — | Ok | — | Refused | Failed |
| GET | `/payments` | `ListMyPayments` | Resident+Admin | — | Ok | — | Refused | Failed |
| GET | `/balance` | `GetBalance` | Resident+Admin | — | Ok | InvalidPeriod | Refused | Failed |

`GET /balance` accepts optional `?period=YYYY-MM` query parameter. When omitted, YTD is computed server-side.

### Request/Response shapes

```csharp
// POST /payments body
public sealed record RecordPaymentRequest(
    string   HouseholdRef,   // admin supplies target apartment
    decimal  AmountEur,
    string   Period,         // YYYY-MM
    DateOnly DateReceived,
    string   IdempotencyKey);

// Response DTOs
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
```

## SQL Schema

```sql
-- Payment ledger (append-only; no UPDATE or DELETE).
-- PK on (HouseholdRef, IdempotencyKey) mirrors MaintenanceFeeCharges.
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
    CONSTRAINT PK_MaintenanceFeePayments PRIMARY KEY (HouseholdRef, IdempotencyKey),
    CONSTRAINT UQ_MaintenanceFeePayments_Id UNIQUE (Id)
);
```

## SqlPaymentStore

Follows `SqlMaintenanceFeeStore` exactly:
- `RecordPaymentAsync`: INSERT with all fields; catch `SqlException` 2601/2627 → `LoadExistingAsync` → `Duplicate`
- `ListPaymentsByHouseholdAsync`: SELECT WHERE HouseholdRef = @HouseholdRef ORDER BY DateReceived DESC
- `ListAllPaymentsAsync`: SELECT all ORDER BY HouseholdRef ASC, DateReceived DESC
- Namespace: `Harmonia.Api.Reservations.Adapters` (matches existing stores)

## Program.cs Wiring

- Add `"Payments": ""` to `ConnectionStrings` in `appsettings.json`
- Guard + `AddSingleton<IPaymentStore>(new SqlPaymentStore(connStr))`
- `AddScoped<RecordPayment>`, `AddScoped<ListAllPayments>`, `AddScoped<ListMyPayments>`, `AddScoped<GetBalance>`
- `MapPost("/payments", ...)`, `MapGet("/payments/all", ...)`, `MapGet("/payments", ...)`, `MapGet("/balance", ...)`

## Testing

### Unit tests (Harmonia.UnitTests)
- `RecordPaymentTests` — 4 tests: admin creates, admin duplicate, non-admin refused, store failure
- `ListAllPaymentsTests` — 3 tests: admin ok, non-admin refused, store error
- `ListMyPaymentsTests` — 4 tests: resident ok (session HouseholdRef), admin refused (no HouseholdRef in admin session), no session refused, store error
- `GetBalanceTests` — 6 tests: admin all-apartments period filter, resident own-apartment period filter, YTD label, invalid period, empty result (no data), store error
- `PaymentEndpointsTests` — 5 tests: 201, 200 duplicate, 403, 400 (invalid period on balance), 500
- `FakePaymentStore` added to `Fakes.cs`

### Integration test (Harmonia.IntegrationTests)
- `SqlPaymentStoreTests` — 2 Rel tests: record+duplicate idempotency, list-by-household ordering; `[Collection("Database")]`, `[Trait("Category","Rel")]`

## Constraints

- R2: `HouseholdRef` for resident reads comes **only** from `ISession.Resolve()` — never from query/header/body
- R3: `HouseholdRef` never appears in log messages
- Append-only: no UPDATE or DELETE on `dbo.MaintenanceFeePayments`
- `GetBalance` for admin uses `ListAllChargesAsync` + `ListAllPaymentsAsync` (both existing + new); in-process join
- `GetBalance` for resident uses `ListChargesAsync(householdRef)` + `ListPaymentsByHouseholdAsync(householdRef)`
- `ListMyPayments` for admin role: if admin has no `HouseholdRef` in session, return `Refused` (admin uses `GET /payments/all` instead)
- YTD filter: `period.StartsWith($"{DateTime.UtcNow.Year}-")` — no cross-year YTD complexity needed
