# Technical Research

**Task**: financial summary expenses maintenance-fees
**Generated**: 2026-07-12T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

Financial summary report: GET /financial-summary returns period totals for both ledger sides — total maintenance fee charges billed and total association expenses for a given period. Complex-wide, no per-household breakdown. Resident and admin read. Reads from existing IMaintenanceFeeStore and IExpenseStore. No new SQL schema.

---

## 2. Codebase Findings

### Existing Implementations

**Domain models (no I/O, pure records):**
- `src\Harmonia.Domain\MaintenanceFees\MaintenanceFeeCharge.cs` — immutable record: `Guid Id`, `HouseholdRef HouseholdRef`, `decimal AmountEur`, `string Description`, `string Period` (e.g. `"2026-07"`), `DateTimeOffset ChargedAt`, `string IdempotencyKey`
- `src\Harmonia.Domain\Expenses\AssociationExpense.cs` — immutable record: `Guid Id`, `decimal AmountEur`, `string Description`, `string Category`, `DateOnly ExpenseDate`, `DateTimeOffset RecordedAt`, `string IdempotencyKey`

**Store port interfaces (Application layer):**
- `src\Harmonia.Application\MaintenanceFees\Ports.cs` — defines `IMaintenanceFeeStore` with:
  - `RecordChargeAsync(MaintenanceFeeCharge, CancellationToken)` → `RecordChargeResult`
  - `ListChargesAsync(HouseholdRef, CancellationToken)` → `IReadOnlyList<MaintenanceFeeCharge>` (per-household)
  - `ListAllChargesAsync(CancellationToken)` → `IReadOnlyList<MaintenanceFeeCharge>` (all households, ordered by HouseholdRef ASC then ChargedAt DESC)
  - Also contains discriminated union result types: `RecordChargeResult`, `ListChargesResult`, `ListAllChargesResult`
- `src\Harmonia.Application\Expenses\Ports.cs` — defines `IExpenseStore` with:
  - `RecordExpenseAsync(AssociationExpense, CancellationToken)` → `RecordExpenseResult`
  - `ListExpensesAsync(CancellationToken)` → `IReadOnlyList<AssociationExpense>` (all expenses, ordered by RecordedAt DESC)
  - Also contains discriminated union result types: `RecordExpenseResult`, `ListExpensesResult`

**Existing use cases (Application layer — the pattern to follow):**
- `src\Harmonia.Application\MaintenanceFees\ListAllCharges.cs` — admin-only; resolves session, checks `IsAdmin`, calls `store.ListAllChargesAsync()`, wraps in `ListAllChargesResult.Ok` or catches → `Failed`
- `src\Harmonia.Application\MaintenanceFees\ListCharges.cs` — resident-only; resolves session, checks `IsResident && HouseholdRef != null`, calls `store.ListChargesAsync(ctx.HouseholdRef.Value)`
- `src\Harmonia.Application\Expenses\ListExpenses.cs` — dual-role read (resident OR admin); resolves session, checks `IsResident or IsAdmin`, calls `store.ListExpensesAsync()`
- `src\Harmonia.Application\MaintenanceFees\RecordCharge.cs` — admin-only write; constructs domain record, calls `store.RecordChargeAsync()`
- `src\Harmonia.Application\Expenses\RecordExpense.cs` — admin-only write

**Session port:**
- `src\Harmonia.Application\Session.cs` — `ISession.Resolve()` returns `SessionContext?(IsResident, IsAdmin, HouseholdRef?)`; synchronous; null = no valid session

**SQL adapter implementations (Api/Adapters layer):**
- `src\Harmonia.Api\Adapters\SqlMaintenanceFeeStore.cs` — `ListAllChargesAsync` runs: `SELECT ... FROM dbo.MaintenanceFeeCharges ORDER BY HouseholdRef ASC, ChargedAt DESC` — no period filter in current SQL
- `src\Harmonia.Api\Adapters\SqlExpenseStore.cs` — `ListExpensesAsync` runs: `SELECT ... FROM dbo.AssociationExpenses ORDER BY RecordedAt DESC` — no period filter in current SQL

