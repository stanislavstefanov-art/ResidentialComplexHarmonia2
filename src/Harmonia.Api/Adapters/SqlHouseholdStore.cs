using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Households;
using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Api.Adapters;

public sealed class SqlHouseholdStore(string connectionString) : IHouseholdStore
{
    public async Task<IReadOnlyList<Household>> ListAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, SqMeters FROM dbo.Households ORDER BY HouseholdRef ASC;";
        var results = new List<Household>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(new Household(new HouseholdRef(reader.GetString(0)), reader.GetDecimal(1)));
        return results;
    }

    public async Task<UpsertHouseholdResult> UpsertAsync(
        HouseholdRef householdRef, decimal sqMeters, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                MERGE dbo.Households WITH (HOLDLOCK) AS target
                USING (VALUES (@HouseholdRef)) AS source (HouseholdRef)
                ON target.HouseholdRef = source.HouseholdRef
                WHEN MATCHED THEN
                    UPDATE SET SqMeters = @SqMeters
                WHEN NOT MATCHED THEN
                    INSERT (HouseholdRef, SqMeters) VALUES (@HouseholdRef, @SqMeters);
                """;
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@SqMeters", SqlDbType.Decimal)
                { Value = sqMeters, Precision = 8, Scale = 2 });
            await cmd.ExecuteNonQueryAsync(ct);
            return new UpsertHouseholdResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new UpsertHouseholdResult.Failed(); }
    }

    public async Task<DeleteHouseholdResult> DeleteAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM dbo.Households WHERE HouseholdRef = @HouseholdRef;";
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return rows == 0
                ? new DeleteHouseholdResult.NotFound()
                : new DeleteHouseholdResult.Ok();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new DeleteHouseholdResult.Failed(); }
    }
}
