// src/Harmonia.Api/Adapters/NoOpNotificationDispatcher.cs
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Microsoft.Extensions.Logging;

namespace Harmonia.Api.Adapters;

// Used in Development when ACS credentials are not configured locally.
// Logs what would be sent instead of making real network calls.
public sealed class NoOpNotificationDispatcher(ILogger<NoOpNotificationDispatcher> logger)
    : INotificationDispatcher
{
    public Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default)
    {
        logger.LogInformation("[NoOp] Would dispatch {Kind} notification to household {Ref}", kind, householdRef.Value);
        return Task.CompletedTask;
    }

    public Task BroadcastAsync(string title, string body, CancellationToken ct = default)
    {
        logger.LogInformation("[NoOp] Would broadcast: {Title} — {Body}", title, body);
        return Task.CompletedTask;
    }
}
