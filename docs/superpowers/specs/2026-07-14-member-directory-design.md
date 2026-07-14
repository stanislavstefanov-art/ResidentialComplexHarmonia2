# Member Directory — Phase 3, Slice A — Design

## Goal

Allow residents to see who lives in each apartment (name only) and self-update their own contact details. Allow board members to see full contact details (phone, email) and operational notes, and to manage those fields on behalf of any apartment.

---

## 1 Data Model

### SQL table: `dbo.HouseholdContacts`

```sql
IF OBJECT_ID(N'dbo.HouseholdContacts', N'U') IS NULL
CREATE TABLE dbo.HouseholdContacts
(
    HouseholdRef  nvarchar(128)     NOT NULL,
    DisplayName   nvarchar(256)     NULL,
    Phone         nvarchar(32)      NULL,
    Email         nvarchar(320)     NULL,
    Notes         nvarchar(2048)    NULL,
    UpdatedAt     datetimeoffset(3) NOT NULL,
    CONSTRAINT PK_HouseholdContacts PRIMARY KEY (HouseholdRef)
);
```

- `HouseholdRef` — PK, matches the value in other tables and in the JWT claim.
- `DisplayName` — occupant name; visible to all authenticated users.
- `Phone`, `Email` — PII (R3); board-only in responses; never logged.
- `Notes` — operational notes (e.g., parking spot, access code); board-only.
- `UpdatedAt` — server-stamped on every upsert.

**Upsert semantics:** SQL MERGE on `HouseholdRef`. All columns (`DisplayName`, `Phone`, `Email`, `Notes`) use `COALESCE(incoming, existing)` so a partial update leaves unspecified fields unchanged. `UpdatedAt` is always set to `SYSUTCDATETIMEOFFSET()` on any upsert.

**Populate model:** The directory is populated on first use. The board seeds apartments via `PUT /directory/{householdRef}/contact` before residents self-serve. `GET /directory` returns all rows present in the table.

---

## 2 Domain Layer

**File:** `src/Harmonia.Domain/Directory/HouseholdContact.cs`

```csharp
namespace Harmonia.Domain.Directory;

public sealed record HouseholdContact(
    HouseholdRef HouseholdRef,
    string?      DisplayName,
    string?      Phone,
    string?      Email,
    string?      Notes,
    DateTimeOffset UpdatedAt);
```

No business logic; pure data carrier. `Phone`, `Email` are nullable because a record may be created without contact details.

---

## 3 Application Layer

**File:** `src/Harmonia.Application/Directory/Ports.cs`

### Result types

```csharp
// GetDirectory
public abstract record GetDirectoryResult
{
    private GetDirectoryResult() { }
    public sealed record Refused                                              : GetDirectoryResult;
    public sealed record ResidentView(IReadOnlyList<HouseholdContact> Entries) : GetDirectoryResult;
    public sealed record BoardView(IReadOnlyList<HouseholdContact> Entries)    : GetDirectoryResult;
    public sealed record Failed                                               : GetDirectoryResult;
}

// UpdateContact (used for both resident self-update and board update)
public abstract record UpdateContactResult
{
    private UpdateContactResult() { }
    public sealed record Refused  : UpdateContactResult;
    public sealed record Ok       : UpdateContactResult;
    public sealed record Failed   : UpdateContactResult;
}

// UpdateNotes (board only)
public abstract record UpdateNotesResult
{
    private UpdateNotesResult() { }
    public sealed record Refused  : UpdateNotesResult;
    public sealed record Ok       : UpdateNotesResult;
    public sealed record Failed   : UpdateNotesResult;
}
```

### Port

```csharp
public interface IDirectoryStore
{
    Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default);

    Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef,
        string?      displayName,
        string?      phone,
        string?      email,
        CancellationToken ct = default);

    Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef,
        string?      notes,
        CancellationToken ct = default);
}
```

### Use cases

**`GetDirectory`** (`src/Harmonia.Application/Directory/GetDirectory.cs`)

```csharp
public sealed class GetDirectory(ISession session, IDirectoryStore store)
{
    public async Task<GetDirectoryResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is null) return new GetDirectoryResult.Refused();

        var entries = await store.ListAllAsync(ct);

        if (ctx.IsAdmin)
            return new GetDirectoryResult.BoardView(entries);

        if (ctx.IsResident)
            return new GetDirectoryResult.ResidentView(entries);

        return new GetDirectoryResult.Refused();
    }
}
```

The endpoint strips `Phone`, `Email`, `Notes` from the resident view DTO — not the use case — keeping domain objects whole. The use case signals *which view* via the result type; the endpoint decides the DTO shape.

**`UpdateMyContact`** (`src/Harmonia.Application/Directory/UpdateMyContact.cs`)

