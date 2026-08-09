using Harmonia.Application.PendingSignIn;
using Microsoft.Data.SqlClient;

namespace Harmonia.Api.Adapters;

public sealed class SqlHouseholdByOidLookup(string connectionString) : IHouseholdByOidLookup
{
    public async Task<HouseholdLink?> FindAsync(string oid, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, Role FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid;";
        cmd.Parameters.AddWithValue("@Oid", oid);
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var householdRef = reader.GetString(0);
        var role = reader.IsDBNull(1) ? "Owner" : reader.GetString(1);
        return new HouseholdLink(householdRef, role);
    }
}
