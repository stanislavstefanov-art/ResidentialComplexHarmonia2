# Technical Research

**Task**: maintenance fees ledger household charges
**Generated**: 2026-07-11T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

record a maintenance fee charge per household and list all charges for a household — append-only ledger, SQL Server store, no edit or delete

---

## 2. Codebase Findings

### Existing Implementations

There is no existing implementation for maintenance fees. The codebase contains only the BBQ slot reservation feature. The following files constitute the full current implementation:

**Domain layer** (`src/Harmonia.Domain/` — namespace `Harmonia.Domain.Reservations`):
- `HouseholdRef.cs` — opaque identity value type `readonly record struct HouseholdRef(string Value)`; marked EU personal data (R3); shared across the whole app
- `ClaimOutcome.cs` — enum with three observable outcomes (ConfirmedYours, RefusedAlreadyTaken, CouldntConfirm)
- `ClaimResult.cs` — enum with four store-level results (Claimed, AlreadyHeldByMe, AlreadyHeldByOther, Unavailable)
- `OutcomeMapper.cs` — pure static mapper from `ClaimResult` to `ClaimOutcome`
- `SlotState.cs` — enum (Free, TakenMine, TakenOther)
- `SlotStateDeriver.cs` — pure static deriver from `HouseholdRef?` + `HouseholdRef` to `SlotState`

**Application layer** (`src/Harmonia.Application/` — namespace `Harmonia.Application.Reservations`):
- `Ports.cs` — declares `ISession`, `SessionContext`, `IReservationStore`, `ISlotGrid`
- `ReserveSlot.cs` — use case class; constructor-injects `ISession`, `ISlotGrid`, `IReservationStore`; no `householdRef` parameter by design (R2 enforced)
- `GetDayAvailability.cs` — use case class; same injection pattern; returns `AvailabilityResult`

**API / Adapter layer** (`src/Harmonia.Api/` — namespace `Harmonia.Api.Reservations` and `Harmonia.Api.Reservations.Adapters`):
- `ReservationEndpoints.cs` — Minimal API endpoint static class; translation only, no business logic; logs outcome but never `HouseholdRef` (R3)
- `Adapters/SqlReservationStore.cs` — raw ADO.NET SQL Server adapter implementing `IReservationStore`; claim is a single INSERT; unique-violation catch (2601/2627) decides race outcome
- `Adapters/DevSession.cs` — dev-only `ISession` stand-in yielding a fixed configured household
- `Adapters/ConfigSlotGrid.cs` — `ISlotGrid` backed by `IConfiguration`
- `Program.cs` — DI wiring; refuses to start outside Development if `DevSession` is registered; connection string from `ConnectionStrings:Reservations` config/env only

**Database** (`db/schema.sql`):
- Single table `dbo.Reservations (DayDate date, SlotKey nvarchar(64), HouseholdRef nvarchar(128), ClaimedAt datetime2(3))`
- PRIMARY KEY `(DayDate, SlotKey)` — this is the concurrency mechanism for R1

**New feature is fully greenfield.** No files, namespaces, classes, or SQL objects exist for `MaintenanceFees`.

### Architecture and Layers Affected

The maintenance fee ledger will touch all three layers, directly mirroring the reservation feature structure:

| Layer | New components needed |
|---|---|
| Domain (`Harmonia.Domain.MaintenanceFees`) | `MaintenanceFeeCharge` record (or equivalent value type); possibly a `ChargeId` typed value; no mutable state, no I/O |
| Application (`Harmonia.Application.MaintenanceFees`) | Port `IMaintenanceFeeStore`; use case `RecordCharge`; use case `ListCharges`; result record types |
| API/Adapter (`Harmonia.Api.MaintenanceFees`) | `SqlMaintenanceFeeStore` adapter; endpoint static class for POST (record) and GET (list); wiring in `Program.cs` |

The existing `ISession` / `SessionContext` / `HouseholdRef` types in `Harmonia.Application.Reservations` and `Harmonia.Domain.Reservations` are reusable across features — `HouseholdRef` in particular is the identity primitive the new feature must use for `ListCharges` (identity from `ISession` only, never from the request body, per R2).