**Endpoint translation layer (Api layer):**
- `src\Harmonia.Api\MaintenanceFees\MaintenanceFeeEndpoints.cs` — static class, methods take use case + ILogger + CancellationToken; switch on discriminated union result; returns `TypedResults.Json(...)` or `TypedResults.StatusCode(...)`; no business logic
- `src\Harmonia.Api\Expenses\ExpenseEndpoints.cs` — same pattern as above
- `src\Harmonia.Api\Program.cs` — wires routes with `app.MapGet` / `app.MapPost`; registers use cases as `AddScoped`; stores as `AddSingleton`; injects `ILoggerFactory` and calls `loggers.CreateLogger("FeatureName")` per route

**Identity adapters:**
- `src\Harmonia.Api\Identity\EntraSession.cs` — production `ISession`; reads `extension_role` and `extension_householdRef` from `HttpContext.User.Claims`
- `src\Harmonia.Api\Adapters\DevAdminSession.cs` — dev-only; returns `SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null)`; refuses to boot outside `IsDevelopment()`
- `src\Harmonia.Api\Adapters\DevSession.cs` — dev-only resident stub

### Architecture and Layers Affected

The task touches three layers in inward-dependency order:

1. **Application layer** (`src\Harmonia.Application\`) — new use case file needed (e.g. `GetFinancialSummary.cs` in a new `FinancialSummary` sub-namespace, or alongside existing features). Will inject `ISession`, `IMaintenanceFeeStore`, and `IExpenseStore`. Must define a new result type (discriminated union) in a `Ports.cs` equivalent (or inline in the same file given there are no new ports).

2. **Api layer — endpoint** (`src\Harmonia.Api\`) — new static endpoint class (e.g. `src\Harmonia.Api\FinancialSummary\FinancialSummaryEndpoints.cs`) with a DTO for the response. Route registered in `Program.cs`.

3. **Api layer — Program.cs** (`src\Harmonia.Api\Program.cs`) — one `app.MapGet("/financial-summary", ...)` entry and one `builder.Services.AddScoped<GetFinancialSummary>()` entry.

No new store ports, no new SQL adapters, no schema changes — `IMaintenanceFeeStore.ListAllChargesAsync()` and `IExpenseStore.ListExpensesAsync()` are called and aggregated in-process.

### Integration Points

- `IMaintenanceFeeStore.ListAllChargesAsync()` — returns full unfiltered charge list; period filtering must be applied in-process in the use case (or a new overload added to the port — see Risk Indicators)
- `IExpenseStore.ListExpensesAsync()` — returns full unfiltered expense list; period filtering must be applied in-process in the use case
- `ISession` — already injected by the DI container as Scoped; the new use case follows the same constructor-injection pattern
- `ILoggerFactory` — already available in Program.cs; endpoint calls `loggers.CreateLogger("FinancialSummary")` (follow existing pattern)
- No external services, queues, or additional stores involved

### Patterns and Conventions

**Use case class pattern (copy exactly from ListExpenses.cs):**
```
public sealed class GetFinancialSummary(ISession session, IMaintenanceFeeStore feeStore, IExpenseStore expenseStore)
{
    public async Task<GetFinancialSummaryResult> ExecuteAsync(<period params>, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new GetFinancialSummaryResult.Refused();
        try { ... }
        catch (Exception) { return new GetFinancialSummaryResult.Failed(); }
    }
}
```

**Result discriminated union pattern (copy from Ports.cs):**
```
public abstract record GetFinancialSummaryResult
{
    private GetFinancialSummaryResult() { }
    public sealed record Refused                                : GetFinancialSummaryResult;
    public sealed record Ok(FinancialSummary Summary)           : GetFinancialSummaryResult;
    public sealed record Failed                                 : GetFinancialSummaryResult;
}
```

**Endpoint static method pattern:**
- Method signature: `(GetFinancialSummary useCase, <query params>, ILogger logger, CancellationToken ct)`
- Switch on result type; `TypedResults.Json(dto, statusCode: 200)` for Ok, `TypedResults.StatusCode(403)` for Refused, `TypedResults.StatusCode(500)` for Failed
- Log counts only — never log amounts or refs containing PII

**DI registration (Program.cs):**
- `builder.Services.AddScoped<GetFinancialSummary>();`
- `app.MapGet("/financial-summary", (...) => FinancialSummaryEndpoints.GetSummaryEndpoint(...))`
- Query parameters are bound from the lambda signature (ASP.NET Core Minimal API automatic binding)

**Period filtering approach — two options:**
- Option A (preferred — no interface change): the use case calls `ListAllChargesAsync()` and `ListExpensesAsync()`, then filters in-process. For charges: filter where `Period == periodParam` (string match, e.g. `"2026-07"`). For expenses: filter where `ExpenseDate` falls within the period's date range (e.g. year+month derived from the period string), or filter on `RecordedAt` date range. This matches the task statement "No new SQL schema" and avoids changing existing port interfaces.
- Option B (rejected by task constraint): add `ListAllChargesAsync(string period)` and `ListExpensesAsync(DateOnly from, DateOnly to)` overloads to the ports and adapters — would require interface changes and new SQL queries.

**Naming by field and period approach:**
- `MaintenanceFeeCharge.Period` is a string like `"2026-07"` — exact string match is the natural filter
- `AssociationExpense.ExpenseDate` is `DateOnly` — derive `(year, month)` from period string and filter `ExpenseDate.Year == year && ExpenseDate.Month == month`; alternatively filter by `RecordedAt` which is `DateTimeOffset` — use `ExpenseDate` as it represents the actual economic date, not the system recording time

---

## 3. Documentation Findings

### Guides and Architecture Docs

- `docs\context\stack.md` — stack: C#/.NET 8, ASP.NET Core Minimal API, raw ADO.NET, SQL Server; test framework xUnit; commands `dotnet build`, `dotnet test`, `dotnet test --filter Category=Rel`
- `docs\context\standards\code-quality.md` — TreatWarningsAsErrors, nullable enabled, SQL parameters only, PascalCase, `Async` suffix, XML doc on public types
- `docs\architecture\decisions\ADR-0001-identity-session-trust-root.md` — R2: derive household from verified session only; HouseholdRef is PII; never log it
- `docs\architecture\decisions\ADR-0003-identity-provider.md` — Entra External ID; `extension_role` (`resident`|`admin`) and `extension_householdRef` claims; `EntraSession` is the production adapter

### Architectural Decisions

- **R2 (identity):** Session `Resolve()` is the sole source of identity; the new use case must never read identity from query params or request body.
- **R3 (PII/logging):** `householdRef` is personal data; the financial summary response must not expose per-household breakdown (per task spec); log only counts/totals, never individual refs.
- **No new SQL schema:** the task explicitly states no DDL changes. In-process aggregation is the only conforming approach.
- **Append-only stores:** `MaintenanceFeeCharges` and `AssociationExpenses` tables are append-only by design (no UPDATE/DELETE). The new endpoint reads only — fully safe.
- **Gap #4 (admin role):** admin `ISession` is a dev-only stand-in (`DevAdminSession`). The new endpoint grants both resident and admin read access (same as `ListExpenses`), so it does not add a new admin-only gate; it follows the existing dual-role pattern.

### Derived Conventions

- Sub-namespace organisation: `Harmonia.Application.MaintenanceFees`, `Harmonia.Application.Expenses` — new use case should live in `Harmonia.Application.FinancialSummary` (or a top-level `Harmonia.Application` file if considered a cross-cutting aggregation)
- Api namespace: `Harmonia.Api.FinancialSummary`
- Every route has its own logger name string (e.g. `"FinancialSummary"`) passed from Program.cs
- DTOs are `sealed record` types defined at the top of the endpoint file
- No base classes or registries — no factory registration needed

---

## 4. Testing Landscape

### Existing Coverage

**Unit tests (xUnit, in-memory fakes):**
- `tests\Harmonia.UnitTests\Application\ListAllChargesTests.cs` — covers admin-ok, resident-refused, no-session-refused, store-error-failed for `ListAllCharges` use case
- `tests\Harmonia.UnitTests\Application\ListExpensesTests.cs` — covers resident-ok, admin-ok, no-session-refused, store-error-failed for `ListExpenses` use case
- `tests\Harmonia.UnitTests\Api\AdminChargesDashboardEndpointTests.cs` — covers 200/403 HTTP results and log-exclusion (householdRef never logged) for the endpoint layer
- `tests\Harmonia.UnitTests\Api\ExpenseEndpointsTests.cs` — covers 201/200/403/200 for record+list expense endpoints
- `tests\Harmonia.UnitTests\Fakes.cs` — contains `FakeMaintenanceFeeStore`, `FakeExpenseStore`, `FailingMaintenanceFeeStore`, `FailingExpenseStore`, `FakeSession` — all reusable for the new use case tests

**Integration tests (real SQL Server, `[Trait("Category", "Rel")]`):**
- `tests\Harmonia.IntegrationTests\SqlExpenseStoreTests.cs` — verifies RecordedAt DESC ordering and idempotency against real DB
- `tests\Harmonia.IntegrationTests\SqlListAllChargesTests.cs` — verifies HouseholdRef ASC / ChargedAt DESC ordering against real DB
- `tests\Harmonia.IntegrationTests\SqlMaintenanceFeeStoreTests.cs` — record + list per household
- `tests\Harmonia.IntegrationTests\SqlReservationStoreTests.cs` — reservation concurrency (unrelated)
- Integration test fixture: `SqlServerFixture` reads `HARMONIA_SQL_CONNSTR` env var; runs `schema.sql` from `db\schema.sql`; tagged `[Collection("Database")]`

### Testing Framework and Patterns

- **Framework:** xUnit with `FakeXxx` and `FailingXxx` in-memory store doubles defined in `tests\Harmonia.UnitTests\Fakes.cs`
- **Unit test pattern:** instantiate use case with `new FakeSession(ctx)` and `new FakeXxxStore()`; call `ExecuteAsync()`; `Assert.IsType<ResultType>(result)`
- **API unit test pattern:** call static endpoint method with use case + `NullLogger.Instance`; `Assert.IsType<JsonHttpResult<List<Dto>>>(result)` or `Assert.IsAssignableFrom<IStatusCodeHttpResult>(result)` then check `.StatusCode`
- **Log-exclusion pattern:** `CapturingLogger` (used in `AdminChargesDashboardEndpointTests`) captures log lines; asserts `DoesNotContain(SecretRef, line)` — this pattern should be replicated for the new endpoint if the response DTO or log messages could ever contain PII
- **Integration test pattern:** `[Collection("Database")]`, fixture-injected `SqlServerFixture`, unique idempotency keys per test run (`Guid.NewGuid():N`) to isolate concurrent test runs

### Coverage Gaps

The following areas will be introduced by this task and have no existing tests:

1. New use case `GetFinancialSummary` — unit tests needed for: resident-ok, admin-ok, no-session-refused, store-error-failed, period filtering logic (correct in-process filter for both date types)
2. New endpoint `GET /financial-summary` — unit tests needed for: 200 with correct totals DTO, 403 for no-session, 403 for non-resident/non-admin, 500 for store failure
3. Period parameter parsing and validation — no existing pattern for query parameter validation; this is a gap (see Risk Indicators)
4. No integration test for the in-process aggregation path — since no new SQL adapter is added, integration tests at the store level are covered by existing tests; the aggregation logic itself must be unit-tested

---

## 5. Configuration and Environment

### Environment Variables

- `HARMONIA_SQL_CONNSTR` — integration test SQL Server connection string (never committed)
- `ConnectionStrings:Reservations` (or `ConnectionStrings__Reservations` as env var) — reservation store connection
- `ConnectionStrings:MaintenanceFees` (or `ConnectionStrings__MaintenanceFees`) — maintenance fee store connection; already registered in Program.cs
- `ConnectionStrings:Expenses` (or `ConnectionStrings__Expenses`) — expense store connection; already registered in Program.cs
- `Session:IsAdmin` — dev-only config flag to boot `DevAdminSession`
- `Session:IsResident`, `Session:HouseholdRef` — dev-only resident session config

The new endpoint reads from the two existing store connection strings — no new connection string needed.

### Configuration Files

- `src\Harmonia.Api\appsettings.Development.local.json` (git-ignored) — local dev overrides for connection strings and session config
- `db\schema.sql` — single source of truth for DB schema; both tables already exist; no changes needed
- `tests\Harmonia.IntegrationTests\bin\Debug\net8.0\schema.sql` — copied build artifact; schema is applied by `SqlServerFixture.InitializeAsync()`

### Feature Flags and Deployment Concerns

- No feature flags present in the codebase
- `IsDevelopment()` guard in Program.cs controls which `ISession` adapter is registered — this already handles the dev/prod split for the admin role; the new endpoint inherits this transparently
- No new deployment concerns: the new route is a GET on existing stores with no schema changes

---

## 6. Risk Indicators

- **Period filter not in store interfaces:** `IMaintenanceFeeStore.ListAllChargesAsync()` and `IExpenseStore.ListExpensesAsync()` both return all rows unfiltered. For a large dataset this means full table scans plus in-process filtering. This is acceptable for a residential complex (small N) but must be documented as a scalability note.

- **Asymmetric date semantics between the two ledgers:** `MaintenanceFeeCharge.Period` is a free-form string (`"2026-07"`). `AssociationExpense.ExpenseDate` is a `DateOnly`. A period parameter (e.g. `"2026-07"`) must be parsed and applied differently to each store: string equality for charges, year+month comparison for expenses. The parsing and validation of the period query parameter has no existing pattern in the codebase — this is new territory.

- **No period parameter validation pattern established:** existing endpoints take typed route parameters (`DateOnly day`, `string householdRef`, `string slotKey`) or body JSON. A query string period filter (e.g. `?period=2026-07`) with format validation has no precedent. ASP.NET Core Minimal API binds query params automatically, but validation (format `YYYY-MM`, range check) is new code without a reference pattern.

- **`ListAllChargesAsync()` is admin-gated at use case level:** the new endpoint grants resident read too. The use case must call `ListAllChargesAsync()` directly (bypassing its admin gate) — so it cannot reuse `ListAllCharges` use case. It must call `store.ListAllChargesAsync()` directly in the new `GetFinancialSummary` use case, gated by `IsResident or IsAdmin`.

- **CapturingLogger not shared:** `CapturingLogger` appears in `AdminChargesDashboardEndpointTests.cs` — it appears to be defined locally in that test file or a nearby file. It needs to be findable/reusable for the new endpoint's log-exclusion test. (The financial summary response has no `HouseholdRef` field since it is complex-wide, so PII logging risk is lower, but the pattern should still be applied.)

- **Gap #4 (admin role not on real IdP):** `DevAdminSession` is a dev-only stand-in. The new endpoint allows admin read — this is the same posture as `ListExpenses`; no new risk is introduced beyond what already exists.

- **No existing test for `CapturingLogger` reuse:** confirm `CapturingLogger` is accessible in the test project before writing tests that depend on it.

- **`FakeExpenseStore` ordering in tests:** `FakeExpenseStore.ListExpensesAsync()` orders by `RecordedAt DESC`. In-process filtering in the new use case will operate on this already-ordered list — ordering is not a concern for correctness of totals but tests should not assert ordering of the summary (it is a single aggregate object).

---

## 7. Summary for Complexity Assessment

The financial summary endpoint is a read-aggregation task over two already-existing, fully-wired stores with no schema changes. It touches three layers: Application (new use case), Api/endpoint (new static endpoint class + DTO), and Program.cs (one route + one DI registration). The estimated file change surface is small: one new use case file, one new endpoint file, and two additions to Program.cs. No changes are required to domain models, store ports, SQL adapters, or the database schema.

The task introduces one genuinely new pattern: in-process period filtering with asymmetric date representations. `MaintenanceFeeCharge.Period` is a string (exact match), while `AssociationExpense.ExpenseDate` is `DateOnly` (year+month comparison derived from parsing the period string). The period query parameter also has no validation precedent in the codebase — parsing, format validation, and error response for a malformed period string must be designed. The dual-role session guard (`IsResident or IsAdmin`) is an established pattern already used by `ListExpenses`, so that part carries no novelty.

Test coverage posture is strong for the existing stores and existing use cases, with a well-exercised set of fakes (`FakeMaintenanceFeeStore`, `FakeExpenseStore`, `FakeSession`) ready to reuse. The new use case will need unit tests for both session-gate paths (resident-ok, admin-ok, no-session-refused, store-error-failed) and critically for the period filter logic on both date types — this is the highest-risk logic path and must be tested with boundary cases (first/last day of month, expenses recorded in a different month than their `ExpenseDate`, etc.). No integration-tier tests are needed since no new SQL adapters are added.
