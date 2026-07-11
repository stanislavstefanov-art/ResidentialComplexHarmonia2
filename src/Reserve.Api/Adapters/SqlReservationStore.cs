using System.Data;
using Microsoft.Data.SqlClient;
using Reserve.Application;
using Reserve.Domain;

namespace Reserve.Api.Adapters;

/// <summary>
/// SQL Server adapter for <see cref="IReservationStore"/> — the only place SQL lives.
///
/// R1 (ADR-0002): the claim is ONE parameterized INSERT; the unique key on
/// (DayDate, SlotKey) decides the race inside the engine. Unique violations
/// 2601/2627 mean "already held" — the follow-up read only classifies an
/// already-lost race (me vs other) and is never part of the winner decision.
/// There is no read-then-write on this path.
/// </summary>
public sealed class SqlReservationStore(string connectionString) : IReservationStore
{
    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;

    private readonly string _connectionString = connectionString;

    public async Task<IReadOnlyDictionary<string, HouseholdRef>> GetDayHoldersAsync(
        DateOnly day, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT SlotKey, HouseholdRef FROM dbo.Reservations WHERE DayDate = @Day;";
        cmd.Parameters.Add(DayParameter(day));

        var holders = new Dictionary<string, HouseholdRef>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            holders[reader.GetString(0)] = new HouseholdRef(reader.GetString(1));
        }

        return holders;
    }

    public async Task<ClaimResult> ClaimSlotAsync(
        DateOnly day, string slotKey, HouseholdRef householdRef, CancellationToken ct = default)
    {
        try
        {
            // R1: the winner is decided HERE, by the engine's unique key — one INSERT,
            // no prior availability read.
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "INSERT INTO dbo.Reservations (DayDate, SlotKey, HouseholdRef) " +
                "VALUES (@Day, @SlotKey, @HouseholdRef);";
            cmd.Parameters.Add(DayParameter(day));
            cmd.Parameters.AddWithValue("@SlotKey", slotKey);
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            await cmd.ExecuteNonQueryAsync(ct);
            return ClaimResult.Claimed;
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            // Already held. This read only CLASSIFIES an already-lost race (me vs other);
            // it is never part of the winner decision.
            return await ClassifyExistingHolderAsync(day, slotKey, householdRef, ct);
        }
        catch (SqlException)
        {
            return ClaimResult.Unavailable; // timeout / connection / unknown engine error
        }
        catch (InvalidOperationException)
        {
            return ClaimResult.Unavailable; // e.g. connection-pool timeout
        }
    }

    private async Task<ClaimResult> ClassifyExistingHolderAsync(
        DateOnly day, string slotKey, HouseholdRef me, CancellationToken ct)
    {
        try
        {
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "SELECT HouseholdRef FROM dbo.Reservations " +
                "WHERE DayDate = @Day AND SlotKey = @SlotKey;";
            cmd.Parameters.Add(DayParameter(day));
            cmd.Parameters.AddWithValue("@SlotKey", slotKey);

            var holder = await cmd.ExecuteScalarAsync(ct) as string;
            return holder is null
                ? ClaimResult.Unavailable // v1 never deletes holds; vanished row = unknown state
                : new HouseholdRef(holder) == me
                    ? ClaimResult.AlreadyHeldByMe
                    : ClaimResult.AlreadyHeldByOther;
        }
        catch (SqlException)
        {
            return ClaimResult.Unavailable;
        }
    }

    private static SqlParameter DayParameter(DateOnly day)
        => new("@Day", SqlDbType.Date) { Value = day.ToDateTime(TimeOnly.MinValue) };
}
