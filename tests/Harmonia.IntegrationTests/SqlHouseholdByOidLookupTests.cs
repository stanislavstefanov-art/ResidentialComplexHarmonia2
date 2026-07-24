using Harmonia.Api.Adapters;
using Microsoft.Data.SqlClient;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlHouseholdByOidLookupTests(SqlServerFixture fixture)
{
    private SqlHouseholdByOidLookup Lookup => new(fixture.ConnectionString);

    [Fact]
    public async Task OID_present_returns_correct_HouseholdRef()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-LINK-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid, hh);

        var result = await Lookup.FindHouseholdRefAsync(oid);

        Assert.Equal(hh, result);
    }

    [Fact]
    public async Task OID_absent_returns_null()
    {
        var oid = $"oid-{Guid.NewGuid():N}";

        var result = await Lookup.FindHouseholdRefAsync(oid);

        Assert.Null(result);
    }

    [Fact]
    public async Task Two_OIDs_sharing_same_HouseholdRef_both_resolve_correctly()
    {
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        var hh   = $"HH-FAM-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid1, hh);
        await SeedLinkAsync(oid2, hh);

        Assert.Equal(hh, await Lookup.FindHouseholdRefAsync(oid1));
        Assert.Equal(hh, await Lookup.FindHouseholdRefAsync(oid2));
    }

    [Fact]
    public async Task Duplicate_OID_insert_violates_PK()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-DUP-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid, hh);

        await Assert.ThrowsAnyAsync<Exception>(() => SeedLinkAsync(oid, hh));
    }

    private async Task SeedLinkAsync(string oid, string householdRef)
    {
        await using var conn = new SqlConnection(fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, LinkedAt) " +
            "VALUES (@Oid, @HH, SYSUTCDATETIME());";
        cmd.Parameters.AddWithValue("@Oid", oid);
        cmd.Parameters.AddWithValue("@HH",  householdRef);
        await cmd.ExecuteNonQueryAsync();
    }
}
