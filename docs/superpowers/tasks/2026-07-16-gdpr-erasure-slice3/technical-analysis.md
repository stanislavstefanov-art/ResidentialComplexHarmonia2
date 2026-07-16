# Technical Research

**Task**: gdpr erasure notifications push-subscriptions
**Generated**: 2026-07-16T00:00:00Z
**Research path**: filesystem

---

## 1. Original Context

GDPR erasure Slice 3: complete DSAR by cascading Art. 17 erasure to dbo.PushSubscriptions and dbo.NotificationHistory. When EraseMyContact or EraseContact is called, also delete the household's push subscription (dbo.PushSubscriptions WHERE HouseholdRef = @ref) and notification history rows (dbo.NotificationHistory WHERE HouseholdRef = @ref) in the same SQL transaction. No new endpoints — the cascade happens inside the existing DeleteContactAsync SQL adapter method. Same stack: .NET 8 minimal-API, raw ADO.NET, SQL Server, xUnit. R2: HouseholdRef always session-derived for resident path. R3: HouseholdRef never logged.

---

## 2. Codebase Findings

### Existing Implementations

The erasure pipeline is already in place from Slices 1 and 2. The Slice 3 change is confined to a single adapter method.

**Endpoint layer:**
- `src/Harmonia.Api/Directory/DirectoryEndpoints.cs` — EraseMyContactEndpoint (`DELETE /directory/contact`, resident, returns 204 on Ok or NotFound, 403 on Refused) and EraseContactEndpoint (`DELETE /directory/{householdRef}/contact`, board DSAR, returns 204 on Ok, 404 on NotFound, 403 on Refused). Neither endpoint changes for Slice 3.

**Application use-case layer:**
- `src/Harmonia.Application/Directory/EraseMyContact.cs` — validates `IsResident: true` and `HouseholdRef: not null` from session (R2), then delegates to `store.DeleteContactAsync(ctx.HouseholdRef.Value, ct)`. No change needed.
- `src/Harmonia.Application/Directory/EraseContact.cs` — validates `IsAdmin: true`, accepts `householdRef` from URL path, delegates to `store.DeleteContactAsync(new HouseholdRef(householdRef), ct)`. No change needed.

**Port / interface:**
- `src/Harmonia.Application/Directory/Ports.cs` (lines 113–120) — `IDirectoryStore.DeleteContactAsync(HouseholdRef, CancellationToken)` returns `EraseContactResult`. Its XML doc already states "R3: never log householdRef value." No signature change is required for Slice 3; the cascade is an implementation detail of the adapter.
- `src/Harmonia.Application/Notifications/Ports.cs` (lines 40–49) — `INotificationStore` exposes `RemoveSubscriptionAsync`, `AppendHistoryAsync`, `GetHistoryAsync` and others, but has no delete-all-history-for-household method. No changes to this interface are required; the cascade runs inside `SqlDirectoryStore`, not through `INotificationStore`.

**SQL adapter — primary implementation target:**
- `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` (lines 103–121) — `DeleteContactAsync` currently opens one `SqlConnection`, issues a single `DELETE FROM dbo.HouseholdContacts WHERE HouseholdRef = @HouseholdRef`, checks rowcount (`0` → `NotFound`, `>0` → `Ok`), catches all non-cancellation exceptions and returns `Failed`. No transaction is used. This is the only file that changes for Slice 3.
- `src/Harmonia.Api/Adapters/SqlNotificationStore.cs` — `RemoveSubscriptionAsync` issues `DELETE FROM dbo.PushSubscriptions WHERE HouseholdRef = @HouseholdRef`. `AppendHistoryAsync` inserts; `GetHistoryAsync` reads last 30 days. Neither method is called from the erasure path today; the cascade will not call these methods — it will issue its own DELETE statements inside `DeleteContactAsync`'s transaction.

