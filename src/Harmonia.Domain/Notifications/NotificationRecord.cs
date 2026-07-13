// src/Harmonia.Domain/Notifications/NotificationRecord.cs
namespace Harmonia.Domain.Notifications;

// Channel: "push" | "email" | "skipped"
public sealed record NotificationRecord(
    Guid           Id,
    HouseholdRef   HouseholdRef,
    string         Title,
    DateTimeOffset SentAt,
    string         Channel);
