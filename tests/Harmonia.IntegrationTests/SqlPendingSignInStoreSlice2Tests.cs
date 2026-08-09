using Harmonia.Api.Adapters;
using Harmonia.Application.PendingSignIn;
using Microsoft.Data.SqlClient;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlPendingSignInStoreSlice2Tests(SqlServerFixture fixture)
{
    private SqlPendingSignInStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task ListAsync_returns_all_rows_ordered_by_FirstSeenAt_ascending()
    {
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        await SeedPendingAsync(oid1, DateTime.UtcNow.AddDays(-2));
        await SeedPendingAsync(oid2, DateTime.UtcNow.AddDays(-1));

        var all = await Store.ListAsync();
        var ours = all.Where(p => p.EntraObjectId == oid1 || p.EntraObjectId == oid2).ToList();

        Assert.Equal(2, ours.Count);
        Assert.Equal(oid1, ours[0].EntraObjectId);
        Assert.Equal(oid2, ours[1].EntraObjectId);
    }

    [Fact]
    public async Task ListAsync_returns_IReadOnlyList_and_seeded_oid_appears_in_result()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        await SeedPendingAsync(oid, DateTime.UtcNow.AddHours(-1));

        var result = await Store.ListAsync();

        Assert.IsAssignableFrom<IReadOnlyList<PendingSignIn>>(result);
        Assert.Contains(result, p => p.EntraObjectId == oid);
    }

    [Fact]
    public async Task ActivateAsync_known_oid_returns_Ok_and_moves_row()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-{Guid.NewGuid():N}";
        await Store.UpsertAsync(oid, "test@example.com", "Test User");

        var result = await Store.ActivateAsync(oid, hh, "Owner");

        Assert.Equal(ActivateResult.Ok, result);
        Assert.True(await ExistsInLinksAsync(oid));
        Assert.False(await ExistsInPendingAsync(oid));
    }

    [Fact]
    public async Task ActivateAsync_stores_role_in_HouseholdLinks()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-{Guid.NewGuid():N}";
        await Store.UpsertAsync(oid, "renter@example.com", "Renter User");

        await Store.ActivateAsync(oid, hh, "Renter");

        Assert.Equal("Renter", await GetRoleAsync(oid));
    }

    [Fact]
    public async Task ActivateAsync_unknown_oid_returns_NotFound()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-{Guid.NewGuid():N}";

        var result = await Store.ActivateAsync(oid, hh, "Owner");

        Assert.Equal(ActivateResult.NotFound, result);
        Assert.False(await ExistsInLinksAsync(oid));
    }

    [Fact]
    public async Task ActivateAsync_already_linked_oid_returns_AlreadyActivated()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid, hh);

        var result = await Store.ActivateAsync(oid, hh, "Owner");

        Assert.Equal(ActivateResult.AlreadyActivated, result);
        Assert.Equal(1, await CountLinksAsync(oid));
    }

    [Fact]
    public async Task ActivateAsync_seeds_HouseholdContacts_with_name_and_email_from_pending()
    {
        var oid   = $"oid-{Guid.NewGuid():N}";
        var hh    = $"HH-{Guid.NewGuid():N}";
        await Store.UpsertAsync(oid, "vipera@example.com", "Vipera Berus");

        await Store.ActivateAsync(oid, hh, "Owner");

        var (name, email) = await GetContactAsync(hh, "Owner");
        Assert.Equal("Vipera Berus", name);
        Assert.Equal("vipera@example.com", email);
    }

    [Fact]
    public async Task ActivateAsync_does_not_overwrite_existing_HouseholdContacts_row()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-{Guid.NewGuid():N}";
        await SeedContactAsync(hh, "Owner", "Existing Owner", "existing@example.com");
        await Store.UpsertAsync(oid, "newcomer@example.com", "New Comer");

        await Store.ActivateAsync(oid, hh, "Owner");

        var (name, email) = await GetContactAsync(hh, "Owner");
        Assert.Equal("Existing Owner", name);
        Assert.Equal("existing@example.com", email);
    }

    [Fact]
    public async Task PurgeExpiredAsync_deletes_only_expired_rows()
    {
        await TruncatePendingAsync();
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        var oid3 = $"oid-{Guid.NewGuid():N}";
        await SeedPendingAsync(oid1, DateTime.UtcNow.AddDays(-3));
        await SeedPendingAsync(oid2, DateTime.UtcNow.AddDays(-2));
        await SeedPendingAsync(oid3, DateTime.UtcNow.AddHours(-1));

        var deleted = await Store.PurgeExpiredAsync(DateTimeOffset.UtcNow.AddDays(-1));

        Assert.Equal(2, deleted);
        Assert.False(await ExistsInPendingAsync(oid1));
        Assert.False(await ExistsInPendingAsync(oid2));
        Assert.True(await ExistsInPendingAsync(oid3));
    }

    // --- helpers ---

    private async Task TruncatePendingAsync()
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM dbo.PendingSignIns;";
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SeedPendingAsync(string oid, DateTime firstSeenAt)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "INSERT INTO dbo.PendingSignIns (EntraObjectId, Email, DisplayName, FirstSeenAt) " +
            "VALUES (@Oid, @Email, @DN, @FirstSeenAt);";
        cmd.Parameters.AddWithValue("@Oid",        oid);
        cmd.Parameters.AddWithValue("@Email",       "test@example.com");
        cmd.Parameters.AddWithValue("@DN",          "Test");
        cmd.Parameters.AddWithValue("@FirstSeenAt", firstSeenAt);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SeedLinkAsync(string oid, string householdRef, string role = "Owner")
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, Role, LinkedAt) " +
            "VALUES (@Oid, @HH, @Role, SYSUTCDATETIME());";
        cmd.Parameters.AddWithValue("@Oid",  oid);
        cmd.Parameters.AddWithValue("@HH",   householdRef);
        cmd.Parameters.AddWithValue("@Role", role);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<bool> ExistsInPendingAsync(string oid)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid;";
        cmd.Parameters.AddWithValue("@Oid", oid);
        return (int)(await cmd.ExecuteScalarAsync())! > 0;
    }

    private async Task<bool> ExistsInLinksAsync(string oid)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid;";
        cmd.Parameters.AddWithValue("@Oid", oid);
        return (int)(await cmd.ExecuteScalarAsync())! > 0;
    }

    private async Task<int> CountLinksAsync(string oid)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid;";
        cmd.Parameters.AddWithValue("@Oid", oid);
        return (int)(await cmd.ExecuteScalarAsync())!;
    }

    private async Task<string?> GetRoleAsync(string oid)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Role FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid;";
        cmd.Parameters.AddWithValue("@Oid", oid);
        return (string?)(await cmd.ExecuteScalarAsync());
    }

    private async Task<(string? Name, string? Email)> GetContactAsync(string householdRef, string role)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT DisplayName, Email FROM dbo.HouseholdContacts " +
            "WHERE HouseholdRef = @HH AND Role = @Role;";
        cmd.Parameters.AddWithValue("@HH",   householdRef);
        cmd.Parameters.AddWithValue("@Role", role);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return (null, null);
        return (reader.IsDBNull(0) ? null : reader.GetString(0),
                reader.IsDBNull(1) ? null : reader.GetString(1));
    }

    private async Task SeedContactAsync(string householdRef, string role, string name, string email)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "INSERT INTO dbo.HouseholdContacts (HouseholdRef, Role, DisplayName, Email, IsOptedOut, UpdatedAt) " +
            "VALUES (@HH, @Role, @Name, @Email, 0, SYSUTCDATETIME());";
        cmd.Parameters.AddWithValue("@HH",    householdRef);
        cmd.Parameters.AddWithValue("@Role",  role);
        cmd.Parameters.AddWithValue("@Name",  name);
        cmd.Parameters.AddWithValue("@Email", email);
        await cmd.ExecuteNonQueryAsync();
    }
}