- Session must be resident with a non-null `HouseholdRef` (R2: ref comes from `session.Resolve()`).
- Non-resident or non-resident-with-ref → `Refused`.
- Calls `store.UpsertContactAsync(ctx.HouseholdRef, displayName, phone, email, ct)`.

**`UpdateContact`** (`src/Harmonia.Application/Directory/UpdateContact.cs`)

- Session must be `IsAdmin`.
- `householdRef` parameter comes from the caller (URL path for board endpoint; R2 does not apply to admin operations on other households).
- Calls `store.UpsertContactAsync(new HouseholdRef(householdRef), displayName, phone, email, ct)`.

**`UpdateNotes`** (`src/Harmonia.Application/Directory/UpdateNotes.cs`)

- Session must be `IsAdmin`.
- `householdRef` from caller.
- Calls `store.UpsertNotesAsync(new HouseholdRef(householdRef), notes, ct)`.

---

## 4 API Adapter Layer

**File:** `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`  
**Namespace:** `Harmonia.Api.Reservations.Adapters` (matches all existing store adapters)

Implements `IDirectoryStore` with raw ADO.NET (`SqlConnection`, `SqlCommand`).

### `ListAllAsync`

```sql
SELECT HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt
FROM dbo.HouseholdContacts
ORDER BY HouseholdRef ASC;
```

Returns all rows. The Application layer decides which fields are exposed in the response DTO.

### `UpsertContactAsync`

SQL MERGE that inserts or updates `DisplayName`, `Phone`, `Email`, preserving existing values when incoming is NULL:

```sql
MERGE dbo.HouseholdContacts WITH (HOLDLOCK) AS target
USING (VALUES (@HouseholdRef)) AS source (HouseholdRef)
ON target.HouseholdRef = source.HouseholdRef
WHEN MATCHED THEN
    UPDATE SET
        DisplayName = COALESCE(@DisplayName, target.DisplayName),
        Phone       = COALESCE(@Phone,       target.Phone),
        Email       = COALESCE(@Email,       target.Email),
        UpdatedAt   = SYSUTCDATETIMEOFFSET()
WHEN NOT MATCHED THEN
    INSERT (HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt)
    VALUES (@HouseholdRef, @DisplayName, @Phone, @Email, NULL, SYSUTCDATETIMEOFFSET());
```

Returns `UpdateContactResult.Ok` on success, `UpdateContactResult.Failed` on exception.

### `UpsertNotesAsync`

Similar MERGE targeting only `Notes`:

```sql
MERGE dbo.HouseholdContacts WITH (HOLDLOCK) AS target
USING (VALUES (@HouseholdRef)) AS source (HouseholdRef)
ON target.HouseholdRef = source.HouseholdRef
WHEN MATCHED THEN
    UPDATE SET Notes = @Notes, UpdatedAt = SYSUTCDATETIMEOFFSET()
WHEN NOT MATCHED THEN
    INSERT (HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt)
    VALUES (@HouseholdRef, NULL, NULL, NULL, @Notes, SYSUTCDATETIMEOFFSET());
```

Returns `UpdateNotesResult.Ok` on success, `UpdateNotesResult.Failed` on exception.

**R3:** `Phone` and `Email` parameter values are never passed to `ILogger`. Error logging uses only the exception type (no PII interpolated).

---

## 5 Endpoints

**File:** `src/Harmonia.Api/Directory/DirectoryEndpoints.cs`

### DTOs

```csharp
// Resident view — no PII
public sealed record DirectoryEntryPublicDto(string HouseholdRef, string? DisplayName);

// Board view — full fields
public sealed record DirectoryEntryFullDto(
    string  HouseholdRef,
    string? DisplayName,
    string? Phone,
    string? Email,
    string? Notes,
    DateTimeOffset UpdatedAt);

// Request bodies
public sealed record UpdateContactRequest(
    string? DisplayName,
    string? Phone,
    string? Email);

public sealed record UpdateNotesRequest(string? Notes);
```

### `GET /directory`

```csharp
public static async Task<IResult> GetDirectoryEndpoint(
    GetDirectory useCase, ILogger logger, CancellationToken ct)
{
    var result = await useCase.ExecuteAsync(ct);
    return result switch
    {
        GetDirectoryResult.Refused         => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
        GetDirectoryResult.ResidentView rv => TypedResults.Json(
            rv.Entries.Select(e => new DirectoryEntryPublicDto(e.HouseholdRef.Value, e.DisplayName)).ToList(),
            statusCode: StatusCodes.Status200OK),
        GetDirectoryResult.BoardView bv    => TypedResults.Json(
            bv.Entries.Select(ToFullDto).ToList(),
            statusCode: StatusCodes.Status200OK),
        GetDirectoryResult.Failed          => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
        _                                  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
    };
}
```

