using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Directory;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Api.Reservations.Adapters;

public sealed class SqlDirectoryStore(string connectionString) : IDirectoryStore
{
    public async Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, Role, DisplayName, Phone, Email, Notes, IsOptedOut, UpdatedAt, DepartedAt, EntraObjectId " +
            "FROM dbo.HouseholdContacts " +
            "ORDER BY HouseholdRef ASC, Role ASC;";

        var results = new List<HouseholdContact>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    public async Task<HouseholdContact?> GetContactByOidAsync(string entraObjectId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, Role, DisplayName, Phone, Email, Notes, IsOptedOut, UpdatedAt, DepartedAt, EntraObjectId " +
            "FROM dbo.HouseholdContacts WHERE EntraObjectId = @Oid;";
        cmd.Parameters.Add(new SqlParameter("@Oid", SqlDbType.NVarChar, 36) { Value = entraObjectId });
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadRow(reader) : null;
    }

    public async Task<UpdateContactResult> UpsertContactByOidAsync(
        string entraObjectId, string? displayName, string? phone, string? email, bool? isOptedOut,
        CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            var rows = await UpsertByOidCoreAsync(
                conn, transaction: null, entraObjectId, displayName, phone, email, isOptedOut, ct);
            // 0 rows means no HouseholdLinks row exists for this OID — shouldn't happen for a
            // caller whose session already carries a HouseholdRef, but fail safe rather than
            // silently do nothing.
            return rows == 0 ? new UpdateContactResult.Failed() : new UpdateContactResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new UpdateContactResult.Failed(); }
    }

    public async Task<EraseContactResult> DeleteContactByOidAsync(string entraObjectId, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct);

            var householdRef = await FindHouseholdRefByOidAsync(conn, tx, entraObjectId, ct);
            if (householdRef is null)
            {
                await tx.RollbackAsync(ct);
                return new EraseContactResult.NotFound();
            }

            await using var deleteCmd = conn.CreateCommand();
            deleteCmd.Transaction = tx;
            deleteCmd.CommandText = "DELETE FROM dbo.HouseholdContacts WHERE EntraObjectId = @Oid;";
            deleteCmd.Parameters.Add(new SqlParameter("@Oid", SqlDbType.NVarChar, 36) { Value = entraObjectId });
            await deleteCmd.ExecuteNonQueryAsync(ct);

            await CascadeIfLastResidentAsync(conn, tx, householdRef, ct);

            await tx.CommitAsync(ct);
            // Idempotent: Ok whether or not a HouseholdContacts row existed to delete, as long
            // as the person is (or was) a linked resident — matches EraseMyContactEndpoint's
            // existing idempotent-204 mapping.
            return new EraseContactResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new EraseContactResult.Failed(); }
    }

    public async Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef, string role, string? displayName, string? phone, string? email,
        bool? isOptedOut, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);

            var resolved = await ResolveOneByRoleAsync(conn, transaction: null, householdRef, role, ct);
            if (resolved.Count == 0) return new UpdateContactResult.Ok(); // see Step 2 note below
            if (resolved.Count > 1)  return new UpdateContactResult.Ambiguous();

            var rows = await UpsertByOidCoreAsync(
                conn, transaction: null, resolved.SingleOid!, displayName, phone, email, isOptedOut, ct);
            return rows == 0 ? new UpdateContactResult.Failed() : new UpdateContactResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new UpdateContactResult.Failed(); }
    }

    public async Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef, string? notes, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            // Household-level, not per-person: matches every resident's row for this household
            // (WHEN MATCHED fires once per matching row for a single source row — legal SQL,
            // no ambiguity error, since only the reverse — one target matching many sources —
            // is illegal). No WHEN NOT MATCHED branch: a household with zero linked residents
            // can never appear in the admin directory list for notes to be set on it.
            cmd.CommandText = """
                MERGE dbo.HouseholdContacts WITH (HOLDLOCK) AS target
                USING (VALUES (@HouseholdRef)) AS source (HouseholdRef)
                ON target.HouseholdRef = source.HouseholdRef
                WHEN MATCHED THEN
                    UPDATE SET Notes = @Notes, UpdatedAt = SYSUTCDATETIME();
                """;
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@Notes", SqlDbType.NVarChar, 2048)
                { Value = (object?)notes ?? DBNull.Value });
            await cmd.ExecuteNonQueryAsync(ct);
            return new UpdateNotesResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new UpdateNotesResult.Failed(); }
    }

    public async Task<EraseContactResult> DeleteContactAsync(
        HouseholdRef householdRef, string role, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct);

            var resolved = await ResolveOneByRoleAsync(conn, tx, householdRef, role, ct);
            if (resolved.Count == 0) { await tx.RollbackAsync(ct); return new EraseContactResult.NotFound(); }
            if (resolved.Count > 1)  { await tx.RollbackAsync(ct); return new EraseContactResult.Ambiguous(); }

            await using var deleteCmd = conn.CreateCommand();
            deleteCmd.Transaction = tx;
            deleteCmd.CommandText = "DELETE FROM dbo.HouseholdContacts WHERE EntraObjectId = @Oid;";
            deleteCmd.Parameters.Add(new SqlParameter("@Oid", SqlDbType.NVarChar, 36) { Value = resolved.SingleOid });
            await deleteCmd.ExecuteNonQueryAsync(ct);

            await CascadeIfLastResidentAsync(conn, tx, householdRef.Value, ct);

            await tx.CommitAsync(ct);
            return new EraseContactResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new EraseContactResult.Failed(); }
    }

    public async Task<MarkDepartedResult> MarkDepartedAsync(
        HouseholdRef householdRef, string role, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);

            var resolved = await ResolveOneByRoleAsync(conn, transaction: null, householdRef, role, ct);
            if (resolved.Count == 0) return new MarkDepartedResult.NotFound();
            if (resolved.Count > 1)  return new MarkDepartedResult.Ambiguous();

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                UPDATE dbo.HouseholdContacts
                SET DepartedAt = ISNULL(DepartedAt, SYSUTCDATETIME())
                WHERE EntraObjectId = @Oid;
                """;
            cmd.Parameters.Add(new SqlParameter("@Oid", SqlDbType.NVarChar, 36) { Value = resolved.SingleOid });
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            // The person is linked (resolved.Count == 1) but has no HouseholdContacts row
            // (e.g. already erased) — nothing to mark.
            return rows == 0 ? new MarkDepartedResult.NotFound() : new MarkDepartedResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new MarkDepartedResult.Failed(); }
    }

    public async Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                DELETE FROM dbo.HouseholdContacts
                WHERE DepartedAt IS NOT NULL
                  AND DepartedAt < DATEADD(year, -1, SYSUTCDATETIME());
                """;
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return new PurgeExpiredContactsResult.Ok(rows);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new PurgeExpiredContactsResult.Failed(); }
    }

    public async Task<RemoveResidentResult> RemoveResidentAsync(
        HouseholdRef householdRef, string role, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct);

            var resolved = await ResolveOneByRoleAsync(conn, tx, householdRef, role, ct);
            if (resolved.Count == 0) { await tx.RollbackAsync(ct); return new RemoveResidentResult.NotFound(); }
            if (resolved.Count > 1)  { await tx.RollbackAsync(ct); return new RemoveResidentResult.Ambiguous(); }

            await using var contactCmd = conn.CreateCommand();
            contactCmd.Transaction = tx;
            contactCmd.CommandText = "DELETE FROM dbo.HouseholdContacts WHERE EntraObjectId = @Oid;";
            contactCmd.Parameters.Add(new SqlParameter("@Oid", SqlDbType.NVarChar, 36) { Value = resolved.SingleOid });
            await contactCmd.ExecuteNonQueryAsync(ct);

            await using var linkCmd = conn.CreateCommand();
            linkCmd.Transaction = tx;
            linkCmd.CommandText = "DELETE FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid;";
            linkCmd.Parameters.Add(new SqlParameter("@Oid", SqlDbType.NVarChar, 36) { Value = resolved.SingleOid });
            await linkCmd.ExecuteNonQueryAsync(ct);

            await tx.CommitAsync(ct);
            return new RemoveResidentResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new RemoveResidentResult.Failed(); }
    }

    // ── shared internals ────────────────────────────────────────────────────

    private readonly record struct RoleResolution(int Count, string? SingleOid);

    /// <summary>Resolves how many linked residents currently hold (householdRef, role) — the
    /// authoritative source is HouseholdLinks, not HouseholdContacts, because a resident who
    /// erased their contact stays linked but has no HouseholdContacts row (see spec).</summary>
    private static async Task<RoleResolution> ResolveOneByRoleAsync(
        SqlConnection conn, SqlTransaction? transaction, HouseholdRef householdRef, string role,
        CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText =
            "SELECT EntraObjectId FROM dbo.HouseholdLinks WHERE HouseholdRef = @HouseholdRef AND Role = @Role;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        cmd.Parameters.Add(new SqlParameter("@Role", SqlDbType.NVarChar, 10) { Value = role });

        var oids = new List<string>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) oids.Add(reader.GetString(0));

        return new RoleResolution(oids.Count, oids.Count == 1 ? oids[0] : null);
    }

    private static async Task<string?> FindHouseholdRefByOidAsync(
        SqlConnection conn, SqlTransaction transaction, string entraObjectId, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText = "SELECT HouseholdRef FROM dbo.HouseholdLinks WHERE EntraObjectId = @Oid;";
        cmd.Parameters.Add(new SqlParameter("@Oid", SqlDbType.NVarChar, 36) { Value = entraObjectId });
        return (string?)await cmd.ExecuteScalarAsync(ct);
    }

    /// <summary>Shared upsert core for both the person-scoped and (resolved-to-one-person)
    /// role-scoped update paths. On first call for this OID, resolves HouseholdRef/Role from
    /// HouseholdLinks so the new row is created correctly — covers both "never had a contact
    /// row" and "erased it, now refilling" cases identically. Returns affected row count (0
    /// means no HouseholdLinks row exists for this OID at all).</summary>
    private static async Task<int> UpsertByOidCoreAsync(
        SqlConnection conn, SqlTransaction? transaction, string entraObjectId,
        string? displayName, string? phone, string? email, bool? isOptedOut, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText = """
            MERGE dbo.HouseholdContacts WITH (HOLDLOCK) AS target
            USING (
                SELECT @Oid AS EntraObjectId, hl.HouseholdRef, hl.Role
                FROM dbo.HouseholdLinks hl WHERE hl.EntraObjectId = @Oid
            ) AS source
            ON target.EntraObjectId = source.EntraObjectId
            WHEN MATCHED THEN
                UPDATE SET
                    DisplayName = COALESCE(@DisplayName, target.DisplayName),
                    Phone       = COALESCE(@Phone,       target.Phone),
                    Email       = COALESCE(@Email,       target.Email),
                    IsOptedOut  = COALESCE(@IsOptedOut,  target.IsOptedOut),
                    UpdatedAt   = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (EntraObjectId, HouseholdRef, Role, DisplayName, Phone, Email, Notes, IsOptedOut, UpdatedAt)
                VALUES (source.EntraObjectId, source.HouseholdRef, source.Role,
                        @DisplayName, @Phone, @Email, NULL, COALESCE(@IsOptedOut, 0), SYSUTCDATETIME());
            """;
        cmd.Parameters.Add(new SqlParameter("@Oid", SqlDbType.NVarChar, 36) { Value = entraObjectId });
        cmd.Parameters.Add(new SqlParameter("@DisplayName", SqlDbType.NVarChar, 256)
            { Value = (object?)displayName ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar, 32)
            { Value = (object?)phone ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar, 320)
            { Value = (object?)email ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@IsOptedOut", SqlDbType.Bit)
            { Value = (object?)isOptedOut ?? DBNull.Value });
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>PushSubscriptions and NotificationHistory are household-level, not per-person
    /// (see spec) — only cascade-delete them once no resident's HouseholdContacts row remains
    /// for this household, so a co-resident's data survives another resident's erasure.</summary>
    private static async Task CascadeIfLastResidentAsync(
        SqlConnection conn, SqlTransaction transaction, string householdRef, CancellationToken ct)
    {
        await using var checkCmd = conn.CreateCommand();
        checkCmd.Transaction = transaction;
        checkCmd.CommandText = "SELECT COUNT(1) FROM dbo.HouseholdContacts WHERE HouseholdRef = @HouseholdRef;";
        checkCmd.Parameters.AddWithValue("@HouseholdRef", householdRef);
        var remaining = (int)(await checkCmd.ExecuteScalarAsync(ct))!;
        if (remaining > 0) return;

        await using var histCmd = conn.CreateCommand();
        histCmd.Transaction = transaction;
        histCmd.CommandText = "DELETE FROM dbo.NotificationHistory WHERE HouseholdRef = @HouseholdRef;";
        histCmd.Parameters.AddWithValue("@HouseholdRef", householdRef);
        await histCmd.ExecuteNonQueryAsync(ct);

        await using var subCmd = conn.CreateCommand();
        subCmd.Transaction = transaction;
        subCmd.CommandText = "DELETE FROM dbo.PushSubscriptions WHERE HouseholdRef = @HouseholdRef;";
        subCmd.Parameters.AddWithValue("@HouseholdRef", householdRef);
        await subCmd.ExecuteNonQueryAsync(ct);
    }

    private static HouseholdContact ReadRow(SqlDataReader r) =>
        new(HouseholdRef:   new HouseholdRef(r.GetString(0)),
            Role:           r.IsDBNull(1) ? "Owner" : r.GetString(1),
            DisplayName:    r.IsDBNull(2) ? null : r.GetString(2),
            Phone:          r.IsDBNull(3) ? null : r.GetString(3),
            Email:          r.IsDBNull(4) ? null : r.GetString(4),
            Notes:          r.IsDBNull(5) ? null : r.GetString(5),
            IsOptedOut:     r.GetBoolean(6),
            UpdatedAt:      r.GetDateTimeOffset(7),
            DepartedAt:     r.IsDBNull(8) ? null : r.GetDateTimeOffset(8),
            EntraObjectId:  r.GetString(9));
}