**DI wiring:**
- `src/Harmonia.Api/Program.cs` (lines 75 and 84) — `INotificationStore` registered with `notifConnString`; `IDirectoryStore` registered with `dirConnString`. Two separate connection strings are configured. The task spec says the cascade happens inside `DeleteContactAsync`, implying a single SQL transaction against whichever database holds all three tables. If the connection strings point to the same database instance, a standard `SqlTransaction` suffices. If they target separate databases, distributed transaction support (MSDTC or equivalent) would be required — this is the one architectural risk that must be confirmed before implementation.

**Schema (confirmed from `db/schema.sql`):**
- `dbo.PushSubscriptions` (lines 68–79): `HouseholdRef nvarchar(128) NOT NULL PRIMARY KEY`, plus `Endpoint`, `P256dhKey`, `AuthKey`, `FallbackEmail`, `CreatedAt`, `UpdatedAt`. All non-key columns are personal data (R3). No FK to `dbo.HouseholdContacts`.
- `dbo.NotificationHistory` (lines 82–92): `Id uniqueidentifier NOT NULL PRIMARY KEY`, `HouseholdRef nvarchar(128) NOT NULL` (indexed via `IX_NotificationHistory_HouseholdRef_SentAt`), `Title`, `SentAt`, `Channel`. No FK to `dbo.HouseholdContacts`.
- `dbo.HouseholdContacts` (lines 94–108): `HouseholdRef nvarchar(128) NOT NULL PRIMARY KEY`, plus contact fields and `DepartedAt` (added in Slice 2). No FK constraints in schema — all cascading is application-enforced.

### Architecture and Layers Affected

Only one layer changes. The other three layers (API, Application, Domain) remain untouched.

| Layer | Component | Change required |
|-------|-----------|-----------------|
| API / Adapter | `SqlDirectoryStore.DeleteContactAsync` | YES — add `SqlTransaction`, two extra DELETEs |
| Application | `EraseMyContact`, `EraseContact` | None |
| API / Endpoint | `DirectoryEndpoints` | None |
| Domain | `HouseholdRef`, result types | None |
| Test / Unit | `Fakes.cs` `FakeDirectoryStore.DeleteContactAsync` | Possibly — cascade simulation in fake (see gaps) |
| Test / Integration | `SqlDirectoryStoreTests.cs` | YES — new test cases for cascade |

### Integration Points

**Internal dependencies (Slice 3 scope):**
- `SqlDirectoryStore` uses `Microsoft.Data.SqlClient` (version 5.2.2, in `Harmonia.Api.csproj`) exclusively. No ORM.
- The cascade stays entirely inside `SqlDirectoryStore`; it does not call `SqlNotificationStore` or any `INotificationStore` method.
- `IDirectoryStore` is injected into both use-case classes; no change to injection configuration.

**External services:**
- `Azure.Communication.Email` and `WebPush` packages are present in `Harmonia.Api.csproj` but are used by the notification dispatcher, not by the erasure path. No impact on Slice 3.
- SQL Server (real instance, not in-memory) is mandatory for integration tests per ADR-0002 and the CI pipeline configuration in `.github/workflows/ci.yml` (SQL Server 2022 in Docker, port 1433, env var `HARMONIA_SQL_CONNSTR`).

### Patterns and Conventions

**ADO.NET connection pattern (all existing adapters):**
```
await using var conn = new SqlConnection(connectionString);
await conn.OpenAsync(ct);
await using var cmd = conn.CreateCommand();
cmd.CommandText = "...";
cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
var rows = await cmd.ExecuteNonQueryAsync(ct);
```
No transactions exist anywhere in the current codebase (`SqlTransaction` / `BeginTransaction` grep returns zero matches). Slice 3 introduces the first transaction. The pattern to follow is: open connection, call `conn.BeginTransactionAsync(ct)`, attach transaction to each command via `cmd.Transaction = tx`, commit on success, rely on `await using` / `Dispose` for implicit rollback on exception.

**Result dispatch pattern:** Rowcount from the final DELETE (HouseholdContacts) drives the result (`0` → `NotFound`, `>0` → `Ok`). Cascade DELETEs on the other two tables affect rows independently and do not drive the result.

