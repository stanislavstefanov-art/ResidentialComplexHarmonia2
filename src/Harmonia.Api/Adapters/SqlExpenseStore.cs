using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.Api.Reservations.Adapters;

public sealed class SqlExpenseStore(string connectionString) : IExpenseStore
{
    private const int UniqueIndexViolation      = 2601;
    private const int UniqueConstraintViolation = 2627;

    public async Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "INSERT INTO dbo.AssociationExpenses " +
                "(Id, AmountEur, Description, Category, ParentCategory, ExpenseDate, RecordedAt, IdempotencyKey) " +
                "VALUES (@Id, @AmountEur, @Description, @Category, @ParentCategory, @ExpenseDate, @RecordedAt, @IdempotencyKey);";
            cmd.Parameters.AddWithValue("@Id", expense.Id);
            cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal)
                { Value = expense.AmountEur, Precision = 18, Scale = 2 });
            cmd.Parameters.AddWithValue("@Description", expense.Description);
            cmd.Parameters.AddWithValue("@Category", expense.Category);
            cmd.Parameters.Add(new SqlParameter("@ParentCategory", SqlDbType.NVarChar, 100)
                { Value = (object?)expense.ParentCategory ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@ExpenseDate", SqlDbType.Date)
                { Value = expense.ExpenseDate.ToDateTime(TimeOnly.MinValue) });
            cmd.Parameters.Add(new SqlParameter("@RecordedAt", SqlDbType.DateTimeOffset)
                { Value = expense.RecordedAt });
            cmd.Parameters.AddWithValue("@IdempotencyKey", expense.IdempotencyKey);
            await cmd.ExecuteNonQueryAsync(ct);
            return new RecordExpenseResult.Created(expense);
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            var existing = await LoadExistingAsync(expense.IdempotencyKey, ct);
            return new RecordExpenseResult.Duplicate(existing);
        }
        catch (Exception)
        {
            return new RecordExpenseResult.Failed();
        }
    }

    public async Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, AmountEur, Description, Category, ParentCategory, ExpenseDate, RecordedAt, IdempotencyKey " +
            "FROM dbo.AssociationExpenses " +
            "ORDER BY RecordedAt DESC;";

        var results = new List<AssociationExpense>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    public async Task<AnnualExpenseData> GetAnnualExpensesAsync(int year, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT ISNULL(ParentCategory, 'Other') AS ParentCategory, " +
            "       Category, " +
            "       MONTH(ExpenseDate) AS MonthNum, " +
            "       SUM(AmountEur) AS Total " +
            "FROM dbo.AssociationExpenses " +
            "WHERE YEAR(ExpenseDate) = @Year " +
            "GROUP BY ISNULL(ParentCategory, 'Other'), Category, MONTH(ExpenseDate);";
        cmd.Parameters.AddWithValue("@Year", year);

        var rows = new List<ExpenseMonthRow>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new ExpenseMonthRow(
                ParentCategory: reader.GetString(0),
                SubCategory:    reader.GetString(1),
                MonthNum:       reader.GetInt32(2),
                Total:          reader.GetDecimal(3)));
        }
        return new AnnualExpenseData(rows);
    }

    private async Task<AssociationExpense> LoadExistingAsync(string idempotencyKey, CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, AmountEur, Description, Category, ParentCategory, ExpenseDate, RecordedAt, IdempotencyKey " +
            "FROM dbo.AssociationExpenses WHERE IdempotencyKey = @IdempotencyKey;";
        cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return ReadRow(reader);
    }

    private static AssociationExpense ReadRow(SqlDataReader r) =>
        new(
            Id:             r.GetGuid(0),
            AmountEur:      r.GetDecimal(1),
            Description:    r.GetString(2),
            Category:       r.GetString(3),
            ParentCategory: r.IsDBNull(4) ? null : r.GetString(4),
            ExpenseDate:    DateOnly.FromDateTime(r.GetDateTime(5)),
            RecordedAt:     r.GetDateTimeOffset(6),
            IdempotencyKey: r.GetString(7));
}
