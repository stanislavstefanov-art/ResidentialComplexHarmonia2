# Technical Research

**Task**: gdpr erasure retention householdcontacts directory
**Generated**: 2026-07-15T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

GDPR right-to-erasure (Art. 17) and retention enforcement for dbo.HouseholdContacts. A resident must be able to request deletion of their own contact record. The board must be able to hard-delete any contact record on behalf of a resident (e.g. for DSAR compliance). Retention: the system must not retain HouseholdContacts rows beyond a configurable period after a resident departs (or after they opt out). Same stack: .NET 8 minimal-API, raw ADO.NET, SQL Server, three-layer architecture (Domain → Application → Api), xUnit. R2: HouseholdRef always session-derived. R3: personal data (DisplayName, Phone, Email, Notes) never logged.

---

## 2. Codebase Findings

### Existing Implementations

**Domain layer**

- `src/Harmonia.Domain/Directory/HouseholdContact.cs` — sealed record with fields `HouseholdRef`, `DisplayName`, `Phone`, `Email`, `Notes`, `IsOptedOut`, `UpdatedAt`. All five data fields are nullable. No `DeletedAt`, `DepartedAt`, or `RetentionDeadline` column exists today.

**Application layer — ports**

- `src/Harmonia.Application/Directory/Ports.cs` — defines `IDirectoryStore` with exactly three methods:
  - `Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)`
  - `Task<UpdateContactResult> UpsertContactAsync(HouseholdRef, string?, string?, string?, bool?, CancellationToken)`
  - `Task<UpdateNotesResult> UpsertNotesAsync(HouseholdRef, string?, CancellationToken)`
  - **No delete, erase, or purge method exists.** No retention-related method exists.
- Also defines discriminated-union result types: `GetDirectoryResult` (Refused / ResidentView / BoardView / Failed), `UpdateContactResult` (Refused / Ok / Failed), `UpdateNotesResult` (Refused / Ok / Failed). New result types `EraseContactResult` and `PurgeExpiredResult` will need to be added here.

**Application layer — use cases**

- `src/Harmonia.Application/Directory/GetDirectory.cs` — reads all contacts via `store.ListAllAsync`; filters `IsOptedOut` from `ResidentView`. No erasure logic.
- `src/Harmonia.Application/Directory/UpdateMyContact.cs` — resident self-service update; reads `HouseholdRef` exclusively from `session.Resolve()` (R2 compliant). Contains `isOptedOut` forwarding. No delete path.
- `src/Harmonia.Application/Directory/UpdateContact.cs` — board updates any household by `householdRef` URL parameter; requires `IsAdmin`. No delete path.
- `src/Harmonia.Application/Directory/UpdateNotes.cs` — board manages notes for any household; requires `IsAdmin`. No delete path.
- **Gap: no `EraseMyContact` use case** (resident Art. 17 self-erasure).
- **Gap: no `EraseContact` use case** (board DSAR hard-delete).
- **Gap: no `PurgeExpiredContacts` use case** (retention enforcement).

**Adapter layer — SQL**

- `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` — implements `IDirectoryStore` using raw `Microsoft.Data.SqlClient`. Uses `MERGE ... WITH (HOLDLOCK)` for upserts. Connection string injected via constructor. R3 annotations in comments. **No DELETE statement exists anywhere in this file.**
- `ReadRow` method (line 103–110) maps ordinal positions 0–6 directly from the SELECT column order. Any schema change must keep column order consistent or update ordinal mapping.

**API layer — endpoints**

- `src/Harmonia.Api/Directory/DirectoryEndpoints.cs` — static class, four endpoint methods:
  - `GetDirectoryEndpoint` (GET /directory)
  - `UpdateMyContactEndpoint` (PUT /directory/contact)
  - `UpdateContactEndpoint` (PUT /directory/{householdRef}/contact)
  - `UpdateNotesEndpoint` (PUT /directory/{householdRef}/notes)
  - **No DELETE endpoint exists.** New endpoints needed: `DELETE /directory/contact` (resident self-erase) and `DELETE /directory/{householdRef}/contact` (board DSAR delete).
