# Technical Research

**Task**: directory gdpr retention departed
**Generated**: 2026-07-16T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

GDPR erasure Slice 2 — DepartedAt schema migration and retention enforcement for dbo.HouseholdContacts. Add nullable DepartedAt datetimeoffset column to dbo.HouseholdContacts via schema migration. Add MarkDeparted use case (board-only, sets DepartedAt = GETUTCDATE() for a given householdRef). Add PurgeExpiredContacts use case (board-only, hard-deletes rows where DepartedAt < NOW() - 1 year). New IDirectoryStore port methods for both. SqlDirectoryStore adapters. Two new board-only endpoints (PUT /directory/{householdRef}/departed, DELETE /directory/purge-expired). Full unit + integration test coverage. Same stack: .NET 8 minimal-API, raw ADO.NET, SQL Server, xUnit. R2: householdRef always from URL path param (board endpoints), never request body. R3: householdRef never logged. ADR-0004 is the governing decision.

---

## 2. Codebase Findings

### Existing Implementations

Domain layer:
- `src/Harmonia.Domain/Directory/HouseholdContact.cs` — sealed record with fields: `HouseholdRef`, `DisplayName`, `Phone`, `Email`, `Notes`, `IsOptedOut`, `UpdatedAt`. Missing `DepartedAt: DateTimeOffset?` — must be added.
- `src/Harmonia.Domain/HouseholdRef.cs` — opaque readonly record struct wrapping a string; XML doc already states EU personal data / R3 constraint.

Application layer (ports and use cases):
- `src/Harmonia.Application/Directory/Ports.cs` — defines `IDirectoryStore` port with four methods: `ListAllAsync`, `UpsertContactAsync`, `UpsertNotesAsync`, `DeleteContactAsync`. Two new methods needed: `MarkDepartedAsync` and `PurgeExpiredContactsAsync`. Also defines discriminated-union result records for all current operations; two new result types needed (`MarkDepartedResult` and `PurgeExpiredContactsResult`).
- `src/Harmonia.Application/Directory/GetDirectory.cs` — board/resident role-differentiated listing use case. Pattern: `session.Resolve()`, role check, store call, catch/return `Failed`. No changes required here.
- `src/Harmonia.Application/Directory/EraseContact.cs` — board DSAR hard-delete. Pattern to follow exactly for `MarkDeparted` (admin gate, `householdRef` from URL path param).
- `src/Harmonia.Application/Directory/UpdateContact.cs` — board contact-update. Same pattern as `EraseContact`.
- `src/Harmonia.Application/Directory/EraseMyContact.cs` — resident self-erase. No change needed.
- `src/Harmonia.Application/Directory/UpdateMyContact.cs` — resident self-update. No change needed.
- `src/Harmonia.Application/Directory/UpdateNotes.cs` — board notes update. Same admin-gate pattern.
- New files required: `src/Harmonia.Application/Directory/MarkDeparted.cs`, `src/Harmonia.Application/Directory/PurgeExpiredContacts.cs`.

Adapter / API layer:
- `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` — raw ADO.NET adapter in `Harmonia.Api.Reservations.Adapters` namespace (namespace inconsistency: lives under `Adapters/` but declared in `Reservations.Adapters`). Uses MERGE with HOLDLOCK for upserts. Private `ReadRow` uses ordinal-position access — ADR-0004 explicitly warns that `DepartedAt` must be appended at the end of all SELECT lists to avoid ordinal shifts.
- `src/Harmonia.Api/Directory/DirectoryEndpoints.cs` — minimal-API static endpoint class. DTOs: `DirectoryEntryPublicDto`, `DirectoryEntryFullDto`, `UpdateContactRequest`, `UpdateNotesRequest`. Two new endpoint methods and DTOs needed. Follows pattern: use-case call → switch on discriminated union → `TypedResults.*`.
- `src/Harmonia.Api/Program.cs` — wires `IDirectoryStore` / `SqlDirectoryStore` with `ConnectionStrings:Directory`. Registers all directory use cases with `AddScoped`. Two new use-case registrations and two new `app.Map*` calls needed.

