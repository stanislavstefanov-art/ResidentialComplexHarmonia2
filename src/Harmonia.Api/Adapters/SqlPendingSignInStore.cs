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

    public async Task<IReadOnlyList<PendingSignIn>> ListAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT EntraObjectId, Email, DisplayName, FirstSeenAt
            FROM dbo.PendingSignIns
            ORDER BY FirstSeenAt ASC;
            """;
        var result = new List<PendingSignIn>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            result.Add(new PendingSignIn(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                new DateTimeOffset(reader.GetDateTime(3), TimeSpan.Zero)));
        return result;
    }

    public async Task<ActivateResult> ActivateAsync(
        string oid, string householdRef, string role, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SET XACT_ABORT ON;
            BEGIN TRANSACTION;
                DECLARE @pendingExists bit = 0;
                DECLARE @alreadyLinked bit = 0;

                IF EXISTS (SELECT 1 FROM dbo.PendingSignIns  WHERE EntraObjectId = @Oid)
                    SET @pendingExists = 1;
                IF EXISTS (SELECT 1 FROM dbo.HouseholdLinks  WHERE EntraObjectId = @Oid)
                    SET @alreadyLinked = 1;

                IF @pendingExists = 1 AND @alreadyLinked = 0
                BEGIN
                    INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, Role, LinkedAt)
                    VALUES (@Oid, @HouseholdRef, @Role, SYSUTCDATETIME());
                    DELETE FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid;
                END
            COMMIT;
            SELECT @pendingExists AS PendingExists, @alreadyLinked AS AlreadyLinked;
            """;
        cmd.Parameters.Add(new SqlParameter("@Oid",          SqlDbType.NVarChar, 36)  { Value = oid });
        cmd.Parameters.Add(new SqlParameter("@HouseholdRef", SqlDbType.NVarChar, 256) { Value = householdRef });
        cmd.Parameters.Add(new SqlParameter("@Role",         SqlDbType.NVarChar, 10)  { Value = role });
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        var pendingExists = reader.GetBoolean(0);
        var alreadyLinked = reader.GetBoolean(1);
        return (pendingExists, alreadyLinked) switch
        {
            (_,     true)  => ActivateResult.AlreadyActivated,
            (false, false) => ActivateResult.NotFound,
            _              => ActivateResult.Ok
        };
    }

    public async Task<DirectLinkResult> DirectLinkAsync(
        string oid, string householdRef, string role, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            DECLARE @alreadyLinked bit = 0;
            IF EXISTS (SELECT 1 FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid)
                SET @alreadyLinked = 1;
            ELSE
                INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, Role, LinkedAt)
                VALUES (@Oid, @HouseholdRef, @Role, SYSUTCDATETIME());
            SELECT @alreadyLinked;
            """;
        cmd.Parameters.Add(new SqlParameter("@Oid",          SqlDbType.NVarChar, 36)  { Value = oid });
        cmd.Parameters.Add(new SqlParameter("@HouseholdRef", SqlDbType.NVarChar, 128) { Value = householdRef });
        cmd.Parameters.Add(new SqlParameter("@Role",         SqlDbType.NVarChar, 10)  { Value = role });
        var alreadyLinked = (bool)(await cmd.ExecuteScalarAsync(ct))!;
        return alreadyLinked ? DirectLinkResult.AlreadyLinked : DirectLinkResult.Ok;
    }

    public async Task<int> PurgeExpiredAsync(DateTimeOffset olderThan, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            DELETE FROM dbo.PendingSignIns WHERE FirstSeenAt < @OlderThan;
            SELECT @@ROWCOUNT;
            """;
        cmd.Parameters.Add(new SqlParameter("@OlderThan", SqlDbType.DateTime2) { Value = olderThan.UtcDateTime });
        return (int)(await cmd.ExecuteScalarAsync(ct))!;
    }
}
