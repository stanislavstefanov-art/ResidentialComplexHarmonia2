# GDPR Erasure Slice 3 — Cascade Erasure to PushSubscriptions and NotificationHistory

**Scope:** Extend `SqlDirectoryStore.DeleteContactAsync` to delete a household's rows from
`dbo.PushSubscriptions` and `dbo.NotificationHistory` in the same SQL transaction as the
`dbo.HouseholdContacts` DELETE. No new interfaces, endpoints, use cases, domain types, or DI
registrations. No schema migration.

---

## Goal

Complete the Art. 17 DSAR erasure so that a single call to `DeleteContactAsync` atomically removes
all personal data held for a household: contact record, push subscription, and notification history.

---

## Architecture

Adapter-only change. The cascade is an implementation detail of `SqlDirectoryStore` and is not
visible to the application layer or the port contract.

- **Domain:** no change.
- **Application (ports/use cases):** no change. `IDirectoryStore.DeleteContactAsync` signature
  and `EraseContactResult` variants are unchanged.
- **Adapter:** `SqlDirectoryStore.DeleteContactAsync` wraps three DELETEs in one `SqlTransaction`.
- **API / endpoints / DI:** no change.
- **Schema:** no change. All three tables already exist in `db/schema.sql`.

---

## Implementation

### `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` — `DeleteContactAsync`

Replace the single-DELETE body with a transacted three-DELETE body:

```csharp
public async Task<EraseContactResult> DeleteContactAsync(
    HouseholdRef householdRef, CancellationToken ct = default)
{
    try
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct);

        await using var histCmd = conn.CreateCommand();
        histCmd.Transaction = tx;
        histCmd.CommandText =
            "DELETE FROM dbo.NotificationHistory WHERE HouseholdRef = @HouseholdRef;";
        histCmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        await histCmd.ExecuteNonQueryAsync(ct);

        await using var subCmd = conn.CreateCommand();
        subCmd.Transaction = tx;
        subCmd.CommandText =
            "DELETE FROM dbo.PushSubscriptions WHERE HouseholdRef = @HouseholdRef;";
        subCmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        await subCmd.ExecuteNonQueryAsync(ct);

        await using var contactCmd = conn.CreateCommand();
        contactCmd.Transaction = tx;
        contactCmd.CommandText =
            "DELETE FROM dbo.HouseholdContacts WHERE HouseholdRef = @HouseholdRef;";
        contactCmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        var rows = await contactCmd.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);

        return rows == 0
            ? new EraseContactResult.NotFound()
            : new EraseContactResult.Ok();
    }
    catch (OperationCanceledException) { throw; }
    catch (Exception) { return new EraseContactResult.Failed(); }
}
```

**Delete order:** NotificationHistory first (0–N rows, no FK), PushSubscriptions second (0–1 rows,
no FK), HouseholdContacts last (rowcount drives the result). Implicit rollback on `await using`
dispose handles failures — no explicit `RollbackAsync` needed.

**R3:** `householdRef.Value` and subscription fields are never passed to `ILogger`. No logging
anywhere in this method.

---

## Tests

### Integration tests — `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`

Four new `[Fact]` tests, all `[Trait("Category","Rel")]` in `[Collection("Database")]`:

1. **`DeleteContactAsync_cascade_deletes_subscription_and_history`**
   Seed: `UpsertContactAsync` (contact), direct SQL INSERT into `PushSubscriptions`, direct SQL
   INSERT into `NotificationHistory`. Call `DeleteContactAsync`. Assert:
   - result is `Ok`
   - `SELECT COUNT(*) FROM dbo.HouseholdContacts WHERE HouseholdRef = @ref` → 0
   - `SELECT COUNT(*) FROM dbo.PushSubscriptions WHERE HouseholdRef = @ref` → 0
   - `SELECT COUNT(*) FROM dbo.NotificationHistory WHERE HouseholdRef = @ref` → 0

2. **`DeleteContactAsync_cascade_does_not_affect_other_households`**
   Seed two households. Erase one. Assert the other household's rows remain in all three tables.

3. **`DeleteContactAsync_cascade_succeeds_when_no_subscription_or_history`**
   Seed contact only (no PushSubscriptions/NotificationHistory rows). Call `DeleteContactAsync`.
   Assert result is `Ok` and HouseholdContacts row is gone.

4. **`DeleteContactAsync_notfound_when_contact_absent_with_orphan_subscription`**
   Seed a PushSubscriptions row without a corresponding HouseholdContacts row. Call
   `DeleteContactAsync`. Assert result is `NotFound` and PushSubscriptions row is also deleted
   (transaction committed the ancillary DELETEs even though contact was absent).

   > Note: this is the correct DSAR-complete behaviour — orphan subscription data is erased even
   > when the contact row is already gone.

---

## Constraints

- R2: unchanged — `HouseholdRef` for resident erase comes from session only (enforced in use case).
- R3: `householdRef.Value`, `Endpoint`, `P256dhKey`, `AuthKey`, `FallbackEmail` never logged.
- Single-database assumption: all three tables are in the same database (`db/schema.sql`), so a
  `SqlTransaction` on the `Directory` connection string covers them all.
- `FakeDirectoryStore` does not need to change — the cascade is not visible to the application
  layer; unit tests remain correctly scoped to use-case behaviour only.