Database:
- `db/schema.sql` — `dbo.HouseholdContacts` currently has columns: `HouseholdRef`, `DisplayName`, `Phone`, `Email`, `Notes`, `IsOptedOut`, `UpdatedAt`. No `DepartedAt` column. Schema migration needed: `ALTER TABLE dbo.HouseholdContacts ADD DepartedAt datetimeoffset NULL;` — must be idempotent (pattern: `IF COL_LENGTH('dbo.HouseholdContacts','DepartedAt') IS NULL`).

### Architecture and Layers Affected

- **Domain** — `HouseholdContact` record gains `DepartedAt: DateTimeOffset?` property.
- **Application (Ports)** — `IDirectoryStore` gains two new port methods; `Ports.cs` gains two new result discriminated unions.
- **Application (Use Cases)** — two new use-case classes: `MarkDeparted` and `PurgeExpiredContacts`.
- **Adapter (SQL)** — `SqlDirectoryStore` gains two new method implementations; `ReadRow` requires an updated SELECT column list (appending `DepartedAt` at ordinal position 7); `MarkDeparted` adapter runs a targeted UPDATE; `PurgeExpiredContacts` adapter runs a bulk DELETE.
- **Adapter (HTTP / API)** — `DirectoryEndpoints` gains two new static endpoint methods; `Program.cs` gains two new use-case DI registrations and two new route mappings.
- **Database** — `db/schema.sql` migration adds `DepartedAt datetimeoffset NULL` to `dbo.HouseholdContacts`.

### Integration Points

- `IDirectoryStore` port is the sole integration seam between the application and SQL — both new use cases depend on it.
- `ISession` is consumed by both new use cases to enforce the `IsAdmin` gate (same pattern as `EraseContact` and `UpdateContact`).
- `Program.cs` is the composition root — wires connection string, `SqlDirectoryStore` singleton, and scoped use cases.
- `db/schema.sql` is linked into `Harmonia.IntegrationTests` via `CopyToOutputDirectory` in the integration test project; the fixture runs the full schema on `SqlServerFixture.InitializeAsync`. The migration DDL must be folded into `schema.sql` so integration tests see the new column.
- No third-party packages are introduced; all required types (`SqlConnection`, `SqlParameter`, `SqlDbType`, `DateTimeOffset`) are already in scope.

### Patterns and Conventions

- **Discriminated union outcomes** — every port method returns an abstract record with sealed nested sub-records (e.g. `EraseContactResult.Ok`, `EraseContactResult.NotFound`, `EraseContactResult.Refused`, `EraseContactResult.Failed`). New result types must follow the same pattern.
- **Use-case constructor injection** — `(ISession session, IDirectoryStore store)` via primary constructor. No logic in constructor.
- **Admin gate pattern** — `var ctx = session.Resolve(); if (ctx is not { IsAdmin: true }) return new <Result>.Refused();`
- **Try/catch in use cases** — outer `OperationCanceledException` re-throw, catch `Exception` → return `Failed`. No logging in use cases.
- **Raw ADO.NET pattern** — `await using var conn = new SqlConnection(connectionString); await conn.OpenAsync(ct); await using var cmd = conn.CreateCommand();` — no ORM, no Dapper.
- **Ordinal-position `ReadRow`** — `SqlDirectoryStore.ReadRow` maps columns by ordinal index (0-based). Adding `DepartedAt` must append it at the end of the SELECT list; `ReadRow` must check `IsDBNull(7)` before calling `GetDateTimeOffset(7)`.
- **R3 logging discipline** — `householdRef` is never passed to any logger in endpoint or use-case code. The `DirectoryLogExclusionTests` pattern will need to be extended for the new endpoints.
- **Idempotent schema DDL** — all table and column additions in `schema.sql` are guarded with `IF OBJECT_ID(...) IS NULL` or equivalent. The migration must use `IF COL_LENGTH(...)` or a similar guard.
- **`[Collection("Database")]` + `[Trait("Category", "Rel")]`** — all integration test classes targeting SQL Server carry these attributes. New integration tests must follow suit.
- **XML doc comments on all public types/methods** — enforced by code-quality standard.

---

## 3. Documentation Findings

### Guides and Architecture Docs