- DTOs in scope: `DirectoryEntryPublicDto`, `DirectoryEntryFullDto`, `UpdateContactRequest`, `UpdateNotesRequest`. No erase request DTO; erasure is a parameter-free DELETE (HouseholdRef comes from session or URL path only).

**API wiring — Program.cs**

- `src/Harmonia.Api/Program.cs` — DI registration: `builder.Services.AddSingleton<IDirectoryStore>(new SqlDirectoryStore(dirConnString))` (line 84). Connection string read from `ConnectionStrings:Directory` config key.
- Use cases registered as `AddScoped`: `GetDirectory`, `UpdateMyContact`, `UpdateContact`, `UpdateNotes` (lines 152–155). New use cases `EraseMyContact`, `EraseContact`, and `PurgeExpiredContacts` must each get an `AddScoped` registration and a `MapDelete` / `MapPost` route.
- **Retention config key is not yet defined.** A `Retention:ContactDaysAfterDeparture` (or similar) key will need to be added to `appsettings.json` / environment, read in `Program.cs`, and injected into `PurgeExpiredContacts`.

**Schema**

- `db/schema.sql` — `dbo.HouseholdContacts` DDL (lines 96–108):
  ```sql
  CREATE TABLE dbo.HouseholdContacts
  (
      HouseholdRef  nvarchar(128)     NOT NULL,
      DisplayName   nvarchar(256)     NULL,
      Phone         nvarchar(32)      NULL,
      Email         nvarchar(320)     NULL,
      Notes         nvarchar(2048)    NULL,
      IsOptedOut    bit               NOT NULL CONSTRAINT DF_HouseholdContacts_IsOptedOut DEFAULT 0,
      UpdatedAt     datetimeoffset(3) NOT NULL,
      CONSTRAINT PK_HouseholdContacts PRIMARY KEY (HouseholdRef)
  );
  ```
  - No `DepartedAt`, `RetentionDeadlineAt`, or soft-delete column. Hard DELETE is the only data-removal mechanism today.
  - Retention enforcement requires a way to know when a resident departed or opted out definitively. The schema has `UpdatedAt` (last write) but no departure timestamp. Two options: (a) add a `DepartedAt datetimeoffset(3) NULL` column via schema migration, or (b) use `UpdatedAt` as a proxy where `IsOptedOut = 1` combined with age triggers purge — but this is semantically wrong if the resident re-opts-in later. A `DepartedAt` column is the correct approach.
  - `dbo.MaintenanceFeeCharges`, `dbo.MaintenanceFeePayments`, `dbo.Reservations` reference `HouseholdRef nvarchar(128)` as a plain string — **no foreign key constraints** exist between those tables and `dbo.HouseholdContacts`. Deleting from `HouseholdContacts` has no cascade side-effects within the existing schema. Other tables retain their `HouseholdRef` rows independently (ledger tables are explicitly append-only with no delete).
  - `dbo.PushSubscriptions` (line 69–79) also has a `HouseholdRef` PK with no FK to `HouseholdContacts`. A full DSAR erasure may require coordinated deletion across `PushSubscriptions` and `NotificationHistory` as well — this is out of scope for the current task but is a data architecture risk to flag.

### Architecture and Layers Affected

