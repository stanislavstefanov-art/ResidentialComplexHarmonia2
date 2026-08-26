using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Microsoft.Data.SqlClient;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlDirectoryStoreTests(SqlServerFixture fixture)
{
    private SqlDirectoryStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task UpsertContact_insert_creates_row_readable_by_ListAll()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");

        var result = await Store.UpsertContactAsync(hh, "Owner", "Alice Smith", "555-0100", "alice@example.com", isOptedOut: null);
        Assert.IsType<UpdateContactResult.Ok>(result);

        var all = await Store.ListAllAsync();
        var entry = all.FirstOrDefault(e => e.HouseholdRef == hh);
        Assert.NotNull(entry);
        Assert.Equal("Alice Smith", entry.DisplayName);
        Assert.Equal("555-0100", entry.Phone);
        Assert.Equal("alice@example.com", entry.Email);
        Assert.Null(entry.Notes);
    }

    [Fact]
    public async Task UpsertContact_owner_and_renter_both_visible_in_ListAll()
    {
        var hh = new HouseholdRef($"HH-DIR-ROLES-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Renter");

        await Store.UpsertContactAsync(hh, "Owner",  "Owner Name",  null, null, isOptedOut: null);
        await Store.UpsertContactAsync(hh, "Renter", "Renter Name", null, null, isOptedOut: null);

        var all = await Store.ListAllAsync();
        var entries = all.Where(e => e.HouseholdRef == hh).ToList();
        Assert.Equal(2, entries.Count);
        Assert.Contains(entries, e => e.Role == "Owner"  && e.DisplayName == "Owner Name");
        Assert.Contains(entries, e => e.Role == "Renter" && e.DisplayName == "Renter Name");
    }

    [Fact]
    public async Task Two_residents_sharing_a_role_are_both_visible_and_independently_editable()
    {
        // The actual regression this feature fixes.
        var hh   = new HouseholdRef($"HH-DIR-MULTI-{Guid.NewGuid():N}");
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid1, hh, "Owner");
        await SeedLinkAsync(oid2, hh, "Owner");

        await Store.UpsertContactByOidAsync(oid1, "Alice", "555-0001", null, isOptedOut: null);
        await Store.UpsertContactByOidAsync(oid2, "Bob",   "555-0002", null, isOptedOut: null);

        var all = await Store.ListAllAsync();
        var entries = all.Where(e => e.HouseholdRef == hh).ToList();
        Assert.Equal(2, entries.Count);
        Assert.Contains(entries, e => e.EntraObjectId == oid1 && e.DisplayName == "Alice" && e.Phone == "555-0001");
        Assert.Contains(entries, e => e.EntraObjectId == oid2 && e.DisplayName == "Bob"   && e.Phone == "555-0002");
    }

    [Fact]
    public async Task UpsertContact_by_role_on_a_shared_role_returns_Ambiguous_and_touches_neither_row()
    {
        var hh   = new HouseholdRef($"HH-DIR-AMBIG-{Guid.NewGuid():N}");
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid1, hh, "Owner");
        await SeedLinkAsync(oid2, hh, "Owner");
        await Store.UpsertContactByOidAsync(oid1, "Alice", null, null, isOptedOut: null);
        await Store.UpsertContactByOidAsync(oid2, "Bob",   null, null, isOptedOut: null);

        var result = await Store.UpsertContactAsync(hh, "Owner", "Someone Else", null, null, isOptedOut: null);

        Assert.IsType<UpdateContactResult.Ambiguous>(result);
        var all = await Store.ListAllAsync();
        Assert.Contains(all, e => e.EntraObjectId == oid1 && e.DisplayName == "Alice");
        Assert.Contains(all, e => e.EntraObjectId == oid2 && e.DisplayName == "Bob");
    }

    [Fact]
    public async Task UpsertContact_partial_update_preserves_existing_phone()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Bob", "555-0200", null, isOptedOut: null);

        await Store.UpsertContactAsync(hh, "Owner", "Robert", null, null, isOptedOut: null);

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.Equal("Robert", entry.DisplayName);
        Assert.Equal("555-0200", entry.Phone);
    }

    [Fact]
    public async Task UpsertNotes_insert_then_update_replaces_notes()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Someone", null, null, isOptedOut: null);
        await Store.UpsertNotesAsync(hh, "Parking spot A12");
        await Store.UpsertNotesAsync(hh, "Parking spot B7");

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.Equal("Parking spot B7", entry.Notes);
    }

    [Fact]
    public async Task UpsertContact_sets_IsOptedOut_and_ListAll_returns_it()
    {
        var hh = new HouseholdRef($"HH-DIR-OPT-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");

        await Store.UpsertContactAsync(hh, "Owner", "Dave", null, null, isOptedOut: true);

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.True(entry.IsOptedOut);
    }

    [Fact]
    public async Task UpsertContact_null_isOptedOut_preserves_existing_value()
    {
        var hh = new HouseholdRef($"HH-DIR-OPT-PRES-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Eve", null, null, isOptedOut: true);

        await Store.UpsertContactAsync(hh, "Owner", "Eve Updated", null, null, isOptedOut: null);

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.True(entry.IsOptedOut);
    }

    [Fact]
    public async Task ListAll_returns_rows_ordered_by_household_ref()
    {
        var prefix = $"HH-DIR-ORD-{Guid.NewGuid():N}";
        var a = new HouseholdRef($"{prefix}-A");
        var b = new HouseholdRef($"{prefix}-B");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", b, "Owner");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", a, "Owner");
        await Store.UpsertContactAsync(b, "Owner", "Zara",  null, null, isOptedOut: null);
        await Store.UpsertContactAsync(a, "Owner", "Alice", null, null, isOptedOut: null);

        var all = await Store.ListAllAsync();
        var relevant = all.Where(e => e.HouseholdRef == a || e.HouseholdRef == b).ToList();

        Assert.Equal(2, relevant.Count);
        Assert.True(string.Compare(
            relevant[0].HouseholdRef.Value,
            relevant[1].HouseholdRef.Value,
            StringComparison.Ordinal) < 0);
    }

    [Fact, Trait("Category", "Rel")]
    public async Task DeleteContact_existing_row_returns_Ok_and_row_is_gone()
    {
        var hh = new HouseholdRef($"HH-DEL-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Dave", null, null, isOptedOut: null);

        var result = await Store.DeleteContactAsync(hh, "Owner");

        Assert.IsType<EraseContactResult.Ok>(result);
        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.HouseholdRef == hh);
    }

    [Fact, Trait("Category", "Rel")]
    public async Task DeleteContact_nonexistent_row_returns_NotFound()
    {
        var hh = new HouseholdRef($"HH-DEL-NF-{Guid.NewGuid():N}");

        var result = await Store.DeleteContactAsync(hh, "Owner");

        Assert.IsType<EraseContactResult.NotFound>(result);
    }

    [Fact, Trait("Category", "Rel")]
    public async Task DeleteContact_by_role_on_a_shared_role_returns_Ambiguous_and_deletes_neither()
    {
        var hh   = new HouseholdRef($"HH-DEL-AMBIG-{Guid.NewGuid():N}");
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid1, hh, "Owner");
        await SeedLinkAsync(oid2, hh, "Owner");
        await Store.UpsertContactByOidAsync(oid1, "Alice", null, null, isOptedOut: null);
        await Store.UpsertContactByOidAsync(oid2, "Bob",   null, null, isOptedOut: null);

        var result = await Store.DeleteContactAsync(hh, "Owner");

        Assert.IsType<EraseContactResult.Ambiguous>(result);
        var all = await Store.ListAllAsync();
        Assert.Equal(2, all.Count(e => e.HouseholdRef == hh));
    }

    [Fact, Trait("Category", "Rel")]
    public async Task DeleteContact_by_oid_leaves_a_co_residents_row_untouched()
    {
        var hh   = new HouseholdRef($"HH-DEL-CO-{Guid.NewGuid():N}");
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid1, hh, "Owner");
        await SeedLinkAsync(oid2, hh, "Owner");
        await Store.UpsertContactByOidAsync(oid1, "Alice", null, null, isOptedOut: null);
        await Store.UpsertContactByOidAsync(oid2, "Bob",   null, null, isOptedOut: null);

        var result = await Store.DeleteContactByOidAsync(oid1);

        Assert.IsType<EraseContactResult.Ok>(result);
        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.EntraObjectId == oid1);
        Assert.Contains(all, e => e.EntraObjectId == oid2 && e.DisplayName == "Bob");
    }

    [Fact, Trait("Category", "Rel")]
    public async Task DeleteContact_does_not_affect_other_rows()
    {
        var target = new HouseholdRef($"HH-DEL-TGT-{Guid.NewGuid():N}");
        var other  = new HouseholdRef($"HH-DEL-OTH-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", target, "Owner");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", other,  "Owner");
        await Store.UpsertContactAsync(target, "Owner", "Eve",   null, null, isOptedOut: null);
        await Store.UpsertContactAsync(other,  "Owner", "Frank", null, null, isOptedOut: null);

        await Store.DeleteContactAsync(target, "Owner");

        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.HouseholdRef == target);
        Assert.Contains(all,       e => e.HouseholdRef == other);
    }

    [Fact]
    public async Task MarkDeparted_sets_DepartedAt_and_row_appears_in_ListAll()
    {
        var hh = new HouseholdRef($"HH-DEP-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Departed Dave", null, null, isOptedOut: null);

        var result = await Store.MarkDepartedAsync(hh, "Owner");

        Assert.IsType<MarkDepartedResult.Ok>(result);
        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.NotNull(entry.DepartedAt);
    }

    [Fact]
    public async Task MarkDeparted_nonexistent_row_returns_NotFound()
    {
        var hh = new HouseholdRef($"HH-DEP-NF-{Guid.NewGuid():N}");

        var result = await Store.MarkDepartedAsync(hh, "Owner");

        Assert.IsType<MarkDepartedResult.NotFound>(result);
    }

    [Fact]
    public async Task MarkDeparted_by_role_on_a_shared_role_returns_Ambiguous()
    {
        var hh   = new HouseholdRef($"HH-DEP-AMBIG-{Guid.NewGuid():N}");
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid1, hh, "Owner");
        await SeedLinkAsync(oid2, hh, "Owner");
        await Store.UpsertContactByOidAsync(oid1, "Alice", null, null, isOptedOut: null);
        await Store.UpsertContactByOidAsync(oid2, "Bob",   null, null, isOptedOut: null);

        var result = await Store.MarkDepartedAsync(hh, "Owner");

        Assert.IsType<MarkDepartedResult.Ambiguous>(result);
        var all = await Store.ListAllAsync();
        Assert.All(all.Where(e => e.HouseholdRef == hh), e => Assert.Null(e.DepartedAt));
    }

    [Fact]
    public async Task MarkDeparted_already_departed_is_idempotent_and_preserves_original_date()
    {
        var hh = new HouseholdRef($"HH-DEP-IDEM-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Eve", null, null, isOptedOut: null);

        await Store.MarkDepartedAsync(hh, "Owner");
        var all = await Store.ListAllAsync();
        var firstDate = all.First(e => e.HouseholdRef == hh).DepartedAt;
        Assert.NotNull(firstDate);

        await Task.Delay(10);

        var result = await Store.MarkDepartedAsync(hh, "Owner");
        Assert.IsType<MarkDepartedResult.Ok>(result);
        all = await Store.ListAllAsync();
        Assert.Equal(firstDate, all.First(e => e.HouseholdRef == hh).DepartedAt);
    }

    [Fact]
    public async Task PurgeExpired_deletes_rows_past_cutoff_and_returns_count()
    {
        var hh1 = new HouseholdRef($"HH-PG-OLD-{Guid.NewGuid():N}");
        var hh2 = new HouseholdRef($"HH-PG-OLD2-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh1, "Owner");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh2, "Owner");
        await Store.UpsertContactAsync(hh1, "Owner", "Old1", null, null, isOptedOut: null);
        await Store.UpsertContactAsync(hh2, "Owner", "Old2", null, null, isOptedOut: null);

        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE dbo.HouseholdContacts
            SET DepartedAt = DATEADD(year, -2, SYSUTCDATETIME())
            WHERE HouseholdRef IN (@HH1, @HH2);
            """;
        cmd.Parameters.AddWithValue("@HH1", hh1.Value);
        cmd.Parameters.AddWithValue("@HH2", hh2.Value);
        await cmd.ExecuteNonQueryAsync();

        var result = await Store.PurgeExpiredContactsAsync();

        var ok = Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        Assert.True(ok.Deleted >= 2, $"Expected at least 2 deleted, got {ok.Deleted}");

        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.HouseholdRef == hh1);
        Assert.DoesNotContain(all, e => e.HouseholdRef == hh2);
    }

    [Fact]
    public async Task PurgeExpired_spares_rows_inside_retention_window()
    {
        var hh = new HouseholdRef($"HH-PG-RECENT-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Recent", null, null, isOptedOut: null);
        await Store.MarkDepartedAsync(hh, "Owner");

        var result = await Store.PurgeExpiredContactsAsync();

        Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        var all = await Store.ListAllAsync();
        Assert.Contains(all, e => e.HouseholdRef == hh);
    }

    [Fact]
    public async Task PurgeExpired_spares_rows_with_null_DepartedAt()
    {
        var hh = new HouseholdRef($"HH-PG-ACTIVE-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Active", null, null, isOptedOut: null);

        var result = await Store.PurgeExpiredContactsAsync();

        Assert.IsType<PurgeExpiredContactsResult.Ok>(result);
        var all = await Store.ListAllAsync();
        Assert.Contains(all, e => e.HouseholdRef == hh);
    }

    [Fact]
    public async Task DeleteContact_cascade_deletes_subscription_and_history()
    {
        var hh = new HouseholdRef($"HH-CASCADE-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Alice", null, null, isOptedOut: null);
        await SeedSubscriptionAsync(hh);
        await SeedHistoryAsync(hh);

        var result = await Store.DeleteContactAsync(hh, "Owner");

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
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", target, "Owner");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", other,  "Owner");
        await Store.UpsertContactAsync(target, "Owner", "Target", null, null, isOptedOut: null);
        await Store.UpsertContactAsync(other,  "Owner", "Other",  null, null, isOptedOut: null);
        await SeedSubscriptionAsync(target);
        await SeedSubscriptionAsync(other);
        await SeedHistoryAsync(target);
        await SeedHistoryAsync(other);

        await Store.DeleteContactAsync(target, "Owner");

        Assert.Equal(0, await CountAsync("HouseholdContacts",   target));
        Assert.Equal(0, await CountAsync("PushSubscriptions",   target));
        Assert.Equal(0, await CountAsync("NotificationHistory", target));
        Assert.Equal(1, await CountAsync("HouseholdContacts",   other));
        Assert.Equal(1, await CountAsync("PushSubscriptions",   other));
        Assert.Equal(1, await CountAsync("NotificationHistory", other));
    }

    [Fact]
    public async Task DeleteContact_cascade_survives_when_a_co_resident_remains()
    {
        // The regression this feature fixes: PushSubscriptions/NotificationHistory are
        // household-level, shared infrastructure. One resident's erasure must not delete a
        // co-resident's still-in-use subscription/history.
        var hh   = new HouseholdRef($"HH-CASCADE-SHARED-{Guid.NewGuid():N}");
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid1, hh, "Owner");
        await SeedLinkAsync(oid2, hh, "Renter");
        await Store.UpsertContactByOidAsync(oid1, "Alice", null, null, isOptedOut: null);
        await Store.UpsertContactByOidAsync(oid2, "Bob",   null, null, isOptedOut: null);
        await SeedSubscriptionAsync(hh);
        await SeedHistoryAsync(hh);

        var result = await Store.DeleteContactByOidAsync(oid1);

        Assert.IsType<EraseContactResult.Ok>(result);
        Assert.Equal(1, await CountAsync("HouseholdContacts",   hh)); // Bob's row survives
        Assert.Equal(1, await CountAsync("PushSubscriptions",   hh)); // shared, survives
        Assert.Equal(1, await CountAsync("NotificationHistory", hh)); // shared, survives
    }

    [Fact]
    public async Task DeleteContact_cascade_succeeds_when_no_subscription_or_history()
    {
        var hh = new HouseholdRef($"HH-CASCADE-NOANCIL-{Guid.NewGuid():N}");
        await SeedLinkAsync($"oid-{Guid.NewGuid():N}", hh, "Owner");
        await Store.UpsertContactAsync(hh, "Owner", "Bob", null, null, isOptedOut: null);

        var result = await Store.DeleteContactAsync(hh, "Owner");

        Assert.IsType<EraseContactResult.Ok>(result);
        Assert.Equal(0, await CountAsync("HouseholdContacts", hh));
    }

    [Fact]
    public async Task DeleteContact_with_no_matching_link_at_all_returns_NotFound()
    {
        // No HouseholdLinks row exists for this household+role at all — genuinely nothing
        // to resolve, unlike the erased-but-still-linked recovery case covered elsewhere.
        var hh = new HouseholdRef($"HH-CASCADE-NOLINK-{Guid.NewGuid():N}");

        var result = await Store.DeleteContactAsync(hh, "Owner");

        Assert.IsType<EraseContactResult.NotFound>(result);
    }

    private async Task<int> CountAsync(string table, HouseholdRef hh)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT COUNT(*) FROM dbo.{table} WHERE HouseholdRef = @HouseholdRef;";
        cmd.Parameters.AddWithValue("@HouseholdRef", hh.Value);
        return (int)(await cmd.ExecuteScalarAsync())!;
    }

    private async Task SeedLinkAsync(string oid, HouseholdRef hh, string role)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, Role, LinkedAt) " +
            "VALUES (@Oid, @HH, @Role, SYSUTCDATETIME());";
        cmd.Parameters.AddWithValue("@Oid",  oid);
        cmd.Parameters.AddWithValue("@HH",   hh.Value);
        cmd.Parameters.AddWithValue("@Role", role);
        await cmd.ExecuteNonQueryAsync();
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
                 SYSUTCDATETIME(), SYSUTCDATETIME());
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
            VALUES (@Id, @HouseholdRef, @Title, SYSUTCDATETIME(), @Channel);
            """;
        cmd.Parameters.AddWithValue("@Id",           Guid.NewGuid());
        cmd.Parameters.AddWithValue("@HouseholdRef", hh.Value);
        cmd.Parameters.AddWithValue("@Title",        "Test notification");
        cmd.Parameters.AddWithValue("@Channel",      "push");
        await cmd.ExecuteNonQueryAsync();
    }
}
