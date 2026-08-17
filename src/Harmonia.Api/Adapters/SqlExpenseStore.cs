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
                "(Id, AmountEur, Description, CounterpartyId, ExpenseDate, RecordedAt, IdempotencyKey) " +
                "VALUES (@Id, @AmountEur, @Description, @CounterpartyId, @ExpenseDate, @RecordedAt, @IdempotencyKey);";
            cmd.Parameters.AddWithValue("@Id", expense.Id);
            cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal)
                { Value = expense.AmountEur, Precision = 18, Scale = 2 });
            cmd.Parameters.AddWithValue("@Description", expense.Description);
            cmd.Parameters.AddWithValue("@CounterpartyId", expense.CounterpartyId);
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

    public async Task<IReadOnlyList<ExpenseListItem>> ListExpensesAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT e.Id, e.AmountEur, e.Description, e.CounterpartyId, " +
            "       c.Name, c.Category, c.ParentCategory, " +
            "       e.ExpenseDate, e.RecordedAt, e.IdempotencyKey " +
            "FROM dbo.AssociationExpenses e " +
            "JOIN dbo.Counterparties c ON c.Id = e.CounterpartyId " +
            "ORDER BY e.RecordedAt DESC;";

        var results = new List<ExpenseListItem>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new ExpenseListItem(
                Id:                         reader.GetGuid(0),
                AmountEur:                  reader.GetDecimal(1),
                Description:                reader.GetString(2),
                CounterpartyId:             reader.GetGuid(3),
                CounterpartyName:           reader.GetString(4),
                CounterpartyCategory:       reader.GetString(5),
                CounterpartyParentCategory: reader.GetString(6),
                ExpenseDate:                DateOnly.FromDateTime(reader.GetDateTime(7)),
                RecordedAt:                 reader.GetDateTimeOffset(8),
                IdempotencyKey:             reader.GetString(9)));
        }
        return results;
    }

    public async Task<AnnualExpenseData> GetAnnualExpensesAsync(int year, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT c.ParentCategory, c.Category, " +
            "       MONTH(e.ExpenseDate) AS MonthNum, " +
            "       SUM(e.AmountEur) AS Total " +
            "FROM dbo.AssociationExpenses e " +
            "JOIN dbo.Counterparties c ON c.Id = e.CounterpartyId " +
            "WHERE YEAR(e.ExpenseDate) = @Year " +
            "GROUP BY c.ParentCategory, c.Category, MONTH(e.ExpenseDate);";
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
            "SELECT Id, AmountEur, Description, CounterpartyId, ExpenseDate, RecordedAt, IdempotencyKey " +
            "FROM dbo.AssociationExpenses WHERE IdempotencyKey = @IdempotencyKey;";
        cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return new AssociationExpense(
            Id:             reader.GetGuid(0),
            AmountEur:      reader.GetDecimal(1),
            Description:    reader.GetString(2),
            CounterpartyId: reader.GetGuid(3),
            ExpenseDate:    DateOnly.FromDateTime(reader.GetDateTime(4)),
            RecordedAt:     reader.GetDateTimeOffset(5),
            IdempotencyKey: reader.GetString(6));
    }
}
