// src/Harmonia.Domain/Notifications/PushSubscription.cs
namespace Harmonia.Domain.Notifications;

public sealed record PushSubscription(
    HouseholdRef   HouseholdRef,
    string         Endpoint,
    string         P256dhKey,
    string         AuthKey,
    string?        FallbackEmail,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