**Exception handling convention:** `catch (OperationCanceledException) { throw; }` then `catch (Exception) { return new EraseContactResult.Failed(); }`. This must be preserved; the transaction will roll back automatically when the connection is disposed on exception.

**Idempotency:** `EraseMyContactEndpoint` returns 204 on both `Ok` and `NotFound` (idempotent Art. 17). The cascade DELETEs on `PushSubscriptions` and `NotificationHistory` are safe to execute even if those rows do not exist (`DELETE WHERE` with no matching rows is a no-op, not an error). No idempotency guard is needed for the cascade.

**R3 enforcement pattern:** XML doc on `DeleteContactAsync` already states the constraint. No logging of `householdRef.Value` or any subscription fields anywhere in the erasure path. Tests verify this via `CapturingLogger` / `DirectoryLogExclusionTests` pattern established in Slice 1.

**Deletion order within transaction (recommended):**
1. `DELETE FROM dbo.NotificationHistory WHERE HouseholdRef = @HouseholdRef` (no FK; may delete 0–N rows)
2. `DELETE FROM dbo.PushSubscriptions WHERE HouseholdRef = @HouseholdRef` (PK = HouseholdRef; may delete 0–1 rows)
3. `DELETE FROM dbo.HouseholdContacts WHERE HouseholdRef = @HouseholdRef` (PK = HouseholdRef; rowcount drives result)

---

## 3. Documentation Findings

### Guides and Architecture Docs

- `docs/architecture/decisions/ADR-0001.md` — Identity and Session Trust Root. R2 constraint (HouseholdRef always from session on resident path) and R3 constraint (no PII in logs) are load-bearing invariants documented here. Both apply to Slice 3.
- `docs/architecture/decisions/ADR-0002.md` — Reservation Store. Establishes SQL Server with atomic writes and the rule that all integration/concurrency tests must run against real SQL Server (never in-memory).
- `docs/architecture/decisions/ADR-0003.md` — Microsoft Entra External ID. Closes the identity provider gap. Defines custom claims `extension_householdRef` and `extension_role`. Explains why admin accounts have a null `HouseholdRef` claim.
- `docs/architecture/decisions/ADR-0004.md` — HouseholdContacts Retention and Departure Marker. Establishes the 1-year retention period post-`DepartedAt`, the purge sweep, and ordinal-safety rules for SELECT statements.
- `docs/context/stack.md` — stack, build/test commands, R1/R2/R3 constraints. Primary reference for implementation.
- `docs/context/standards/code-quality.md` — warnings as errors, nullable enabled, parameterised SQL only, XML doc on all public members, no PII in logs.
- `docs/context/standards/git-workflow.md` — `feat/<slug>` branch, imperative commit messages ~72 cols, squash-merge via PR, CI must be green before merge.
- Prior slice task files exist under `docs/superpowers/tasks/` and confirm Slice 1 established the erasure pipeline and Slice 2 added departure/retention.

### Architectural Decisions

- **R2:** HouseholdRef for resident erasure comes exclusively from the verified session token. Never accepted from request body, query string, or header. Enforced in `EraseMyContact.cs`.
- **R3:** `householdRef.Value`, `Endpoint`, `P256dhKey`, `AuthKey`, and `FallbackEmail` must never be passed to `ILogger`. Verified by `CapturingLogger`-based log-exclusion tests.
- **ADR-0002 real-SQL mandate:** Concurrency tests and integration tests must use real SQL Server. The `HARMONIA_SQL_CONNSTR` environment variable is the only mechanism; no in-memory fallback permitted.
- **No FK cascade in schema:** All cascading is application-enforced. The database does not automatically delete related rows. This is intentional and must be preserved.
- **No ORM:** All SQL is hand-written via raw ADO.NET. No Entity Framework, Dapper, or other abstraction layer.

### Derived Conventions