| Layer | Component | Change required |
|---|---|---|
| Domain | `HouseholdContact.cs` | No domain logic change needed for hard-delete; potentially add `DepartedAt` if it becomes a domain concept |
| Application (ports) | `Ports.cs` (`IDirectoryStore`) | Add `DeleteContactAsync(HouseholdRef, CancellationToken)` and `PurgeContactsOlderThanAsync(DateTimeOffset cutoff, CancellationToken)` |
| Application (ports) | `Ports.cs` (result types) | Add `EraseContactResult` (Refused / Ok / NotFound / Failed) and `PurgeResult` (Ok(int rowsDeleted) / Failed) |
| Application (use cases) | New `EraseMyContact.cs` | Resident self-erase — HouseholdRef from session only (R2); calls `DeleteContactAsync` |
| Application (use cases) | New `EraseContact.cs` | Board DSAR delete — requires `IsAdmin`; HouseholdRef from URL parameter |
| Application (use cases) | New `PurgeExpiredContacts.cs` | Background / admin-triggered retention sweep; calls `PurgeContactsOlderThanAsync` with configurable cutoff |
| Adapter | `SqlDirectoryStore.cs` | Implement `DeleteContactAsync` (single-row `DELETE WHERE HouseholdRef = @HouseholdRef`); implement `PurgeContactsOlderThanAsync` (bulk `DELETE WHERE UpdatedAt < @Cutoff` or `DepartedAt < @Cutoff`) |
| API (endpoints) | `DirectoryEndpoints.cs` | Add `EraseMyContactEndpoint` (DELETE /directory/contact) and `EraseContactEndpoint` (DELETE /directory/{householdRef}/contact) |
| API (wiring) | `Program.cs` | Register new use cases with `AddScoped`; add `MapDelete` routes; read and inject retention config value |
| Schema | `db/schema.sql` | Potentially add `DepartedAt datetimeoffset(3) NULL` column to `dbo.HouseholdContacts`; add `IDirectoryStore.MarkDepartedAsync` if departure is tracked |
| Tests (unit) | New files in `tests/Harmonia.UnitTests/Application/` | `EraseMyContactTests.cs`, `EraseContactTests.cs`, `PurgeExpiredContactsTests.cs` |
| Tests (unit) | New file `tests/Harmonia.UnitTests/Api/` | `DirectoryEraseEndpointsTests.cs` (or append to `DirectoryEndpointsTests.cs`) |
| Tests (unit) | `tests/Harmonia.UnitTests/Fakes.cs` | Add `DeleteContactAsync` and `PurgeContactsOlderThanAsync` to `FakeDirectoryStore` and `FailingDirectoryStore` |
| Tests (integration) | `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs` | Add integration tests for `DeleteContactAsync` and `PurgeContactsOlderThanAsync` |

### Integration Points

**Internal dependencies (what the new code imports from)**

- `Harmonia.Domain.Directory.HouseholdContact` — domain record (read-only; no change expected)
- `Harmonia.Domain.HouseholdRef` — value type used as the primary key
- `Harmonia.Application.ISession` / `SessionContext` — identity resolution for R2
- `Harmonia.Application.Directory.IDirectoryStore` — port that the new use cases call
- `Microsoft.Data.SqlClient` — ADO.NET used in `SqlDirectoryStore` for new DELETE statements

**External / cross-feature dependencies to be aware of**