- `docs/architecture/decisions/ADR-0004-householdcontacts-retention.md` — the governing decision for this entire slice. Prescribes: 1-year retention from `DepartedAt`; nullable `datetimeoffset` column; `MarkDeparted` and `PurgeExpiredContacts` use cases; board-only gates; purge triggered by board endpoint (not background service); `ReadRow` ordinal-safety note.
- `docs/context/architecture.md` — three-layer clean architecture: Domain (pure), Application (use cases / ports), Adapters (SQL, HTTP). Dependencies point inward only.
- `docs/context/stack.md` — .NET 8, raw ADO.NET, SQL Server, xUnit, Podman local. `HARMONIA_SQL_CONNSTR` env var for integration tests.
- `docs/context/standards/code-quality.md` — warnings as errors, nullable enabled, XML doc on public types, `householdRef` never logged.
- `docs/architecture/decisions/ADR-0001-identity-session-trust-root.md` — R2: `householdRef` from session only; board endpoints receive it from URL path param (never body).
- `docs/architecture/decisions/ADR-0002-reservation-store-and-concurrency.md` — SQL Server atomic write pattern.
- `docs/architecture/decisions/ADR-0003-identity-provider.md` — Entra External ID, dev stubs pattern.

### Architectural Decisions

- ADR-0004 (accepted, 2026-07-16) is the authoritative specification for this slice. Key decisions recorded:
  - Retention = 1 year after `DepartedAt` is set.
  - `DepartedAt` set only by board admin via dedicated endpoint, never by resident.
  - Purge sweep triggered by board endpoint — no background service.
  - `SqlDirectoryStore.ReadRow` must append `DepartedAt` at the end of SELECT column list to preserve existing ordinals.
  - Art. 17 on-demand erasure (PR #11) is unaffected.
- ADR-0001 governs R2 (householdRef from session or URL path param, never request body).

### Derived Conventions

- Board endpoints always call `session.Resolve()` inside the use case; the endpoint receives `householdRef` from the URL route template and passes it as a plain `string` to `ExecuteAsync`.
- `PurgeExpiredContacts` returns a count of deleted rows (useful for audit response); examining `EraseContact` (returns `Ok`/`NotFound`) and `SqlDirectoryStore.DeleteContactAsync` (reads `ExecuteNonQueryAsync` rowcount) suggests the purge adapter should also use `ExecuteNonQueryAsync` and surface the count.
- `MarkDeparted` mirrors `EraseContact` structure but issues an UPDATE (not DELETE) and needs a `NotFound` arm (row does not exist) plus an idempotent case (row already has `DepartedAt` set — treat as `Ok`).

---

## 4. Testing Landscape

### Existing Coverage

Unit tests (`tests/Harmonia.UnitTests/`):
- `Application/GetDirectoryTests.cs` — 8 tests covering session roles, opted-out filtering, store failure.
- `Application/EraseContactTests.cs` — 5 tests covering null session, resident refusal, admin success, not-found, store failure.
- `Application/EraseMyContactTests.cs`, `Application/UpdateContactTests.cs`, `Application/UpdateMyContactTests.cs`, `Application/UpdateNotesTests.cs` — full coverage of existing directory use cases.
- `Api/DirectoryEndpointsTests.cs` — 16 tests covering HTTP status mapping for all existing endpoints.
- `Api/DirectoryLogExclusionTests.cs` — R3 theory tests confirming `householdRef` never appears in logs for erase endpoints across all result scenarios (ok, not_found, refused, failed).

Integration tests (`tests/Harmonia.IntegrationTests/`):
- `SqlDirectoryStoreTests.cs` — 8 integration tests against real SQL Server: upsert insert/update, partial update preservation, notes upsert, opt-out, ordering, delete ok, delete not-found, delete isolation.

### Testing Framework and Patterns

- xUnit with `[Fact]` and `[Theory]` / `[InlineData]`.
- Unit tests use fakes from `tests/Harmonia.UnitTests/Fakes.cs`: `FakeDirectoryStore` (in-memory List-backed), `FailingDirectoryStore` (throws or returns Failed), `FakeSession`.
- Integration tests use `SqlServerFixture` (provisions real DB from `HARMONIA_SQL_CONNSTR`, applies `schema.sql`, fixture shared via `[Collection("Database")]`).
- Integration test naming pattern: `<Operation>_<condition>_<expectation>` (e.g. `DeleteContact_existing_row_returns_Ok_and_row_is_gone`).
- `[Trait("Category", "Rel")]` on integration tests; `dotnet test --filter Category=Rel` for real-DB tier.
- Log exclusion tests use a `CapturingLogger` (already present in the test project) with `Theory` to sweep all result branches.
- `NullLogger.Instance` used in pure endpoint tests where logging is not under test.

### Coverage Gaps

The following areas have no existing tests and must be added as part of this slice:

- `MarkDeparted` use case — unit tests for: null session, resident session, admin success (sets DepartedAt), target not-found, already-departed (idempotent), store failure.
- `PurgeExpiredContacts` use case — unit tests for: null session, resident session, admin success returns count, no eligible rows returns count zero, store failure.
- `DirectoryEndpoints.MarkDepartedEndpoint` — unit tests for: 200/204 on ok, 404 on not-found, 403 on refused, 500 on failed.
- `DirectoryEndpoints.PurgeExpiredContactsEndpoint` — unit tests for: 200 on ok (with count), 403 on refused, 500 on failed.
- R3 log exclusion tests for the two new endpoints — `householdRef` must never appear in log lines for `MarkDepartedEndpoint` across all result scenarios.
- `SqlDirectoryStore.MarkDepartedAsync` integration tests — set DepartedAt, verify column is set and ListAll returns it; idempotent re-set; not-found.
- `SqlDirectoryStore.PurgeExpiredContactsAsync` integration tests — rows with `DepartedAt < NOW()-1yr` are deleted, rows inside window are not, rows with `DepartedAt IS NULL` are not touched, returns correct count.
- `FakeDirectoryStore` and `FailingDirectoryStore` in `Fakes.cs` must be updated to implement the two new port methods.
- `HouseholdContact` record gains `DepartedAt` — all existing fakes constructing `HouseholdContact` positionally must be updated to include the new field (or the record must use named parameters).

---

## 5. Configuration and Environment

### Environment Variables

- `HARMONIA_SQL_CONNSTR` — server-level connection string used by `SqlServerFixture` to provision the test database. Must be set for integration tests (`dotnet test --filter Category=Rel`). Never committed.
- `ConnectionStrings:Directory` (env: `ConnectionStrings__Directory`) — connection string used by `SqlDirectoryStore` in production and local dev. Already wired in `Program.cs`. No new connection string required for this slice.

### Configuration Files

- `appsettings.Development.local.json` (git-ignored) — local dev overrides for connection strings and session config. Documented in `Program.cs` comment.
- `db/schema.sql` — single source of truth for all DDL; linked into integration test output via `.csproj` `<None>` item. The new `DepartedAt` column migration must be added here as an idempotent `IF COL_LENGTH(...)` ALTER statement.

### Feature Flags and Deployment Concerns

- No feature flags exist in this codebase; all features are enabled at deploy time.
- `PurgeExpiredContacts` is triggered by a board admin HTTP endpoint — no scheduler, cron job, or hosted service. This keeps deployment complexity unchanged.
- The two new endpoints use `.RequireAuthorization()` in prod (both are board-only). In dev, `DevAdminSession` already satisfies the `IsAdmin` guard inside the use cases.
- No new secrets or VAPID/ACS config is touched by this slice.

---

## 6. Risk Indicators

- `SqlDirectoryStore.ReadRow` uses ordinal-position column indexing. Adding `DepartedAt` anywhere other than the last position in the SELECT list will silently break existing field mappings (`IsOptedOut` reads `r.GetBoolean(5)`, `UpdatedAt` reads `r.GetDateTimeOffset(6)`). ADR-0004 explicitly calls this out; implementation must append `DepartedAt` at ordinal 7 and guard with `r.IsDBNull(7)`.
- `HouseholdContact` is a positional record (`sealed record HouseholdContact(... UpdatedAt)`). Adding `DepartedAt` as a new parameter changes the constructor signature. All call sites constructing `HouseholdContact` directly — including `SqlDirectoryStore.ReadRow`, `FakeDirectoryStore`, and every unit test that instantiates `HouseholdContact` — must be updated. There are at least 10 such sites across the codebase.
- `FakeDirectoryStore` and `FailingDirectoryStore` in `Fakes.cs` implement `IDirectoryStore`. Adding two new interface methods will cause compilation failures until both fakes are updated. All existing unit tests depend on these fakes — the build breaks until fakes are updated.
- The `db/schema.sql` migration must be idempotent. `SqlServerFixture` applies the entire `schema.sql` file on every test run against the shared `ReserveBbqTests` database. If the ALTER TABLE is not guarded with `IF COL_LENGTH('dbo.HouseholdContacts','DepartedAt') IS NULL`, repeated test runs will fail.
- `PurgeExpiredContacts` SQL must use `DATEADD(year, -1, SYSUTCDATETIMEOFFSET())` (consistent with existing UTC timestamping via `SYSUTCDATETIMEOFFSET()` in the store) rather than `GETUTCDATE()` (which returns `datetime`, not `datetimeoffset`). ADR-0004 uses `GETUTCDATE()` in its illustrative SQL snippet — the implementation must use the correct type-safe function.
- `MarkDeparted` is an UPDATE — it does not use the MERGE/HOLDLOCK pattern used by `UpsertContactAsync` and `UpsertNotesAsync`. A plain targeted UPDATE (with rowcount check) is correct here. However, there is no existing precedent for a plain UPDATE in `SqlDirectoryStore`; the implementation pattern must be derived from the DELETE in `DeleteContactAsync`.
- No test currently covers `DepartedAt`-aware filtering in `ListAllAsync`. If the task scope requires hiding or marking departed contacts differently in the directory listing (e.g. excluding them from `ResidentView`), this would require changes to `GetDirectory.ExecuteAsync`. The task spec does not mention this — but it is a potential scope question (the `DirectoryEntryFullDto` does not currently expose `DepartedAt`).
- The board DTO `DirectoryEntryFullDto` does not currently expose `DepartedAt`. For the board endpoint (`GET /directory`) to show departure status, the DTO must gain this field and `DirectoryEndpoints.ToFullDto` must map it. Whether this is in scope for Slice 2 is not stated explicitly — it is a likely gap between the task spec and the implementation.
- Log exclusion test pattern: `CapturingLogger` is already used in `DirectoryLogExclusionTests`. For the new `MarkDepartedEndpoint`, the `householdRef` parameter appears in the URL path and is passed into the endpoint method — R3 requires it never be logged. A new log exclusion theory test is required.
- No `NotFound` / idempotency decision for `PurgeExpiredContacts` when zero rows qualify: the task spec implies it returns a count (0 if nothing to purge), which is the correct idempotent design. The result type must distinguish this from a store error.

---

## 7. Summary for Complexity Assessment

This slice touches five of the six architectural layers: Domain (one record field addition), Application-Ports (interface extension + two new result unions), Application-UseCases (two new files), SQL-Adapter (two new method implementations + ReadRow ordinal update + schema DDL), and HTTP-Adapter (two new endpoint methods + DI wiring). The estimated file change surface is 10–14 files: `HouseholdContact.cs`, `Ports.cs`, `MarkDeparted.cs` (new), `PurgeExpiredContacts.cs` (new), `SqlDirectoryStore.cs`, `DirectoryEndpoints.cs`, `Program.cs`, `db/schema.sql`, `Fakes.cs` (update both fakes), plus 4–6 new test files across unit and integration tiers.

The technical novelty is low-to-medium: all required patterns (discriminated union results, admin-gated use cases, ordinal-position ADO.NET readers, idempotent schema DDL, xUnit integration tests against real SQL Server) are already established in the codebase and documented in ADR-0004. The main complication is the positional record constructor change to `HouseholdContact` — this creates a cascading compile-time breakage across all existing fakes and test fixtures, requiring coordinated updates before any new test can be run. The `ReadRow` ordinal-safety concern is also a fragile point that requires careful attention during implementation.

Test coverage posture for this slice is well-established in the existing directory feature but entirely absent for the new use cases and endpoints. The existing `FakeDirectoryStore`, `FailingDirectoryStore`, `DirectoryEndpointsTests`, and `DirectoryLogExclusionTests` provide clear templates. The integration test pattern (`SqlServerFixture` + `[Collection("Database")]` + `[Trait("Category", "Rel")]`) is fully in place and the new `MarkDepartedAsync` and `PurgeExpiredContactsAsync` SQL integration tests must follow it exactly. Key risk factors: (1) the `HouseholdContact` positional-record constructor change breaks all existing fakes and must be the first edit; (2) `ReadRow` ordinal integrity is fragile and must be verified against the updated SELECT list; (3) the `PurgeExpiredContacts` SQL must use `datetimeoffset`-compatible functions; (4) `db/schema.sql` idempotency guard is mandatory given the shared test database pattern.
