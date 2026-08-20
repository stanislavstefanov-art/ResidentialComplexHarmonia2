using System.Data;
using Harmonia.Application.PendingSignIn;
using Microsoft.Data.SqlClient;

namespace Harmonia.Api.Adapters;

public sealed class SqlPendingSignInStore(string connectionString) : IPendingSignInStore
{
    public async Task<PendingUpsertResult> UpsertAsync(
        string oid, string email, string displayName, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        // OUTPUT $action emits one row reading 'INSERT' when the row was created,
        // and no rows at all when the OID already existed — which is how the caller
        // tells a genuine new sign-up from a repeat request by the same person.
        cmd.CommandText = """
            MERGE dbo.PendingSignIns WITH (HOLDLOCK) AS target
            USING (VALUES (@Oid, @Email, @DisplayName, SYSUTCDATETIME()))
                  AS src(EntraObjectId, Email, DisplayName, FirstSeenAt)
            ON target.EntraObjectId = src.EntraObjectId
            WHEN NOT MATCHED THEN
                INSERT (EntraObjectId, Email, DisplayName, FirstSeenAt)
                VALUES (src.EntraObjectId, src.Email, src.DisplayName, src.FirstSeenAt)
            OUTPUT $action;
            """;
        cmd.Parameters.Add(new SqlParameter("@Oid",         SqlDbType.NVarChar, 36)  { Value = oid });
        cmd.Parameters.Add(new SqlParameter("@Email",       SqlDbType.NVarChar, 256) { Value = email });
        cmd.Parameters.Add(new SqlParameter("@DisplayName", SqlDbType.NVarChar, 256) { Value = displayName });
        var action = await cmd.ExecuteScalarAsync(ct) as string;
        return action == "INSERT" ? PendingUpsertResult.Inserted : PendingUpsertResult.AlreadyPending;
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
                DECLARE @roleConflict  bit = 0;

                IF EXISTS (SELECT 1 FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid)
                    SET @pendingExists = 1;
                IF EXISTS (SELECT 1 FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid)
                    SET @alreadyLinked = 1;
                IF EXISTS (SELECT 1 FROM dbo.HouseholdContacts WHERE HouseholdRef = @HouseholdRef AND Role = @Role)
                    SET @roleConflict = 1;

                IF @pendingExists = 1 AND @alreadyLinked = 0 AND @roleConflict = 0
                BEGIN
                    INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, Role, LinkedAt)
                    VALUES (@Oid, @HouseholdRef, @Role, SYSUTCDATETIME());

                    INSERT INTO dbo.HouseholdContacts (HouseholdRef, Role, DisplayName, Email, IsOptedOut, UpdatedAt)
                    SELECT @HouseholdRef, @Role, ps.DisplayName, ps.Email, 0, SYSUTCDATETIME()
                    FROM dbo.PendingSignIns ps
                    WHERE ps.EntraObjectId = @Oid;

                    IF NOT EXISTS (SELECT 1 FROM dbo.Households WHERE HouseholdRef = @HouseholdRef)
                        INSERT INTO dbo.Households (HouseholdRef, SqMeters) VALUES (@HouseholdRef, 0);

                    DELETE FROM dbo.PendingSignIns WHERE EntraObjectId = @Oid;
                END
            COMMIT;
            SELECT @pendingExists AS PendingExists, @alreadyLinked AS AlreadyLinked, @roleConflict AS RoleConflict;
            """;
        cmd.Parameters.Add(new SqlParameter("@Oid",          SqlDbType.NVarChar, 36)  { Value = oid });
        cmd.Parameters.Add(new SqlParameter("@HouseholdRef", SqlDbType.NVarChar, 256) { Value = householdRef });
        cmd.Parameters.Add(new SqlParameter("@Role",         SqlDbType.NVarChar, 10)  { Value = role });
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        var pendingExists = reader.GetBoolean(0);
        var alreadyLinked = reader.GetBoolean(1);
        var roleConflict  = reader.GetBoolean(2);
        return (pendingExists, alreadyLinked, roleConflict) switch
        {
            (_,     true,  _)    => ActivateResult.AlreadyActivated,
            (false, false, _)    => ActivateResult.NotFound,
            (_,     _,     true) => ActivateResult.RoleConflict,
            _                    => ActivateResult.Ok
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
            BEGIN
                INSERT INTO dbo.HouseholdLinks (EntraObjectId, HouseholdRef, Role, LinkedAt)
                VALUES (@Oid, @HouseholdRef, @Role, SYSUTCDATETIME());

                IF NOT EXISTS (SELECT 1 FROM dbo.HouseholdContacts WHERE HouseholdRef = @HouseholdRef AND Role = @Role)
                    INSERT INTO dbo.HouseholdContacts (HouseholdRef, Role, IsOptedOut, UpdatedAt)
                    VALUES (@HouseholdRef, @Role, 0, SYSUTCDATETIME());

                IF NOT EXISTS (SELECT 1 FROM dbo.Households WHERE HouseholdRef = @HouseholdRef)
                    INSERT INTO dbo.Households (HouseholdRef, SqMeters) VALUES (@HouseholdRef, 0);
            END
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