- `dbo.MaintenanceFeeCharges`, `dbo.MaintenanceFeePayments`, `dbo.Reservations` — share `HouseholdRef` as a plain string; no FK. Deleting from `HouseholdContacts` does NOT cascade. Financial and reservation history are unaffected by erasure.
- `dbo.PushSubscriptions` — personal data (Endpoint, P256dhKey, AuthKey, FallbackEmail) linked by `HouseholdRef`. A full Art. 17 erasure arguably covers this table too. Out of scope for this task but a known integration risk.
- `dbo.NotificationHistory` — `HouseholdRef` + `Title` retained; notification titles may contain personal data. Same DSAR risk as above.
- `BbqReminderService` (hosted service in `Program.cs`) — reads `IDirectoryStore`. If a purge runs concurrently with a reminder dispatch, the purged household may be missing from the directory mid-flight. This is safe (the notification just won't be sent) but should be noted.

### Patterns and Conventions

- **Use-case classes**: primary constructor pattern `public sealed class EraseMyContact(ISession session, IDirectoryStore store)`. No base class. No attributes or decorators.
- **Role gate**: guard clause at the top of `ExecuteAsync` — check session and role, return `Refused` immediately if not satisfied. Do NOT touch the store before passing the guard. See `UpdateMyContact.cs` line 15–16 and `UpdateContact.cs` line 13–14.
- **R2 enforcement**: `HouseholdRef` for resident-facing operations always comes from `ctx.HouseholdRef.Value` (session), never from any method parameter. The URL-path `householdRef` parameter is only used in board/admin use cases.
- **Exception handling**: wrap all store calls in `try { ... } catch (OperationCanceledException) { throw; } catch (Exception) { return new XxxResult.Failed(); }`. Never let unhandled exceptions surface.
- **Result types**: discriminated union sealed records defined in `Ports.cs`, private constructor, one `sealed record` per variant. Pattern: `public abstract record EraseContactResult { private EraseContactResult() { } public sealed record Refused : EraseContactResult; public sealed record Ok : EraseContactResult; public sealed record NotFound : EraseContactResult; public sealed record Failed : EraseContactResult; }`
- **SQL adapter**: raw `SqlCommand` with named parameters only — no string interpolation for values. `await using var conn = new SqlConnection(connectionString)` opened fresh per call (no connection pooling abstraction needed). Delete statement will be: `DELETE FROM dbo.HouseholdContacts WHERE HouseholdRef = @HouseholdRef;` — check `ExecuteNonQueryAsync` return value (rows affected) to distinguish `Ok` from `NotFound`.
- **Endpoint methods**: static methods on a static class (`DirectoryEndpoints`), taking the use case, required parameters, `ILogger`, and `CancellationToken`. Map result discriminated-union to HTTP status codes. R3: no PII in logger calls.
- **HTTP routes**: follow the existing directory pattern. Resident self-erase: `DELETE /directory/contact` (no path param — identity from session). Board DSAR: `DELETE /directory/{householdRef}/contact`.
- **DI registration**: `AddScoped` for use cases, registered after the store singleton. Pattern is already established for `GetDirectory`, `UpdateMyContact`, `UpdateContact`, `UpdateNotes`.

---

## 3. Documentation Findings

### Guides and Architecture Docs

- `.ai-run/guides/security/security.md` — directly relevant. Documents R2 (HouseholdRef from session only), R3 (PII never logged), the cross-user personal data sharing compliance gate, and the `DevSession` environment guard. Erasure must comply with all three rules. Key constraint: R3 applies to all new personal data fields from the moment they are introduced.
- `docs/context/architecture.md` — defines the three-layer clean architecture. Rule: "The API handler and the store adapter translate only — no business logic in either." Retention policy logic (e.g. computing the cutoff date) belongs in the use case or domain, not in `SqlDirectoryStore`.
- `docs/context/stack.md` — confirms .NET 8, raw ADO.NET, SQL Server, xUnit, real-SQL-Server integration tests.
- `context/cold/gap-log.md` — two open gaps directly blocking this task (see Risk Indicators section).

### Architectural Decisions

- **ADR-0001** (identity): `ISession` is the only source of `HouseholdRef`; `householdRef` is personal data under EU GDPR. Resident erasure requests must not accept a `householdRef` body or query parameter.
- **ADR-0002** (store): raw ADO.NET, SQL Server as truth. No ORM. Migrations are SQL scripts applied to `db/schema.sql`. If `DepartedAt` column is added, a `ALTER TABLE dbo.HouseholdContacts ADD DepartedAt datetimeoffset(3) NULL;` migration block must follow the `IF OBJECT_ID` guard pattern already in `schema.sql`.
- **GATE-DATA-1** (gap-log, status: TRIGGER FIRED — overdue): DPO decision on retention period and data-classification is required. This gate was triggered by PR #10 (2026-07-15). The retention period value (e.g. 30 days, 90 days, 365 days after departure/opt-out) is a DPO-owned decision, not an engineering constant.
- **Security guide — cross-user sharing gate**: Any endpoint that exposes one resident's data to another requires board + DPO written confirmation and an ADR. The DSAR board-erase endpoint (`DELETE /directory/{householdRef}/contact`) allows the board to act on a specific household's data — this is an admin function, not cross-user sharing, but the DPO must confirm the lawful basis for the admin role having this capability.

### Derived Conventions

- Result types are co-located with the port interface in `Ports.cs`, not in separate files. New result types (`EraseContactResult`, `PurgeResult`) go in the same file.
- Use cases are one-class-per-file in `src/Harmonia.Application/Directory/`. New files: `EraseMyContact.cs`, `EraseContact.cs`, `PurgeExpiredContacts.cs`.
- Unit test files mirror use-case files: `tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs`, etc.
- Fake stores in `Fakes.cs` implement the full interface. `FakeDirectoryStore` and `FailingDirectoryStore` must both gain the two new methods.
- XML doc comments are required on all public types (enforced by `b4604f7` code-quality commit). New public types need `/// <summary>` blocks.

---

## 4. Testing Landscape

### Existing Coverage

**Unit tests — Application layer** (all use `FakeSession`, `FakeDirectoryStore`, `FailingDirectoryStore`; no DB)

- `tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs` — 9 tests covering null session, resident view, board view, store failure, opted-out filtering.
- `tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs` — 7 tests covering resident/admin/null session, missing HouseholdRef, store failure, R2 enforcement (HouseholdRef from session), opt-out forwarding.
- `tests/Harmonia.UnitTests/Application/UpdateContactTests.cs` — 6 tests covering admin/resident/null session, store failure, HouseholdRef from parameter, opt-out forwarding.
- `tests/Harmonia.UnitTests/Application/UpdateNotesTests.cs` — 5 tests covering admin/resident/null session, store failure, HouseholdRef forwarding.

**Unit tests — API layer**

- `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs` — 15 tests: 200/403/500 for all four existing endpoint methods, plus DTO projection checks (PII omission from resident view, IsOptedOut in board view, opt-out forwarding).

**Unit tests — R3 log exclusion**

- `tests/Harmonia.UnitTests/Api/LogExclusionTests.cs` — covers `ReservationEndpoints.ClaimSlot` only. Uses `CapturingLogger` (custom `ILogger` that collects formatted lines) and asserts that `SecretRef` never appears in any log line. **No equivalent test exists for directory endpoints.** The erase endpoints will log `householdRef` risk if not checked.

**Integration tests — SQL adapter**

- `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs` — 6 tests: insert-then-read, partial update preserves existing phone, notes upsert, IsOptedOut roundtrip, null isOptedOut preserves existing, ordered results. All use `[Collection("Database")]`, `[Trait("Category", "Rel")]`, fresh `Guid`-based household refs to avoid cross-test collisions.

### Testing Framework and Patterns

- **Framework**: xUnit with `[Fact]` (single scenario) and `[Theory]` + `[InlineData]` / `[MemberData]` (parameterised scenarios). No Moq or NSubstitute — fakes are hand-written in `Fakes.cs`.
- **Unit test structure**: Arrange by constructing `new UseCase(new FakeSession(ctx), new FakeDirectoryStore())` inline. Assert with `Assert.IsType<T>` for discriminated-union result types. No shared setup methods (`[SetUp]`/constructor fixtures); each test is self-contained.
- **Fake design**: `FakeDirectoryStore` holds `List<HouseholdContact> Contacts` (public, mutable). Tests add seed data directly: `store.Contacts.Add(...)`. `FailingDirectoryStore` returns `Failed` from write methods and throws `InvalidOperationException` from read methods.
- **Integration test structure**: `SqlServerFixture fixture` injected via `[Collection("Database")]`. Store created fresh per test: `private SqlDirectoryStore Store => new(fixture.ConnectionString)`. Household refs use `$"HH-DIR-{Guid.NewGuid():N}"` to guarantee isolation. Tests call store methods directly and assert via `ListAllAsync`. `[Trait("Category", "Rel")]` marks them for the `dotnet test --filter Category=Rel` subset.
- **Log exclusion test**: `CapturingLogger : ILogger` collects formatted lines; asserts `DoesNotContain(secretRef, line)` across all lines. Pattern to replicate for directory erase endpoints.
- **R2 enforcement tests**: assert that `store.Contacts[0].HouseholdRef` equals the session's ref, not any caller-supplied value (see `UpdateMyContactTests.cs` line 58–65).

### Coverage Gaps

The following areas needed for GDPR erasure have zero existing test coverage:

1. `EraseMyContact` use case — no tests exist (class does not exist yet).
2. `EraseContact` use case — no tests exist (class does not exist yet).
3. `PurgeExpiredContacts` use case — no tests exist (class does not exist yet).
4. `SqlDirectoryStore.DeleteContactAsync` — no integration test exists (method does not exist yet). Must include: row-present-then-deleted, row-absent-returns-NotFound, isolation from other rows.
5. `SqlDirectoryStore.PurgeContactsOlderThanAsync` — no integration test. Must include: rows inside and outside the cutoff window, zero-row case, count of rows deleted.
6. `DirectoryEndpoints` erase endpoints — no unit tests. Need `DELETE /directory/contact` → 200/403/500/404 and `DELETE /directory/{householdRef}/contact` → same.
7. R3 log-exclusion for erase endpoints — no test asserts that `householdRef` is absent from logs emitted by `EraseMyContactEndpoint` and `EraseContactEndpoint`. This is a compliance gap.

---

## 5. Configuration and Environment

### Environment Variables

- `ConnectionStrings__Directory` — already wired in `Program.cs` line 77–84; used to construct `SqlDirectoryStore`. No change needed.
- **New**: A retention period configuration key must be introduced. Suggested name: `Retention__ContactDaysAfterDeparture` (integer, DPO-decided value). This is currently undefined in the codebase.

### Configuration Files

- `src/Harmonia.Api/appsettings.json` — not read in this analysis but is the standard location for non-secret app config. The `Retention` section should be added here with a placeholder/default.
- `appsettings.Development.local.json` — git-ignored local override; the retention value does not need to be a secret so it can live in the committed `appsettings.json`.
- `db/schema.sql` — the schema migration file. If `DepartedAt` is added, an `ALTER TABLE` block must be appended following the existing `IF OBJECT_ID` guard pattern.

### Feature Flags and Deployment Concerns

- No feature flag infrastructure exists in the codebase. The erase endpoints will be live from deployment. No toggle is available to gate them.
- The `PurgeExpiredContacts` use case needs a trigger mechanism. Options: (a) admin-only HTTP endpoint (board triggers purge manually), (b) `IHostedService` on a schedule. No scheduled task infrastructure exists today beyond `BbqReminderService` (which is a `BackgroundService`). Pattern for a scheduled purge: extend `BbqReminderService` as a reference.
- Admin role (`DevAdminSession` / `IsAdmin`) is still a dev-only stand-in (gap-log). The board-erase and purge-trigger paths require a real admin identity before production deployment.
- Azure SQL Database (prod) is in the EU region — correct for GDPR data residency. No change needed.

---

## 6. Risk Indicators

- **GATE-DATA-1 is overdue and explicitly blocks this task.** `context/cold/gap-log.md` states "blocking: member directory production release; erasure/DSAR workflow for HouseholdContacts." The retention period (days after departure or opt-out) is a DPO-owned decision. Engineering must not hardcode a retention period constant without DPO sign-off. This is a `hard-stop` gate under the factory's human-gate taxonomy.

- **Admin identity is a dev stub.** `DevAdminSession` yields `IsAdmin: true` only under `IsDevelopment()`. The board DSAR delete endpoint (`EraseContact`) requires a real admin identity before any non-dev use. Gap-log records this as open. Board-facing erase must not ship to production until ADR-0001 gate #6 (admin IdP) is closed.

- **Schema change required.** Retention enforcement based on departure date requires a `DepartedAt datetimeoffset(3) NULL` column that does not exist. The `IsOptedOut` + `UpdatedAt` fields cannot safely proxy departure without introducing ambiguity (a resident may opt out and back in without departing). The migration must follow the `IF OBJECT_ID` guard pattern in `schema.sql`. An `IDirectoryStore.MarkDepartedAsync` port method may also be needed unless departure is managed by an external system.

- **`dbo.HouseholdContacts` has no FK constraints to any other table.** Deletion is safe from a referential-integrity standpoint. However, financial history (`MaintenanceFeeCharges`, `MaintenanceFeePayments`) and reservation history (`Reservations`) retain `HouseholdRef` rows indefinitely. A full Art. 17 DSAR response must acknowledge that those append-only ledgers are retained for legal/accounting purposes under a competing lawful basis (GDPR Art. 17(3)(b) — legal obligation). This requires a written legal basis decision, not an engineering decision.

- **`dbo.PushSubscriptions` contains personal data (Endpoint, P256dhKey, AuthKey, FallbackEmail) and is not covered by this task scope.** A complete Art. 17 erasure covering all personal data held about a resident would also require deleting from `dbo.PushSubscriptions` and optionally `dbo.NotificationHistory`. This is a scope gap that could result in an incomplete DSAR response.

- **No R3 log-exclusion test for directory erase endpoints.** `LogExclusionTests.cs` only covers `ReservationEndpoints`. The erase endpoints will handle `householdRef` as a path parameter (in the board case) and must not log it. A `CapturingLogger`-based test must be written to assert this before the feature ships.

- **No `NotFound` result type in `UpdateContactResult`.** The current upsert pattern always succeeds or fails — there is no "row not found" variant. A `DELETE` operation must return `NotFound` when the row does not exist (rows-affected = 0). A new result type `EraseContactResult` with a `NotFound` variant must be defined, distinct from `UpdateContactResult`.

- **`SqlDirectoryStore.ReadRow` uses ordinal-position access** (columns 0–6 by index). If `DepartedAt` is added between existing columns, ordinal positions shift and `ReadRow` will silently misread data. The `SELECT` statement in `ListAllAsync` must explicitly list columns by name and `ReadRow` must use named column lookups or maintain correct ordinal order. Current implementation maps: 0=HouseholdRef, 1=DisplayName, 2=Phone, 3=Email, 4=Notes, 5=IsOptedOut, 6=UpdatedAt.

- **Retention purge trigger mechanism is undefined.** No scheduled-task infrastructure for purge exists. `BbqReminderService` shows the `BackgroundService` pattern but is reminder-specific. A decision is needed on whether purge is: (a) board-triggered via an admin endpoint, (b) a scheduled background service, or (c) both. This is an architectural decision that should surface as a human gate.

- **Concurrent erase + read during `ListAllAsync`.** If a purge runs in a background service while a GET /directory request is in flight, the result set may be inconsistent within a single request. SQL Server's default isolation level (READ COMMITTED) means each row read is committed-only, so partially-purged datasets may appear. This is generally acceptable but should be documented.

- **Requirements Clarity — retention trigger event.** The task specifies retention is measured "after a resident departs (or after they opt out)." These are two distinct events with different signals: departure is presumably an external event (building management system, not present in this schema); opt-out is `IsOptedOut = 1` in `dbo.HouseholdContacts`. The engineering team needs clarification on whether departure is tracked within this system or signalled externally.

---

## 7. Summary for Complexity Assessment

This task spans all three architectural layers (Domain, Application, Api) plus the SQL schema and test tiers. At the Application layer, three new use cases must be created (`EraseMyContact`, `EraseContact`, `PurgeExpiredContacts`), one new result type family added to `Ports.cs`, and the `IDirectoryStore` interface extended with two new methods. At the Adapter layer, `SqlDirectoryStore` needs `DeleteContactAsync` and `PurgeContactsOlderThanAsync` implementations. At the API layer, two new endpoint methods join `DirectoryEndpoints.cs` and two new `MapDelete` routes are wired in `Program.cs`. The schema may require a `DepartedAt` column migration. Estimated file change surface: 8–10 existing files modified, 5–6 new files created (3 use case classes, 3 unit test files, 1 integration test extension).

Technically, the erasure use cases follow established patterns exactly — the guard-clause + discriminated-union + exception-wrapper pattern is already proven across 4 existing directory use cases and a dozen use cases across other features. There is no novel pattern. The only technically novel element is the `PurgeExpiredContacts` purge logic, which requires a retention cutoff date computed from configuration, and the `DeleteContactAsync` adapter method which must distinguish zero-rows-affected (NotFound) from an exception (Failed). The `BbqReminderService` background service provides an existing pattern if purge is implemented as a hosted service.

Test coverage posture: the affected area (directory feature) is well-tested for existing functionality. The pattern for unit tests (inline arrange, `FakeDirectoryStore`, `Assert.IsType`) and integration tests (`[Collection("Database")]`, Guid-isolated refs, `Trait("Category","Rel")`) is clear and consistent. However, the specific erasure paths are entirely uncovered (no tests exist for any new use case, adapter method, or endpoint). Two compliance risks require dedicated test cases before shipping: R3 log exclusion for erase endpoints (modelled on `LogExclusionTests.cs`) and R2 enforcement for `EraseMyContact` (HouseholdRef from session only). The most significant risk factor is not technical but compliance: two human gates are open (GATE-DATA-1 for DPO retention period sign-off, and the admin-IdP gate for board-facing actions), and the scope of "full DSAR erasure" extends beyond `dbo.HouseholdContacts` to `dbo.PushSubscriptions` — a decision on scope must be made before implementation starts.