- All adapter methods follow the `await using var conn / cmd` pattern with `AddWithValue` for parameters.
- Rowcount from the primary table's DELETE determines the result discriminant.
- Cascade DELETEs on ancillary tables execute first; the primary table DELETE executes last so its rowcount is unambiguous.
- No logging whatsoever in adapter methods for the erasure domain.

---

## 4. Testing Landscape

### Existing Coverage

**Unit tests:**
- `tests/Harmonia.UnitTests/Application/EraseMyContactTests.cs` — covers null session, non-resident session, happy path (Ok), not-found (NotFound), store failure (Failed), and R2 verification (HouseholdRef from session only, not URL).
- `tests/Harmonia.UnitTests/Application/EraseContactTests.cs` — covers null session, non-admin session, happy path, not-found, and store failure.
- `tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs` — covers HTTP result mapping for both erase endpoints (204 on Ok/NotFound for resident, 204/404/403 for board, 500 on Failed).
- `tests/Harmonia.UnitTests/Fakes.cs` — `FakeDirectoryStore.DeleteContactAsync` removes from in-memory `List<HouseholdContact>` and returns `Ok`/`NotFound`. `FailingDirectoryStore` returns `Failed`. `FakeNotificationStore` exists with in-memory Dictionary/List backing; it does not currently simulate cascade deletion.

**Integration tests:**
- `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs` — three existing tests for `DeleteContactAsync`: existing row returns `Ok` and row is gone, nonexistent row returns `NotFound`, does not affect other rows. None verify cascade to notification tables.
- `tests/Harmonia.IntegrationTests/SqlNotificationStoreTests.cs` — covers save/remove subscription, append/get history. No cross-table erasure tests.
- `tests/Harmonia.IntegrationTests/SqlServerFixture.cs` — `IAsyncLifetime` fixture; reads `db/schema.sql` from `AppContext.BaseDirectory` and provisions test database `ReserveBbqTests` against a real SQL Server. Unique `HouseholdRef` values (GUID-suffixed) used per test for isolation.
- `tests/Harmonia.IntegrationTests/DatabaseCollection.cs` — xUnit `[Collection("Database")]` groups all integration tests onto one shared fixture instance.

**R3 log-exclusion tests:**
- `tests/Harmonia.UnitTests/` contains `DirectoryLogExclusionTests.cs` (established in Slice 1) and `MarkDepartedEndpointLogTests.cs` (added in Slice 2), both using the `CapturingLogger` pattern to assert that `householdRef` never appears in log output across all result variants.

### Testing Framework and Patterns

- **Framework:** xUnit with `[Fact]` attributes and `[Collection("Database")]` for integration tests sharing the SQL Server fixture.
- **Real SQL Server:** Mandatory per ADR-0002. Connection string from `HARMONIA_SQL_CONNSTR` env var; CI wires this to a Docker SQL Server 2022 container.
- **Test data:** Each test creates unique `HouseholdRef` values (`new HouseholdRef($"HH-{prefix}-{Guid.NewGuid():N}")`) to prevent cross-test collision. Data is not rolled back between tests; uniqueness guarantees isolation.
- **Unit test doubles:** `FakeDirectoryStore` and `FakeNotificationStore` are in-memory implementations in `Fakes.cs`. They expose public backing collections for direct assertion in Arrange/Assert phases.
- **Direct SQL in tests:** One precedent exists (`PurgeExpired` test) where raw SQL is used to back-date a timestamp for Arrange setup. This pattern is acceptable for Slice 3 integration tests that need to seed notification history.

### Coverage Gaps

The following areas have no existing tests and must be covered by Slice 3:

1. **Cascade integration test (primary gap):** No test verifies that calling `DeleteContactAsync` deletes rows from both `dbo.PushSubscriptions` and `dbo.NotificationHistory`. Required: one integration test that seeds all three tables for a household, calls `DeleteContactAsync`, and then asserts all three tables have no rows for that `HouseholdRef`.