### `PUT /directory/contact` (resident self-update)

Body: `UpdateContactRequest`. Uses `UpdateMyContact` use case.
- 200 OK on `Ok`
- 403 on `Refused`
- 500 on `Failed`

### `PUT /directory/{householdRef}/contact` (board)

`householdRef` from route. Body: `UpdateContactRequest`. Uses `UpdateContact` use case.
- 200 OK on `Ok`
- 403 on `Refused`
- 500 on `Failed`

### `PUT /directory/{householdRef}/notes` (board)

`householdRef` from route. Body: `UpdateNotesRequest`. Uses `UpdateNotes` use case.
- 200 OK on `Ok`
- 403 on `Refused`
- 500 on `Failed`

---

## 6 Program.cs Wiring

Add to `Program.cs`:

```csharp
var dirConnString = builder.Configuration.GetConnectionString("Directory");
if (string.IsNullOrWhiteSpace(dirConnString))
    throw new InvalidOperationException(
        "ConnectionStrings:Directory is not configured. Supply it via environment " +
        "(ConnectionStrings__Directory) or a git-ignored local config file.");

builder.Services.AddSingleton<IDirectoryStore>(new SqlDirectoryStore(dirConnString));

builder.Services.AddScoped<GetDirectory>();
builder.Services.AddScoped<UpdateMyContact>();
builder.Services.AddScoped<UpdateContact>();
builder.Services.AddScoped<UpdateNotes>();

// endpoints (in the MapXxx section)
app.MapGet("/directory", ...);
app.MapPut("/directory/contact", ...);
app.MapPut("/directory/{householdRef}/contact", ...);
app.MapPut("/directory/{householdRef}/notes", ...);
```

Connection string key: `"Directory"` (matches pattern of `"Reservations"`, `"Payments"`, `"Notifications"`).

---

## 7 Testing

### Unit tests

**`tests/Harmonia.UnitTests/Application/GetDirectoryTests.cs`**
- `null` session → `Refused`
- Resident session → `ResidentView` result
- Admin session → `BoardView` result
- Store throws → `Failed` (via `FailingDirectoryStore`)

**`tests/Harmonia.UnitTests/Application/UpdateMyContactTests.cs`**
- Resident with HouseholdRef → `Ok`
- Admin session (no HouseholdRef) → `Refused`
- `null` session → `Refused`
- Store throws → `Failed`

**`tests/Harmonia.UnitTests/Application/UpdateContactTests.cs`**
- Admin session → `Ok`
- Resident session → `Refused`
- Store throws → `Failed`

**`tests/Harmonia.UnitTests/Application/UpdateNotesTests.cs`**
- Admin session → `Ok`
- Resident session → `Refused`
- Store throws → `Failed`

**`tests/Harmonia.UnitTests/Api/DirectoryEndpointsTests.cs`**
- `ResidentView` → 200, list without Phone/Email/Notes fields
- `BoardView` → 200, list with all fields
- `Refused` → 403
- `Failed` → 500
- `UpdateMyContact.Ok` → 200; `Refused` → 403; `Failed` → 500
- `UpdateContact.Ok` → 200; `Refused` → 403; `Failed` → 500
- `UpdateNotes.Ok` → 200; `Refused` → 403; `Failed` → 500

**Fakes (`tests/Harmonia.UnitTests/Fakes.cs` additions):**
- `FakeDirectoryStore` — returns configurable results; tracks upsert calls for assertion
- `FailingDirectoryStore` — all methods throw `Exception`

### Integration tests

**`tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`**  
`[Collection("Database")]`, `[Trait("Category", "Rel")]`, real SQL Server via `HARMONIA_SQL_CONNSTR`.

- `UpsertContact_insert_then_read_returns_correct_fields`
- `UpsertContact_partial_update_preserves_existing_phone` (send `Phone = null` → existing phone unchanged)
- `UpsertNotes_insert_then_update_replaces_notes`
- `ListAll_returns_rows_ordered_by_household_ref`

---

## 8 Compliance Checkpoints

| Rule | Enforcement |
|---|---|
| R2 — resident HouseholdRef from session | `UpdateMyContact` reads `ctx.HouseholdRef` from `session.Resolve()` only; URL parameter not used for resident endpoint |
| R3 — Phone/Email never logged | `SqlDirectoryStore` logs only exception type on error; no PII in `ILogger` calls anywhere in the feature |
| Role gate for board fields | `GetDirectory` returns `ResidentView` (no PII) for residents, `BoardView` (full) for admins; enforced in Application layer |
| Role gate for notes | `UpdateNotes` checks `ctx.IsAdmin`; `Refused` returned otherwise |
| Board contact update via path | `UpdateContact` accepts `householdRef` from URL; R2 does not restrict admin operations on other households |
