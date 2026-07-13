using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// SQL Server adapter for <see cref="IPaymentStore"/>.
/// Append-only: no UPDATE or DELETE ever executed.
/// Idempotency: PK on (HouseholdRef, IdempotencyKey) — a duplicate INSERT returns the existing row.
/// HouseholdRef values are personal data (R3) and must never appear in log lines.
/// </summary>
public sealed class SqlPaymentStore(string connectionString) : IPaymentStore
{
    private const int UniqueIndexViolation      = 2601;
    private const int UniqueConstraintViolation = 2627;

    public async Task<RecordPaymentResult> RecordPaymentAsync(
        MaintenanceFeePayment payment, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "INSERT INTO dbo.MaintenanceFeePayments " +
                "(Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey) " +
                "VALUES (@Id, @HouseholdRef, @AmountEur, @Period, @DateReceived, @RecordedAt, @IdempotencyKey);";
            cmd.Parameters.AddWithValue("@Id", payment.Id);
            cmd.Parameters.AddWithValue("@HouseholdRef", payment.HouseholdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal)
                { Value = payment.AmountEur, Precision = 18, Scale = 2 });
            cmd.Parameters.AddWithValue("@Period", payment.Period);
            cmd.Parameters.Add(new SqlParameter("@DateReceived", SqlDbType.Date)
                { Value = payment.DateReceived.ToDateTime(TimeOnly.MinValue) });
            cmd.Parameters.Add(new SqlParameter("@RecordedAt", SqlDbType.DateTimeOffset)
                { Value = payment.RecordedAt });
            cmd.Parameters.AddWithValue("@IdempotencyKey", payment.IdempotencyKey);
            await cmd.ExecuteNonQueryAsync(ct);
            return new RecordPaymentResult.Created(payment);
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            var existing = await LoadExistingAsync(
                payment.HouseholdRef, payment.IdempotencyKey, ct);
            return new RecordPaymentResult.Duplicate(existing);
        }
        catch (Exception)
        {
            return new RecordPaymentResult.Failed();
        }
    }

    public async Task<IReadOnlyList<MaintenanceFeePayment>> ListPaymentsByHouseholdAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeePayments " +
            "WHERE HouseholdRef = @HouseholdRef " +
            "ORDER BY DateReceived DESC;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);

        var results = new List<MaintenanceFeePayment>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    public async Task<IReadOnlyList<MaintenanceFeePayment>> ListAllPaymentsAsync(
        CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeePayments " +
            "ORDER BY HouseholdRef ASC, DateReceived DESC;";

        var results = new List<MaintenanceFeePayment>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            results.Add(ReadRow(reader));
        return results;
    }

    private static MaintenanceFeePayment ReadRow(SqlDataReader r) =>
        new(Id:             r.GetGuid(0),
            HouseholdRef:   new HouseholdRef(r.GetString(1)),
            AmountEur:      r.GetDecimal(2),
            Period:         r.GetString(3),
            DateReceived:   DateOnly.FromDateTime(r.GetDateTime(4)),
            RecordedAt:     r.GetDateTimeOffset(5),
            IdempotencyKey: r.GetString(6));

    private async Task<MaintenanceFeePayment> LoadExistingAsync(
        HouseholdRef householdRef, string idempotencyKey, CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Period, DateReceived, RecordedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeePayments " +
            "WHERE HouseholdRef = @HouseholdRef AND IdempotencyKey = @IdempotencyKey;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return ReadRow(reader);
    }
}
