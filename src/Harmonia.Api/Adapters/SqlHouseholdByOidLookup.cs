using Harmonia.Application.PendingSignIn;
using Microsoft.Data.SqlClient;

namespace Harmonia.Api.Adapters;

public sealed class SqlHouseholdByOidLookup(string connectionString) : IHouseholdByOidLookup
{
    public async Task<string?> FindHouseholdRefAsync(string oid, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid;";
        cmd.Parameters.AddWithValue("@Oid", oid);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is DBNull or null ? null : (string)result;
    }
}
