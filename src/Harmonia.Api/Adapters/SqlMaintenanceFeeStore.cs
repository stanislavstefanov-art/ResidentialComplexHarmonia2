using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// SQL Server adapter for <see cref="IMaintenanceFeeStore"/>.
/// Append-only: no UPDATE or DELETE ever executed.
/// Idempotency: PK on (HouseholdRef, IdempotencyKey) — a duplicate INSERT returns the existing row.
/// HouseholdRef values are personal data (R3) and must never appear in log lines.
/// </summary>
public sealed class SqlMaintenanceFeeStore(string connectionString) : IMaintenanceFeeStore
{
    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;

    public async Task<RecordChargeResult> RecordChargeAsync(
        MaintenanceFeeCharge charge, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "INSERT INTO dbo.MaintenanceFeeCharges " +
                "(Id, HouseholdRef, AmountEur, Description, Period, ChargedAt, IdempotencyKey) " +
                "VALUES (@Id, @HouseholdRef, @AmountEur, @Description, @Period, @ChargedAt, @IdempotencyKey);";
            cmd.Parameters.AddWithValue("@Id", charge.Id);
            cmd.Parameters.AddWithValue("@HouseholdRef", charge.HouseholdRef.Value);
            cmd.Parameters.Add(new SqlParameter("@AmountEur", SqlDbType.Decimal) { Value = charge.AmountEur, Precision = 18, Scale = 2 });
            cmd.Parameters.AddWithValue("@Description", charge.Description);
            cmd.Parameters.AddWithValue("@Period", charge.Period);
            cmd.Parameters.Add(new SqlParameter("@ChargedAt", SqlDbType.DateTimeOffset) { Value = charge.ChargedAt });
            cmd.Parameters.AddWithValue("@IdempotencyKey", charge.IdempotencyKey);
            await cmd.ExecuteNonQueryAsync(ct);
            return new RecordChargeResult.Created(charge);
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            var existing = await LoadExistingAsync(charge.HouseholdRef, charge.IdempotencyKey, ct);
            return new RecordChargeResult.Duplicate(existing);
        }
        catch (Exception)
        {
            return new RecordChargeResult.Failed();
        }
    }

    public async Task<IReadOnlyList<MaintenanceFeeCharge>> ListChargesAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Description, Period, ChargedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeeCharges " +
            "WHERE HouseholdRef = @HouseholdRef " +
            "ORDER BY ChargedAt DESC;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);

        var results = new List<MaintenanceFeeCharge>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new MaintenanceFeeCharge(
                Id: reader.GetGuid(0),
                HouseholdRef: new HouseholdRef(reader.GetString(1)),
                AmountEur: reader.GetDecimal(2),
                Description: reader.GetString(3),
                Period: reader.GetString(4),
                ChargedAt: reader.GetDateTimeOffset(5),
                IdempotencyKey: reader.GetString(6)));
        }
        return results;
    }

    public async Task<IReadOnlyList<MaintenanceFeeCharge>> ListAllChargesAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Description, Period, ChargedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeeCharges " +
            "ORDER BY HouseholdRef ASC, ChargedAt DESC;";

        var results = new List<MaintenanceFeeCharge>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new MaintenanceFeeCharge(
                Id: reader.GetGuid(0),
                HouseholdRef: new HouseholdRef(reader.GetString(1)),
                AmountEur: reader.GetDecimal(2),
                Description: reader.GetString(3),
                Period: reader.GetString(4),
                ChargedAt: reader.GetDateTimeOffset(5),
                IdempotencyKey: reader.GetString(6)));
        }
        return results;
    }

    private async Task<MaintenanceFeeCharge> LoadExistingAsync(
        HouseholdRef householdRef, string idempotencyKey, CancellationToken ct)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, AmountEur, Description, Period, ChargedAt, IdempotencyKey " +
            "FROM dbo.MaintenanceFeeCharges " +
            "WHERE HouseholdRef = @HouseholdRef AND IdempotencyKey = @IdempotencyKey;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return new MaintenanceFeeCharge(
            Id: reader.GetGuid(0),
            HouseholdRef: new HouseholdRef(reader.GetString(1)),
            AmountEur: reader.GetDecimal(2),
            Description: reader.GetString(3),
            Period: reader.GetString(4),
            ChargedAt: reader.GetDateTimeOffset(5),
            IdempotencyKey: reader.GetString(6));
    }
}
