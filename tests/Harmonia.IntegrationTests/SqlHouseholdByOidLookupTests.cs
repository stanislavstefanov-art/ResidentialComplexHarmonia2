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

        var result = await Lookup.FindAsync(oid);

        Assert.Equal(hh, result!.HouseholdRef);
    }

    [Fact]
    public async Task OID_present_returns_correct_Role()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-LINK-ROLE-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid, hh, "Renter");

        var result = await Lookup.FindAsync(oid);

        Assert.Equal("Renter", result!.Role);
    }

    [Fact]
    public async Task OID_absent_returns_null()
    {
        var oid = $"oid-{Guid.NewGuid():N}";

        var result = await Lookup.FindAsync(oid);

        Assert.Null(result);
    }

    [Fact]
    public async Task Two_OIDs_sharing_same_HouseholdRef_both_resolve_correctly()
    {
        var oid1 = $"oid-{Guid.NewGuid():N}";
        var oid2 = $"oid-{Guid.NewGuid():N}";
        var hh   = $"HH-FAM-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid1, hh, "Owner");
        await SeedLinkAsync(oid2, hh, "Renter");

        Assert.Equal(hh, (await Lookup.FindAsync(oid1))!.HouseholdRef);
        Assert.Equal(hh, (await Lookup.FindAsync(oid2))!.HouseholdRef);
    }

    [Fact]
    public async Task Duplicate_OID_insert_violates_PK()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-DUP-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid, hh);

        await Assert.ThrowsAnyAsync<Exception>(() => SeedLinkAsync(oid, hh));
    }

    [Fact]
    public async Task Admin_flag_round_trips_and_can_be_cleared()
    {
        var oid = $"oid-{Guid.NewGuid():N}";
        var hh  = $"HH-ADMIN-{Guid.NewGuid():N}";
        await SeedLinkAsync(oid, hh);

        Assert.False((await Lookup.FindAsync(oid))!.IsAdmin);

        await Lookup.SetAdminFlagAsync(oid, true);
        Assert.True((await Lookup.FindAsync(oid))!.IsAdmin);

        await Lookup.SetAdminFlagAsync(oid, false);
        Assert.False((await Lookup.FindAsync(oid))!.IsAdmin);
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
}