2. **Isolation of cascade (secondary gap):** No test verifies that a household whose contact is erased does not affect another household's push subscription or notification history. Required: extend the existing "does not affect other rows" pattern to cover notification tables.

3. **Cascade when ancillary rows absent:** No test confirms that erasing a contact with no push subscription or notification history still returns `Ok` (i.e., the cascade DELETEs are no-ops without error).

4. **R3 log-exclusion for cascade:** No test verifies that subscription fields (`Endpoint`, `P256dhKey`, `AuthKey`, `FallbackEmail`) never appear in log output during an erasure. Should follow the `CapturingLogger` pattern from `DirectoryLogExclusionTests.cs`.

5. **FakeDirectoryStore cascade simulation:** `FakeDirectoryStore.DeleteContactAsync` in `Fakes.cs` does not simulate cascade. Unit tests for use cases do not exercise cascade because fakes do not share state with `FakeNotificationStore`. If the task spec is correct that the cascade is entirely inside the SQL adapter (not in the use-case layer), then the fakes and unit tests require no changes — the cascade is untestable at the unit level by design.

---

## 5. Configuration and Environment

### Environment Variables

- `HARMONIA_SQL_CONNSTR` — connection string for the real SQL Server used by integration tests. Mandatory; no fallback. Set in CI via `.github/workflows/ci.yml` (Docker SQL Server 2022). Never committed to the repo.

### Configuration Files

- `src/Harmonia.Api/appsettings.json` — defines six `ConnectionStrings` keys as placeholders: `Reservations`, `MaintenanceFees`, `Expenses`, `Payments`, `Notifications`, `Directory`. All must be non-empty at startup or the app throws.
- `src/Harmonia.Api/appsettings.Development.json` — logging configuration only; does not contain connection strings.
- `src/Harmonia.Api/appsettings.Development.local.json` — git-ignored; holds actual dev connection strings.
- `db/schema.sql` — authoritative schema definition. Applied by `SqlServerFixture` to the test database on every integration test run. Contains all three tables in scope (`dbo.HouseholdContacts`, `dbo.PushSubscriptions`, `dbo.NotificationHistory`). No schema changes are required for Slice 3.

### Feature Flags and Deployment Concerns

- **No feature flag infrastructure exists.** Grep for "Feature", "Flag", "Toggle" in the erasure domain returns zero results. The cascade will be live on deploy with no toggle mechanism.
- **Connection string separation concern:** `ConnectionStrings:Directory` and `ConnectionStrings:Notifications` are separately configured. If both point to the same SQL Server database instance, a standard `SqlTransaction` within `DeleteContactAsync` (which uses only the Directory connection string) can cover all three DELETEs because all three tables (`dbo.HouseholdContacts`, `dbo.PushSubscriptions`, `dbo.NotificationHistory`) reside in the same database. If the two connection strings point to different databases or instances, a cross-database distributed transaction would be needed — a significantly higher complexity. This must be confirmed before implementation. All schema evidence reviewed (`db/schema.sql`) shows all three tables in the same schema with no database qualifier prefix, consistent with a single-database assumption.
- **CI pipeline:** `.github/workflows/ci.yml` runs xUnit tests including Rel-tier integration tests against a real SQL Server 2022 Docker container. No changes to CI are needed; the existing pipeline will exercise new tests automatically.

---

## 6. Risk Indicators

- **Connection string ambiguity:** `ConnectionStrings:Directory` and `ConnectionStrings:Notifications` are separately configured. If they target different SQL Server databases, a single `SqlTransaction` cannot span them. This would require a distributed transaction (MSDTC or `System.Transactions.TransactionScope` with DTC), which is a significant architectural addition. Confirm both strings resolve to the same database before writing the adapter.

- **No existing transaction pattern:** Zero `SqlTransaction` / `BeginTransaction` usages exist across all adapters in `src/`. Slice 3 introduces the first multi-statement transaction in the codebase. The implementation must follow `BeginTransactionAsync`, attach `cmd.Transaction = tx` to each command, and commit explicitly. Implicit rollback on `await using` dispose handles failure cases — but the pattern is novel and must be reviewed carefully.

