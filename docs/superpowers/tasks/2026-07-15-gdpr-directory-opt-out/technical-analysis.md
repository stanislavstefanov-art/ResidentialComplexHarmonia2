# Technical Analysis — gdpr-directory-opt-out

**Source**: in-session analysis (full implementation context available from sdlc run 20260714-1305-master)
**Branch**: feat/member-directory

## Codebase Findings

### Affected layer: Domain

**`src/Harmonia.Domain/Directory/HouseholdContact.cs`**
`readonly record struct HouseholdContact(HouseholdRef HouseholdRef, string? DisplayName, string? Phone, string? Email, string? Notes, DateTimeOffset UpdatedAt)`
Add: `bool IsOptedOut`

### Affected layer: Application

**`src/Harmonia.Application/Directory/Ports.cs`**
- `IDirectoryStore.ListAllAsync` — no signature change; `IsOptedOut` rides on `HouseholdContact`
- `IDirectoryStore.UpsertContactAsync(HouseholdRef, string? displayName, string? phone, string? email, CancellationToken)` → add `bool? isOptedOut` parameter
- Result types unchanged (`UpdateContactResult`, `UpdateNotesResult`)

**`src/Harmonia.Application/Directory/GetDirectory.cs`**
`GetDirectoryResult.ResidentView` currently projects all `HouseholdContact` rows.
Needs: filter where `!c.IsOptedOut` before building `ResidentView`.
`BoardView` is unchanged (board sees all).

**`src/Harmonia.Application/Directory/UpdateMyContact.cs`**
`ExecuteAsync(string? displayName, string? phone, string? email, CancellationToken)` → add `bool? isOptedOut`

**`src/Harmonia.Application/Directory/UpdateContact.cs`**
`ExecuteAsync(string householdRef, string? displayName, string? phone, string? email, CancellationToken)` → add `bool? isOptedOut`

### Affected layer: API

**`src/Harmonia.Api/Directory/DirectoryEndpoints.cs`**
`UpdateContactRequest(string? DisplayName, string? Phone, string? Email)` → add `bool? OptedOut`
Endpoints call `ExecuteAsync` — pass `body.OptedOut`

**`src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`**
- `ListAllAsync` SELECT: add `IsOptedOut` column; `ReadRow` reads it at ordinal 6
- `UpsertContactAsync` MERGE: add `@IsOptedOut` typed `SqlParameter(SqlDbType.Bit)` with COALESCE pattern

### Affected layer: SQL schema

**`db/schema.sql`**
`dbo.HouseholdContacts`: add `IsOptedOut BIT NOT NULL DEFAULT 0`

### Affected layer: Tests

**`tests/Harmonia.UnitTests/Fakes.cs`**
`FakeDirectoryStore.UpsertContactAsync` — add `bool? isOptedOut` parameter
`FailingDirectoryStore.UpsertContactAsync` — add `bool? isOptedOut` parameter (returns `Failed`, does not throw)

**Unit test files requiring update:**
- `GetDirectoryTests.cs` — add 2 tests: opted-out hidden in resident view, opted-out visible in board view
- `UpdateMyContactTests.cs` — update call sites to pass `isOptedOut`; add test that opt-out flag is forwarded
- `UpdateContactTests.cs` — update call sites; add forwarding test
- `DirectoryEndpointsTests.cs` — update `UpdateContactRequest` instantiations; add `OptedOut` field

**Integration test file:**
- `SqlDirectoryStoreTests.cs` — update INSERT/MERGE expectations for `IsOptedOut` column

## Risk Indicators

- **Breaking change (internal)**: `HouseholdContact` record gains a new positional member; all test construction sites must add `IsOptedOut: false`. Compile-time error surfaces all of them.
- **Breaking change (API contract)**: `UpdateContactRequest` gains an optional nullable field — backwards-compatible for callers omitting it (null = no change, per COALESCE pattern).
- **R3 compliance**: `IsOptedOut` is not PII (it is a preference flag, not contact data); safe to log if needed, though existing code logs nothing.
- **No new tables or services needed**.
- **Schema migration**: `ALTER TABLE dbo.HouseholdContacts ADD IsOptedOut BIT NOT NULL DEFAULT 0` is safe to run against existing rows (default 0 = not opted out).

## Integration Points

- `GetDirectory` use case owns the opt-out filter logic — not the store (store returns all rows).
- COALESCE(`@IsOptedOut`, `target.IsOptedOut`) in the MERGE preserves existing opt-out status when caller passes `null`.
- Board endpoints (`UpdateContact`, `UpdateNotes`) and resident endpoint (`UpdateMyContact`) both reach `UpsertContactAsync`; both gain the new parameter transparently.
