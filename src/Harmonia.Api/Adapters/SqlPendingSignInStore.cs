using System.Data;
using Harmonia.Application.PendingSignIn;
using Microsoft.Data.SqlClient;

namespace Harmonia.Api.Adapters;

public sealed class SqlPendingSignInStore(string connectionString) : IPendingSignInStore
{
    public async Task UpsertAsync(
        string oid, string email, string displayName, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            MERGE dbo.PendingSignIns WITH (HOLDLOCK) AS target
            USING (VALUES (@Oid, @Email, @DisplayName, SYSUTCDATETIME()))
                  AS src(EntraObjectId, Email, DisplayName, FirstSeenAt)
            ON target.EntraObjectId = src.EntraObjectId
            WHEN NOT MATCHED THEN
                INSERT (EntraObjectId, Email, DisplayName, FirstSeenAt)
                VALUES (src.EntraObjectId, src.Email, src.DisplayName, src.FirstSeenAt);
            """;
        cmd.Parameters.Add(new SqlParameter("@Oid",         SqlDbType.NVarChar, 36)  { Value = oid });
        cmd.Parameters.Add(new SqlParameter("@Email",       SqlDbType.NVarChar, 256) { Value = email });
        cmd.Parameters.Add(new SqlParameter("@DisplayName", SqlDbType.NVarChar, 256) { Value = displayName });
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