### Integration Points

- **`ISession`** (already defined in `Harmonia.Application.Reservations.Ports`) — the only authorised source of `HouseholdRef` for the list-charges path. The application layer for maintenance fees must take a dependency on `ISession` in the same pattern as `ReserveSlot` and `GetDayAvailability`. Note the interface is currently declared in the `Harmonia.Application.Reservations` namespace; using it from `Harmonia.Application.MaintenanceFees` requires either a cross-namespace reference within the application project, or extracting `ISession`/`SessionContext`/`HouseholdRef` to a shared location (see Risk Indicators).
- **`HouseholdRef`** (currently in `Harmonia.Domain.Reservations`) — same cross-namespace consideration.
- **SQL Server** via `Microsoft.Data.SqlClient 5.2.2` — the only data access package; connection string from `ConnectionStrings:MaintenanceFees` (or shared `Reservations` key) supplied via environment / local config; never committed.
- **`Program.cs`** — must register `IMaintenanceFeeStore`, the two new use-case classes, and map new routes.
- **`db/schema.sql`** — must be extended with the `dbo.MaintenanceFeeCharges` table; the integration test fixture reads this file and applies it to the test database on startup.

### Patterns and Conventions

All patterns are derived from the existing reservation feature, which the new feature must mirror:

1. **Port interface in Application layer** — `IMaintenanceFeeStore` declared in `Harmonia.Application.MaintenanceFees` (mirroring `IReservationStore` in `Ports.cs`); adapter in `Harmonia.Api.Reservations.Adapters` (new sub-namespace `Harmonia.Api.MaintenanceFees.Adapters` or similar).
2. **Constructor injection into use-case classes** — use cases receive ports through constructor parameters; no static access, no service locator.
3. **Private constructor + nested `sealed record` result variants** — the discriminated union pattern used by `ReserveResult` and `AvailabilityResult`; new use-case result types should follow this pattern (e.g., `RecordChargeResult`, `ListChargesResult`).
4. **Residency gate first** — every use case begins with `_session.Resolve(); if (ctx is not { IsResident: true }) return Refused;` before touching the store.
5. **Append-only store method** — `IMaintenanceFeeStore.RecordChargeAsync(...)` must be INSERT-only; no UPDATE or DELETE paths on either the interface or the adapter.
6. **Raw ADO.NET, parameterized only** — no ORM; all SQL values via `SqlParameter` / `AddWithValue`; no string interpolation of values into SQL text.
7. **`SqlDbType.Date`** helper pattern** — `DayParameter(DateOnly)` in `SqlReservationStore` shows the conversion idiom; similar typed helpers should be used for `decimal`/`money` amounts.
8. **Endpoint static class, translation only** — `ReservationEndpoints` is a static class with only HTTP translation logic; no business rules; logs must never contain `HouseholdRef`.
9. **Routes on `app.MapGet` / `app.MapPost`** — Minimal API; no controllers.
10. **XML doc on all public types** explaining intent and invariants upheld.
11. **Warnings as errors, nullable enabled** — enforced in build; all new code must be nullable-clean.
12. **Async methods end in `Async`** — `RecordChargeAsync`, `ListChargesAsync`.

---

## 3. Documentation Findings

### Guides and Architecture Docs

