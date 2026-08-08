using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Financial;
using Harmonia.Domain.Financial;

namespace Harmonia.Api.Adapters;

public sealed class SqlIncomeStore(string connectionString) : IIncomeStore
{
    private const int UniqueIndexViolation      = 2601;
    private const int UniqueConstraintViolation = 2627;

    public async Task<RecordIncomeResult> RecordIncomeAsync(
        AssociationIncome income, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "INSERT INTO dbo.AssociationIncomes " +
                "(Id, Category, Description, AmountEur, IncomeDate, RecordedAt, IdempotencyKey) " +
                "VALUES (@Id, @Category, @Description, @AmountEur, @IncomeDate, @RecordedAt, @IdempotencyKey);";
            cmd.Parameters.AddWithValue("@Id", income.Id);
            cmd.Parameters.AddWithValue("@Category", income.Category);
            cmd.Parameters.AddWithValue("@Description", income.Description);
            cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal)
                { Value = income.AmountEur, Precision = 18, Scale = 2 });
            cmd.Parameters.Add(new SqlParameter("@IncomeDate", SqlDbType.Date)
                { Value = income.IncomeDate.ToDateTime(TimeOnly.MinValue) });
            cmd.Parameters.Add(new SqlParameter("@RecordedAt", SqlDbType.DateTimeOffset)
                { Value = income.RecordedAt });
            cmd.Parameters.AddWithValue("@IdempotencyKey", income.IdempotencyKey);
            await cmd.ExecuteNonQueryAsync(ct);
            return new RecordIncomeResult.Created(income);
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            var existing = await LoadExistingAsync(income.IdempotencyKey, ct);
            return new RecordIncomeResult.Duplicate(existing);
        }
        catch (Exception)
        {
            return new RecordIncomeResult.Failed();
        }
    }

    public async Task<AnnualIncomeData> GetAnnualIncomeAsync(int year, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);

        // Maintenance fees by month
        await using var feeCmd = conn.CreateCommand();
        feeCmd.CommandText =
            "SELECT MONTH(CONVERT(date, Period + '-01')) AS MonthNum, SUM(AmountEur) AS Total " +
            "FROM dbo.MaintenanceFeeCharges " +
            "WHERE YEAR(CONVERT(date, Period + '-01')) = @Year " +
            "GROUP BY MONTH(CONVERT(date, Period + '-01'));";
        feeCmd.Parameters.AddWithValue("@Year", year);

        var feeRows = new List<MaintenanceFeeMonthRow>();
        await using (var reader = await feeCmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
                feeRows.Add(new MaintenanceFeeMonthRow(reader.GetInt32(0), reader.GetDecimal(1)));
        }

        // Other income by category and month
        await using var incCmd = conn.CreateCommand();
        incCmd.CommandText =
            "SELECT Category, MONTH(IncomeDate) AS MonthNum, SUM(AmountEur) AS Total " +
            "FROM dbo.AssociationIncomes " +
            "WHERE YEAR(IncomeDate) = @Year " +
            "GROUP BY Category, MONTH(IncomeDate);";
        incCmd.Parameters.AddWithValue("@Year", year);

        var incRows = new List<IncomeMonthRow>();
        await using (var reader = await incCmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
                incRows.Add(new IncomeMonthRow(reader.GetString(0), reader.GetInt32(1), reader.GetDecimal(2)));
        }

        return new AnnualIncomeData(feeRows, incRows);
    }

    private async Task<AssociationIncome> LoadExistingAsync(string idempotencyKey, CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, Category, Description, AmountEur, IncomeDate, RecordedAt, IdempotencyKey " +
            "FROM dbo.AssociationIncomes WHERE IdempotencyKey = @IdempotencyKey;";
        cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return new AssociationIncome(
            Id:             reader.GetGuid(0),
            Category:       reader.GetString(1),
            Description:    reader.GetString(2),
            AmountEur:      reader.GetDecimal(3),
            IncomeDate:     DateOnly.FromDateTime(reader.GetDateTime(4)),
            RecordedAt:     reader.GetDateTimeOffset(5),
            IdempotencyKey: reader.GetString(6));
    }
}
