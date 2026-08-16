using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Counterparties;
using Harmonia.Domain.Counterparties;

namespace Harmonia.Api.Adapters;

public sealed class SqlCounterpartyStore(string connectionString) : ICounterpartyStore
{
    private const string SelectColumns =
        "Id, Name, Category, ParentCategory, VatNumber, Phone, Email, CreatedAt, UpdatedAt";

    public async Task<IReadOnlyList<Counterparty>> ListAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT {SelectColumns} FROM dbo.Counterparties ORDER BY Name ASC;";
        var results = new List<Counterparty>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    public async Task<Counterparty?> GetAsync(Guid id, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT {SelectColumns} FROM dbo.Counterparties WHERE Id = @Id;";
        cmd.Parameters.AddWithValue("@Id", id);
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadRow(reader) : null;
    }

    public async Task<Counterparty> CreateAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var cp = new Counterparty(Guid.NewGuid(), name, category, parentCategory, vatNumber, phone, email, now, now);
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO dbo.Counterparties
                (Id, Name, Category, ParentCategory, VatNumber, Phone, Email, CreatedAt, UpdatedAt)
            VALUES
                (@Id, @Name, @Category, @ParentCategory, @VatNumber, @Phone, @Email, @CreatedAt, @UpdatedAt);
            """;
        BindWriteParams(cmd, cp);
        await cmd.ExecuteNonQueryAsync(ct);
        return cp;
    }

    public async Task<UpdateCounterpartyStoreResult> UpdateAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE dbo.Counterparties
            SET Name = @Name, Category = @Category, ParentCategory = @ParentCategory,
                VatNumber = @VatNumber, Phone = @Phone, Email = @Email, UpdatedAt = @UpdatedAt
            OUTPUT inserted.Id, inserted.Name, inserted.Category, inserted.ParentCategory,
                   inserted.VatNumber, inserted.Phone, inserted.Email, inserted.CreatedAt, inserted.UpdatedAt
            WHERE Id = @Id;
            """;
        cmd.Parameters.AddWithValue("@Id", id);
        cmd.Parameters.AddWithValue("@Name", name);
        cmd.Parameters.AddWithValue("@Category", category);
        cmd.Parameters.AddWithValue("@ParentCategory", parentCategory);
        cmd.Parameters.Add(new SqlParameter("@VatNumber", SqlDbType.NVarChar) { Value = (object?)vatNumber ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar) { Value = (object?)phone ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar) { Value = (object?)email ?? DBNull.Value });
        cmd.Parameters.AddWithValue("@UpdatedAt", DateTimeOffset.UtcNow);
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new UpdateCounterpartyStoreResult.Ok(ReadRow(reader))
            : new UpdateCounterpartyStoreResult.NotFound();
    }

    public async Task<DeleteCounterpartyStoreResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);

        await using (var checkCmd = conn.CreateCommand())
        {
            checkCmd.CommandText = "SELECT COUNT(1) FROM dbo.AssociationExpenses WHERE CounterpartyId = @Id;";
            checkCmd.Parameters.AddWithValue("@Id", id);
            var billCount = (int)await checkCmd.ExecuteScalarAsync(ct);
            if (billCount > 0)
                return new DeleteCounterpartyStoreResult.HasBills();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM dbo.Counterparties WHERE Id = @Id;";
        cmd.Parameters.AddWithValue("@Id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return rows == 0
            ? new DeleteCounterpartyStoreResult.NotFound()
            : new DeleteCounterpartyStoreResult.Ok();
    }

    private static void BindWriteParams(SqlCommand cmd, Counterparty cp)
    {
        cmd.Parameters.AddWithValue("@Id", cp.Id);
        cmd.Parameters.AddWithValue("@Name", cp.Name);
        cmd.Parameters.AddWithValue("@Category", cp.Category);
        cmd.Parameters.AddWithValue("@ParentCategory", cp.ParentCategory);
        cmd.Parameters.Add(new SqlParameter("@VatNumber", SqlDbType.NVarChar) { Value = (object?)cp.VatNumber ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Phone", SqlDbType.NVarChar) { Value = (object?)cp.Phone ?? DBNull.Value });
        cmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar) { Value = (object?)cp.Email ?? DBNull.Value });
        cmd.Parameters.AddWithValue("@CreatedAt", cp.CreatedAt);
        cmd.Parameters.AddWithValue("@UpdatedAt", cp.UpdatedAt);
    }

    private static Counterparty ReadRow(SqlDataReader r) => new(
        r.GetGuid(0),
        r.GetString(1),
        r.GetString(2),
        r.GetString(3),
        r.IsDBNull(4) ? null : r.GetString(4),
        r.IsDBNull(5) ? null : r.GetString(5),
        r.IsDBNull(6) ? null : r.GetString(6),
        r.GetDateTimeOffset(7),
        r.GetDateTimeOffset(8));
}