- `docs/context/architecture.md` — defines the three-layer Clean Architecture, port locations, and the "translate only" rule for adapters. Directly applicable to the new feature.
- `docs/context/stack.md` — stack, build/test/run commands, R1 constraint, the `DateOnly`-to-`SqlDbType.Date` conversion note, SQL Server Podman setup.
- `docs/context/standards/code-quality.md` — enforced rules: warnings as errors, nullable, parameterized SQL only, pure functions for derivation, naming conventions, XML doc, common violation list.
- `docs/context/standards/git-workflow.md` — branch and commit standards (not inspected in detail; apply as normal).
- `docs/architecture/decisions/ADR-0001-identity-session-trust-root.md` — binding decision: `householdRef` comes from verified server-side session only; never from request body/query/header; never logged.
- `docs/architecture/decisions/ADR-0002-reservation-store-and-concurrency.md` — confirms SQL Server as the store, INSERT-based atomicity, unique index mechanism for R1. The append-only ledger is simpler (no race condition — two simultaneous charge records for the same household are both valid), but the same store, adapter pattern, and engine-parity rule apply.
- `context/cold/gap-log.md` — three open gaps: (1) concrete IdP vendor (DevSession stand-in remains); (2) `householdRef` retention/data-classification (DPO-gated, #4); (3) slot grid granularity. Gap #2 applies directly to the ledger: if `householdRef` is stored in `dbo.MaintenanceFeeCharges`, the same DPO gate applies.

### Architectural Decisions

- R2 (from ADR-0001): `householdRef` for listing charges must come from `ISession`, not the route or query string. The `GET /households/{id}/charges` pattern where `{id}` is caller-supplied would violate R2; the correct pattern is `GET /maintenance-fees/charges` where the household is resolved from the session.
- R3 (from ADR-0001 / ADR-0002): `householdRef` is EU personal data; must not appear in logs, error messages, or exception text. This applies to new endpoint log lines.
- Append-only is a product/security invariant stated in the task: `IMaintenanceFeeStore` must expose no UPDATE or DELETE methods; the store adapter must contain only INSERT and SELECT paths.
- ADR-0002 engine-parity rule: integration tests for the new store adapter must run against real SQL Server (not in-memory), using the same `SqlServerFixture` and `[Trait("Category","Rel")]` pattern.

### Derived Conventions

- The `ISession` interface is currently co-located with the reservation ports in `Harmonia.Application.Reservations`. Because the maintenance fee feature needs to call `ISession.Resolve()`, one of two conventions must be chosen before implementation: (a) the new use cases reference `Harmonia.Application.Reservations.ISession` directly (cross-feature reference within the Application project), or (b) `ISession`, `SessionContext`, and `HouseholdRef` are moved to a shared namespace (e.g., `Harmonia.Application` or `Harmonia.Domain`). The existing codebase has only one feature, so there is no established multi-feature precedent — this is a judgment call that should be made explicit before coding starts.
- The `DevSession` adapter is wired in `Program.cs` guarded by `builder.Environment.IsDevelopment()`. The new feature reuses the same `ISession` registration; no second identity adapter is needed.

---

## 4. Testing Landscape

### Existing Coverage

**Unit tests** (`tests/Harmonia.UnitTests/` — no DB):
- `Application/ResidencyGateTests.cs` — T8: residency gate on both read and reserve surfaces; uses `FakeSession`, `FakeSlotGrid`, `RecordingStore`
- `Application/ReserveSlotTests.cs` — T9/T10: session-derived household passed to store; unknown slot key short-circuits without claiming
- `Application/GetDayAvailabilityTests.cs` — availability derivation (not read in detail but present)
- `Domain/OutcomeMapperTests.cs` — pure mapping coverage
- `Domain/SlotStateDeriverTests.cs` — pure derivation coverage
- `Api/ReservationEndpointsTests.cs` — HTTP translation coverage
- `Api/LogExclusionTests.cs` — T16: householdRef never appears in log lines across all claim outcomes
- `Fakes.cs` — `FakeSession`, `FakeSlotGrid`, `RecordingStore` (scripted claim result)

**Integration tests** (`tests/Harmonia.IntegrationTests/` — real SQL Server, `[Trait("Category","Rel")]`):
- `SqlReservationStoreTests.cs` — T11–T18: single claim, sequential refusal, two-simultaneous-claims winner proof (T13/T14), idempotent retry (T15), immediate read-after-write visibility (T17), unreachable store (T18)
- `SqlServerFixture.cs` — `IAsyncLifetime` that reads `HARMONIA_SQL_CONNSTR` env var, creates `ReserveBbqTests` database, and applies `db/schema.sql`

**No tests exist for any maintenance fee concept.** Zero coverage of the new domain.

### Testing Framework and Patterns

- **Framework:** xUnit 2.9.3 with `xunit.runner.visualstudio 3.1.4`
- **Coverage collector:** `coverlet.collector 6.0.4`
- **Global using:** `Xunit` namespace globally imported in both test projects
- **Unit test fakes:** hand-written in `Fakes.cs`; no mocking framework (no Moq/NSubstitute); fakes are minimal and recording-oriented
- **Integration test fixture:** `IClassFixture<SqlServerFixture>` per test class; fixture creates the database and applies schema from `db/schema.sql`; each test uses a fresh unique key (`Guid.NewGuid()`) to avoid inter-test contention
- **Category trait:** `[Trait("Category","Rel")]` gates integration tests; `dotnet test --filter Category=Rel` runs them; `dotnet test` without filter runs all (unit + Rel)
- **TDD sequence:** the existing tests follow a watch-fail-then-implement pattern; new tests must be written first and observed to fail

### Coverage Gaps

The following areas will be introduced by the new feature and currently have zero test coverage:

- `Harmonia.Domain.MaintenanceFees` — any new domain types/logic
- `Harmonia.Application.MaintenanceFees.RecordCharge` use case — residency gate, householdRef sourced from session, store delegation
- `Harmonia.Application.MaintenanceFees.ListCharges` use case — residency gate, householdRef sourced from session, ordered result set
- `Harmonia.Api.MaintenanceFees` endpoints — HTTP translation, log exclusion of `householdRef`
- `SqlMaintenanceFeeStore` integration tests — INSERT path, SELECT list path, empty-list case, real SQL Server
- Log-exclusion test analogous to T16 covering the new endpoint log lines

---

## 5. Configuration and Environment

### Environment Variables

- `HARMONIA_SQL_CONNSTR` — required by `SqlServerFixture` for integration tests; must point to a real SQL Server 2022 instance; never committed
- `ASPNETCORE_ENVIRONMENT` — must be `Development` to allow `DevSession`; non-Development start fails with `InvalidOperationException`

### Configuration Files

- `ConnectionStrings:Reservations` (or env `ConnectionStrings__Reservations`) — the store connection string read in `Program.cs`; the new feature will need either a shared connection string or a new named key (e.g., `ConnectionStrings:MaintenanceFees`); the same "fail fast if not configured" guard pattern should be applied
- `SlotGrid:SlotKeys` — reservation-specific; not relevant to maintenance fees
- `Session:IsResident` and `Session:HouseholdRef` — `DevSession` configuration; reused as-is for the new feature (same identity adapter)
- `db/schema.sql` — the schema file is copied to the integration test output directory at build time (`<None Include="..\..\db\schema.sql" CopyToOutputDirectory="PreserveNewest" />`); extending this file adds the new table to the test database automatically

### Feature Flags and Deployment Concerns

- No feature flags exist in the codebase. The new feature will be wired directly in `Program.cs`.
- `DevSession` guard: the existing guard (`if (!builder.Environment.IsDevelopment()) throw`) applies equally to the new feature since both share the same `ISession` registration. No additional guard needed.
- DPO gate (#4): `householdRef` stored in `dbo.MaintenanceFeeCharges` is EU personal data; the same DPO-gated retention/classification gap from `gap-log.md` applies. This is a `training-open` gate for a training run but a production hard-stop.
- Azure SQL free-forever serverless tier (EU region) is the production target per ADR-0002; the new table will co-reside in the same database.

---

## 6. Risk Indicators

- **`ISession` and `HouseholdRef` are namespace-scoped to Reservations.** `ISession` is declared in `Harmonia.Application.Reservations` and `HouseholdRef` in `Harmonia.Domain.Reservations`. A second feature consuming them creates an implicit cross-feature dependency within the same project. This must be resolved before coding: either accept the cross-namespace reference or extract these types to a shared location. No established precedent exists in the codebase — this is the first multi-feature situation.
- **`db/schema.sql` is a single monolithic file applied by `SqlServerFixture`.** Adding the new table means the integration test fixture will apply both the `Reservations` and `MaintenanceFeeCharges` DDL in one shot. This is fine for now but means the schema file has no migration versioning — a risk for future incremental changes.
- **No existing test coverage for the new domain.** Zero tests exist for any maintenance fee concept; all coverage must be written from scratch, including the residency gate, session-derivation, append-only invariant, log-exclusion, and SQL integration tests.
- **Append-only invariant has no enforcement in the store interface itself.** The interface contract is stated in task requirements and must be upheld by not declaring UPDATE/DELETE methods; there is no framework-level enforcement. A code-review check is the only gate.
- **`householdRef` retention gap (#4) applies to the new table.** Storing `householdRef` in `dbo.MaintenanceFeeCharges` is EU personal data; the DPO gate is still open. For a training run this is `training-open`; for production it is a hard-stop.
- **Amount/currency type not specified.** The task says "maintenance fee charge" but does not specify the data type for the amount. SQL Server `decimal(18,2)` or `money` must be chosen; the domain model must use a typed value (not `float`/`double` per code-quality standards). This is a requirements clarity gap.
- **No error or retry contract specified for `RecordCharge`.** The reservation feature returns `ClaimResult.Unavailable` on store error. The ledger feature needs an equivalent result variant for store errors on the INSERT path. The shape of `RecordChargeResult` is not stated in the task context.
- **`SqlServerFixture` creates a database named `ReserveBbqTests`.** The same database will be used for maintenance fee integration tests (because the fixture is shared and applies the full `db/schema.sql`). This is convenient but means both feature's test data co-exist in one database; test isolation relies on unique keys per test, which will need to be carried into the new test class.
- **`Program.cs` grows with each feature.** The current `Program.cs` is 47 lines and wires one feature. Adding a second set of registrations and routes is straightforward but there is no modular organisation (e.g., extension methods) yet. This is low-risk for two features but worth noting.
- **Requirements clarity is thin (< 50 words).** The task description is minimal. Key open questions: What fields does a charge record carry beyond `householdRef` and amount? Is there a `description`/`period` field? Who records the charge — any resident, or only an admin role? The `isResident` flag from `ISession` gates on resident status; if only an admin (management) can record fees, a separate role check is needed and `ISession` may need extension.

---

## 7. Summary for Complexity Assessment

The maintenance fee ledger task touches all three architectural layers: Domain (new value types and/or records for a charge entity), Application (new `IMaintenanceFeeStore` port, two use-case classes `RecordCharge` and `ListCharges`), and API/Adapter (SQL Server adapter, two Minimal API endpoints, `Program.cs` wiring). The estimated file change surface is 8–12 new source files plus one schema addition (`db/schema.sql`), with `Program.cs` modified. No existing files are modified except `db/schema.sql` and `Program.cs`. The pattern is well-established: the reservation feature provides a direct precedent for every structural decision. The primary novelty is that this feature is a simple append-and-list ledger, which is structurally simpler than the reservation feature (no concurrency race, no unique-key conflict path, no outcome mapping needed for the INSERT).

Test coverage must be built entirely from scratch. The testing framework and patterns are clear and proven: xUnit fakes for unit tests, `SqlServerFixture` + `[Trait("Category","Rel")]` for integration tests, and a `CapturingLogger`-style log-exclusion test for R3 compliance. The concurrency concern from R1 does not apply to the ledger (two simultaneous charge records for the same household are both valid), but the engine-parity rule from ADR-0002 still applies — integration tests must run against real SQL Server.

The two most significant risk factors are: (1) the namespace placement of `ISession` and `HouseholdRef`, which are currently scoped to the Reservations feature and will need a sharing strategy before the first line of maintenance fee code is written; and (2) the thin requirements — the task description is under 50 words and leaves the amount type, any description/period field, and the recorder role (resident vs. admin) unspecified. These gaps should be resolved or explicitly assumed before the engineering station begins.
