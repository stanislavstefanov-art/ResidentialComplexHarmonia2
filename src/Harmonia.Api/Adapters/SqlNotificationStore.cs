// src/Harmonia.Api/Adapters/SqlNotificationStore.cs
using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// SQL adapter for push subscriptions and notification history.
/// Subscription columns (Endpoint, P256dhKey, AuthKey, FallbackEmail) are personal data (R3) —
/// never passed to ILogger calls.
/// </summary>
public sealed class SqlNotificationStore(string connectionString) : INotificationStore
{
    public async Task<SaveSubscriptionResult> SaveSubscriptionAsync(
        PushSubscription sub, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                DECLARE @result TABLE (act nvarchar(10), createdAt datetimeoffset(3));
                MERGE dbo.PushSubscriptions AS t
                USING (VALUES (
                    @HouseholdRef, @Endpoint, @P256dhKey, @AuthKey, @FallbackEmail, @Now
                )) AS s (HouseholdRef, Endpoint, P256dhKey, AuthKey, FallbackEmail, UpdatedAt)
                ON t.HouseholdRef = s.HouseholdRef
                WHEN MATCHED THEN
                    UPDATE SET Endpoint      = s.Endpoint,
                               P256dhKey     = s.P256dhKey,
                               AuthKey       = s.AuthKey,
                               FallbackEmail = s.FallbackEmail,
                               UpdatedAt     = s.UpdatedAt
                WHEN NOT MATCHED THEN
                    INSERT (HouseholdRef, Endpoint, P256dhKey, AuthKey, FallbackEmail, CreatedAt, UpdatedAt)
                    VALUES (s.HouseholdRef, s.Endpoint, s.P256dhKey, s.AuthKey,
                            s.FallbackEmail, s.UpdatedAt, s.UpdatedAt)
                OUTPUT $action, INSERTED.CreatedAt INTO @result;
                SELECT act, createdAt FROM @result;
                """;
            cmd.Parameters.AddWithValue("@HouseholdRef", sub.HouseholdRef.Value);
            cmd.Parameters.AddWithValue("@Endpoint", sub.Endpoint);
            cmd.Parameters.AddWithValue("@P256dhKey", sub.P256dhKey);
            cmd.Parameters.AddWithValue("@AuthKey", sub.AuthKey);
            cmd.Parameters.Add(new SqlParameter("@FallbackEmail", SqlDbType.NVarChar, 320)
                { Value = (object?)sub.FallbackEmail ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Now", SqlDbType.DateTimeOffset) { Value = DateTimeOffset.UtcNow });

            await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);
            var action    = reader.GetString(0);
            var createdAt = reader.GetDateTimeOffset(1);
            var isNew     = action == "INSERT";

            var stored = sub with { CreatedAt = createdAt };
            return new SaveSubscriptionResult.Saved(stored, isNew);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new SaveSubscriptionResult.Failed();
        }
    }

    public async Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM dbo.PushSubscriptions WHERE HouseholdRef = @HouseholdRef;";
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return rows > 0
                ? new RemoveSubscriptionResult.Removed()
                : new RemoveSubscriptionResult.NotFound();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new RemoveSubscriptionResult.Failed();
        }
    }

    public async Task<PushSubscription?> GetSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, Endpoint, P256dhKey, AuthKey, FallbackEmail, CreatedAt, UpdatedAt " +
            "FROM dbo.PushSubscriptions WHERE HouseholdRef = @HouseholdRef;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return ReadSubscription(reader);
    }

    public async Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, Endpoint, P256dhKey, AuthKey, FallbackEmail, CreatedAt, UpdatedAt " +
            "FROM dbo.PushSubscriptions;";
        var list = new List<PushSubscription>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(ReadSubscription(reader));
        return list;
    }

    public async Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "INSERT INTO dbo.NotificationHistory (Id, HouseholdRef, Title, SentAt, Channel) " +
            "VALUES (@Id, @HouseholdRef, @Title, @SentAt, @Channel);";
        cmd.Parameters.AddWithValue("@Id", record.Id);
        cmd.Parameters.AddWithValue("@HouseholdRef", record.HouseholdRef.Value);
        cmd.Parameters.AddWithValue("@Title", record.Title);
        cmd.Parameters.Add(new SqlParameter("@SentAt", SqlDbType.DateTimeOffset) { Value = record.SentAt });
        cmd.Parameters.AddWithValue("@Channel", record.Channel);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        // R3: householdRef.Value is not passed to any ILogger call in this method.
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, Title, SentAt, Channel " +
            "FROM dbo.NotificationHistory " +
            "WHERE HouseholdRef = @HouseholdRef " +
            "  AND SentAt >= DATEADD(day, -30, SYSUTCDATETIME()) " +
            "ORDER BY SentAt DESC;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        var list = new List<NotificationRecord>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(new NotificationRecord(
                Id:           reader.GetGuid(0),
                HouseholdRef: new HouseholdRef(reader.GetString(1)),
                Title:        reader.GetString(2),
                SentAt:       reader.GetDateTimeOffset(3),
                Channel:      reader.GetString(4)));
        }
        return list;
    }

    private static PushSubscription ReadSubscription(SqlDataReader r) =>
        new(HouseholdRef:  new HouseholdRef(r.GetString(0)),
            Endpoint:      r.GetString(1),
            P256dhKey:     r.GetString(2),
            AuthKey:       r.GetString(3),
            FallbackEmail: r.IsDBNull(4) ? null : r.GetString(4),
            CreatedAt:     r.GetDateTimeOffset(5),
            UpdatedAt:     r.GetDateTimeOffset(6));
}
