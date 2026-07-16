# GDPR Erasure Slice 3 — Cascade Erasure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `SqlDirectoryStore.DeleteContactAsync` to atomically delete a household's push subscription and notification history rows in the same SQL transaction as the contact record deletion.

**Architecture:** Adapter-only change — one method in one file. No interface, use-case, endpoint, domain, or DI changes. The cascade is invisible to the application layer; use-case unit tests and fakes require no changes. Integration tests in `SqlDirectoryStoreTests.cs` are the only new test surface.

**Tech Stack:** .NET 8, C#, xUnit, Microsoft.Data.SqlClient (ADO.NET), SQL Server 2022.

---

## File Map

| File | Change |
|---|---|
| `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` | Modify `DeleteContactAsync` (lines 103–121): wrap in `SqlTransaction`, add two extra DELETEs |
| `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs` | Add 4 integration tests + 3 private helper methods |

No other files change.

---

### Task 1: Write failing integration tests for cascade

**Test-first:** yes — tests fail because `DeleteContactAsync` still only deletes from `HouseholdContacts`; subscription and history rows survive.

**Files:**
- Modify: `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`

- [ ] **Step 1: Add three private helper methods to `SqlDirectoryStoreTests`**

  Open `tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs`. Append these three private helpers inside the class body, before the closing brace:

  ```csharp
  private async Task<int> CountAsync(string table, HouseholdRef hh)
  {
      await using var conn = new SqlConnection(fixture.ConnectionString);
      await conn.OpenAsync();
      await using var cmd = conn.CreateCommand();
      cmd.CommandText = $"SELECT COUNT(*) FROM dbo.{table} WHERE HouseholdRef = @HouseholdRef;";
      cmd.Parameters.AddWithValue("@HouseholdRef", hh.Value);
      return (int)(await cmd.ExecuteScalarAsync())!;
  }

  private async Task SeedSubscriptionAsync(HouseholdRef hh)
  {
      await using var conn = new SqlConnection(fixture.ConnectionString);
      await conn.OpenAsync();
      await using var cmd = conn.CreateCommand();
      cmd.CommandText = """
          INSERT INTO dbo.PushSubscriptions
              (HouseholdRef, Endpoint, P256dhKey, AuthKey, CreatedAt, UpdatedAt)
          VALUES
              (@HouseholdRef, @Endpoint, @P256dhKey, @AuthKey,
               SYSUTCDATETIMEOFFSET(), SYSUTCDATETIMEOFFSET());
          """;
      cmd.Parameters.AddWithValue("@HouseholdRef", hh.Value);
      cmd.Parameters.AddWithValue("@Endpoint",     "https://push.example.com/test");
      cmd.Parameters.AddWithValue("@P256dhKey",    "test-key-p256dh");
      cmd.Parameters.AddWithValue("@AuthKey",      "test-key-auth");
      await cmd.ExecuteNonQueryAsync();
  }

  private async Task SeedHistoryAsync(HouseholdRef hh)
  {
      await using var conn = new SqlConnection(fixture.ConnectionString);
      await conn.OpenAsync();
      await using var cmd = conn.CreateCommand();
      cmd.CommandText = """
          INSERT INTO dbo.NotificationHistory (Id, HouseholdRef, Title, SentAt, Channel)
          VALUES (@Id, @HouseholdRef, @Title, SYSUTCDATETIMEOFFSET(), @Channel);
          """;
      cmd.Parameters.AddWithValue("@Id",           Guid.NewGuid());
      cmd.Parameters.AddWithValue("@HouseholdRef", hh.Value);
      cmd.Parameters.AddWithValue("@Title",        "Test notification");
      cmd.Parameters.AddWithValue("@Channel",      "push");
      await cmd.ExecuteNonQueryAsync();
  }
  ```

