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
            "SELECT HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt " +
            "FROM dbo.HouseholdContacts " +
            "ORDER BY HouseholdRef ASC;";

        var results = new List<HouseholdContact>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    public async Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef, string? displayName, string? phone, string? email,
        CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                MERGE dbo.HouseholdContacts WITH (HOLDLOCK) AS target
                USING (VALUES (@HouseholdRef)) AS source (HouseholdRef)
                ON target.HouseholdRef = source.HouseholdRef
                WHEN MATCHED THEN
                    UPDATE SET
                        DisplayName = COALESCE(@DisplayName, target.DisplayName),
                        Phone       = COALESCE(@Phone,       target.Phone),
                        Email       = COALESCE(@Email,       target.Email),
                        UpdatedAt   = SYSUTCDATETIMEOFFSET()
                WHEN NOT MATCHED THEN
                    INSERT (HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt)
                    VALUES (@HouseholdRef, @DisplayName, @Phone, @Email, NULL, SYSUTCDATETIMEOFFSET());
                """;
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@DisplayName", SqlDbType.NVarChar, 256)
                { Value = (object?)displayName ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar, 32)
                { Value = (object?)phone ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar, 320)
                { Value = (object?)email ?? DBNull.Value });
            await cmd.ExecuteNonQueryAsync(ct);
            return new UpdateContactResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateContactResult.Failed();
        }
    }

    public async Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef, string? notes,
        CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                MERGE dbo.HouseholdContacts WITH (HOLDLOCK) AS target
                USING (VALUES (@HouseholdRef)) AS source (HouseholdRef)
                ON target.HouseholdRef = source.HouseholdRef
                WHEN MATCHED THEN
                    UPDATE SET Notes = @Notes, UpdatedAt = SYSUTCDATETIMEOFFSET()
                WHEN NOT MATCHED THEN
                    INSERT (HouseholdRef, DisplayName, Phone, Email, Notes, UpdatedAt)
                    VALUES (@HouseholdRef, NULL, NULL, NULL, @Notes, SYSUTCDATETIMEOFFSET());
                """;
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@Notes", SqlDbType.NVarChar, 2048)
                { Value = (object?)notes ?? DBNull.Value });
            await cmd.ExecuteNonQueryAsync(ct);
            return new UpdateNotesResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateNotesResult.Failed();
        }
    }

    private static HouseholdContact ReadRow(SqlDataReader r) =>
        new(HouseholdRef:  new HouseholdRef(r.GetString(0)),
            DisplayName:   r.IsDBNull(1) ? null : r.GetString(1),
            Phone:         r.IsDBNull(2) ? null : r.GetString(2),
            Email:         r.IsDBNull(3) ? null : r.GetString(3),
            Notes:         r.IsDBNull(4) ? null : r.GetString(4),
            UpdatedAt:     r.GetDateTimeOffset(5));
}
