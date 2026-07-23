using Harmonia.Api.Adapters;
using Microsoft.Data.SqlClient;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlPendingSignInStoreTests(SqlServerFixture fixture)
{
    private SqlPendingSignInStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task Upsert_new_oid_creates_row_with_FirstSeenAt()
    {
        var oid = $"oid-{Guid.NewGuid():N}";

        await Store.UpsertAsync(oid, "test@example.com", "Test User");

        var row = await GetRowAsync(oid);
        Assert.NotNull(row);
        Assert.Equal("test@example.com", row.Value.Email);
        Assert.Equal("Test User",        row.Value.DisplayName);
        Assert.True(row.Value.FirstSeenAt > DateTime.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task Upsert_same_oid_twice_preserves_FirstSeenAt()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        await Store.UpsertAsync(oid, "first@example.com", "First");
        var before = (await GetRowAsync(oid))!.Value.FirstSeenAt;

        await Task.Delay(20);
        await Store.UpsertAsync(oid, "second@example.com", "Second");

        var after = (await GetRowAsync(oid))!.Value.FirstSeenAt;
        Assert.Equal(before, after);
    }

    [Fact]
    public async Task Concurrent_upserts_for_same_oid_produce_one_row()
    {
        var oid = $"oid-{Guid.NewGuid():N}";

        await Task.WhenAll(
            Store.UpsertAsync(oid, "a@example.com", "A"),
            Store.UpsertAsync(oid, "b@example.com", "B"),
            Store.UpsertAsync(oid, "c@example.com", "C"));

        Assert.Equal(1, await CountRowsAsync(oid));
    }

    private async Task<(string Email, string DisplayName, DateTime FirstSeenAt)?> GetRowAsync(string oid)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Email, DisplayName, FirstSeenAt FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid;";
        cmd.Parameters.AddWithValue("@Oid", oid);
        await using var r = await cmd.ExecuteReaderAsync();
        if (!await r.ReadAsync()) return null;
        return (r.GetString(0), r.GetString(1), r.GetDateTime(2));
    }

    private async Task<int> CountRowsAsync(string oid)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid;";
        cmd.Parameters.AddWithValue("@Oid", oid);
        return (int)(await cmd.ExecuteScalarAsync())!;
    }
}