- [ ] **Step 2: Add the four cascade tests**

  Append the four tests inside the same class:

  ```csharp
  [Fact]
  public async Task DeleteContact_cascade_deletes_subscription_and_history()
  {
      var hh = new HouseholdRef($"HH-CASCADE-{Guid.NewGuid():N}");
      await Store.UpsertContactAsync(hh, "Alice", null, null, isOptedOut: null);
      await SeedSubscriptionAsync(hh);
      await SeedHistoryAsync(hh);

      var result = await Store.DeleteContactAsync(hh);

      Assert.IsType<EraseContactResult.Ok>(result);
      Assert.Equal(0, await CountAsync("HouseholdContacts",   hh));
      Assert.Equal(0, await CountAsync("PushSubscriptions",   hh));
      Assert.Equal(0, await CountAsync("NotificationHistory", hh));
  }

  [Fact]
  public async Task DeleteContact_cascade_does_not_affect_other_households()
  {
      var target = new HouseholdRef($"HH-CASCADE-TGT-{Guid.NewGuid():N}");
      var other  = new HouseholdRef($"HH-CASCADE-OTH-{Guid.NewGuid():N}");
      await Store.UpsertContactAsync(target, "Target", null, null, isOptedOut: null);
      await Store.UpsertContactAsync(other,  "Other",  null, null, isOptedOut: null);
      await SeedSubscriptionAsync(target);
      await SeedSubscriptionAsync(other);
      await SeedHistoryAsync(target);
      await SeedHistoryAsync(other);

      await Store.DeleteContactAsync(target);

      Assert.Equal(0, await CountAsync("HouseholdContacts",   target));
      Assert.Equal(0, await CountAsync("PushSubscriptions",   target));
      Assert.Equal(0, await CountAsync("NotificationHistory", target));
      Assert.Equal(1, await CountAsync("HouseholdContacts",   other));
      Assert.Equal(1, await CountAsync("PushSubscriptions",   other));
      Assert.Equal(1, await CountAsync("NotificationHistory", other));
  }

  [Fact]
  public async Task DeleteContact_cascade_succeeds_when_no_subscription_or_history()
  {
      var hh = new HouseholdRef($"HH-CASCADE-NOANCIL-{Guid.NewGuid():N}");
      await Store.UpsertContactAsync(hh, "Bob", null, null, isOptedOut: null);

      var result = await Store.DeleteContactAsync(hh);

      Assert.IsType<EraseContactResult.Ok>(result);
      Assert.Equal(0, await CountAsync("HouseholdContacts", hh));
  }

  [Fact]
  public async Task DeleteContact_notfound_with_orphan_rows_still_erases_ancillary_data()
  {
      var hh = new HouseholdRef($"HH-CASCADE-ORPHAN-{Guid.NewGuid():N}");
      // Seed subscription and history only — no contact row
      await SeedSubscriptionAsync(hh);
      await SeedHistoryAsync(hh);

      var result = await Store.DeleteContactAsync(hh);

      Assert.IsType<EraseContactResult.NotFound>(result);
      Assert.Equal(0, await CountAsync("PushSubscriptions",   hh));
      Assert.Equal(0, await CountAsync("NotificationHistory", hh));
  }
  ```

- [ ] **Step 3: Verify RED — tests compile but the cascade tests fail at runtime**

  Run (requires `HARMONIA_SQL_CONNSTR` set in your terminal):
  ```
  dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel&FullyQualifiedName~cascade" -v n
  ```

  Expected: `DeleteContact_cascade_deletes_subscription_and_history` and
  `DeleteContact_cascade_does_not_affect_other_households` FAIL because subscription/history rows
  are not deleted. `DeleteContact_cascade_succeeds_when_no_subscription_or_history` passes (no
  ancillary rows to check). `DeleteContact_notfound_with_orphan_rows_still_erases_ancillary_data`
  FAILS because orphan rows remain.

  Also verify unit tests still compile and pass:
  ```
  dotnet test tests/Harmonia.UnitTests -c Release --nologo -v q
  ```
  Expected: 254 tests PASS.

---

### Task 2: Implement cascade transaction in `DeleteContactAsync`

**Test-first:** yes (tests written in Task 1).

**Files:**
- Modify: `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs` lines 103–121

- [ ] **Step 1: Replace `DeleteContactAsync` body**

  In `src/Harmonia.Api/Adapters/SqlDirectoryStore.cs`, replace the entire `DeleteContactAsync`
  method (lines 103–121) with:

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

  **Why this order:** NotificationHistory first (0–N rows, no FK dependency), PushSubscriptions
  second (0–1 rows, no FK dependency), HouseholdContacts last (its rowcount drives the result
  discriminant). Implicit rollback on `await using` dispose handles all exception paths.

- [ ] **Step 2: Build**

  ```
  dotnet build src/Harmonia.Api/Harmonia.Api.csproj -c Release --nologo -v q
  ```
  Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

- [ ] **Step 3: Unit tests GREEN**

  ```
  dotnet test tests/Harmonia.UnitTests -c Release --nologo -v q
  ```
  Expected: 254 tests PASS.

- [ ] **Step 4: Integration tests GREEN (run in your terminal with `HARMONIA_SQL_CONNSTR` set)**

  ```
  dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel&FullyQualifiedName~cascade" -v n
  ```
  Expected: all 4 cascade tests PASS.

  Also run all existing erasure integration tests to confirm no regressions:
  ```
  dotnet test tests/Harmonia.IntegrationTests --filter "Category=Rel&FullyQualifiedName~DeleteContact" -v n
  ```
  Expected: all 7 DeleteContact tests PASS (3 pre-existing + 4 new).

- [ ] **Step 5: Commit**

  ```
  git add src/Harmonia.Api/Adapters/SqlDirectoryStore.cs \
          tests/Harmonia.IntegrationTests/SqlDirectoryStoreTests.cs
  git commit -m "feat: cascade DeleteContactAsync to erase PushSubscriptions and NotificationHistory (GDPR Art. 17 Slice 3)"
  ```