- **FakeDirectoryStore does not simulate cascade:** If unit tests for `EraseMyContact` or `EraseContact` are expected to assert cascade behavior, the fake must be extended. However, if the cascade is purely inside the SQL adapter (as the task spec states), the fakes and unit tests are correctly scoped and this is not a bug — it is an intentional layering decision.

- **R3 surface area expands:** The cascade touches `Endpoint`, `P256dhKey`, `AuthKey`, and `FallbackEmail` (all personal data, all in `dbo.PushSubscriptions`). These fields are not read during the DELETE, so they never appear in C# scope. However, log-exclusion tests should be extended or created to confirm that no exception message or stack trace inadvertently exposes these values.

- **No foreign key constraints in schema:** Cascading is entirely application-enforced. If a future schema migration adds FK constraints without `ON DELETE CASCADE`, the transaction DELETE order would need to match the FK dependency order. Currently safe, but should be noted in code comments.

- **NotificationHistory Title column:** `Title nvarchar(256) NOT NULL` may contain personal data (notification content referencing the resident). The task spec includes this table in the erasure scope, which is the correct DSAR-complete approach.

- **Deletion order matters for auditability (not for correctness):** With no FKs, any DELETE order works. The recommended order (NotificationHistory → PushSubscriptions → HouseholdContacts) ensures the contact row is the last to be deleted, making the rowcount-based result deterministic and the audit trail clear.

- **No test for concurrent erase operations:** The existing concurrency gate (R1) covers the reservation/booking path. No concurrency test exists for simultaneous erase calls on the same `HouseholdRef`. For erasure this is a lower risk than R1 (double-booking), but a note should be recorded.

- **`db/schema.sql` is applied to test database at fixture init:** Any schema change would require restarting the test fixture. Since Slice 3 requires no schema changes, this is not a concern for this slice but should be noted for future reference.

---

## 7. Summary for Complexity Assessment

Slice 3 is a narrowly-scoped adapter-only change. The entire implementation surface is a single method: `SqlDirectoryStore.DeleteContactAsync` in `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`. The endpoint, use-case, interface, domain, and DI layers require zero changes. The schema requires zero changes. Two SQL DELETE statements are added (NotificationHistory and PushSubscriptions) and the method body is wrapped in a `SqlTransaction` to achieve atomicity. Estimated file changes: one production file (`SqlDirectoryStore.cs`), one integration test file (`SqlDirectoryStoreTests.cs`), and optionally one log-exclusion test file. Total code delta is small — approximately 20–30 lines of production code added or modified.

The task follows an established pattern (raw ADO.NET DELETE, parameterised `@HouseholdRef`, exception → `Failed` result), with one novel element: this is the first use of `SqlTransaction` in the codebase. That novelty is low-risk technically (standard ADO.NET `BeginTransactionAsync` / `CommitAsync` / implicit rollback on dispose) but requires careful review because the pattern has no prior precedent in this repo. The primary architectural risk is the connection string ambiguity: both `Directory` and `Notifications` stores must connect to the same SQL Server database for a single-connection transaction to be valid. All schema and codebase evidence is consistent with a single-database assumption, but this should be explicitly confirmed before implementation.

Test coverage posture is mixed. Unit tests for the use-case layer are complete and require no changes (the cascade is not visible at that layer). Integration tests for the SQL adapter exist for the single-table case but have no cross-table cascade coverage. Three to four new integration test cases are needed: full cascade (all three tables), cascade isolation (other households unaffected), cascade with absent ancillary rows (no-op returns Ok), and optionally R3 log-exclusion for subscription fields. These tests are straightforward to write following the existing `SqlDirectoryStoreTests.cs` patterns — seed data via adapter methods, call `DeleteContactAsync`, assert via direct SQL `SELECT COUNT(*)` or adapter read methods. The real SQL Server fixture is already configured in CI and requires no modification.