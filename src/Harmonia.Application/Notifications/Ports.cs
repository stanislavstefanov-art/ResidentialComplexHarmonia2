// src/Harmonia.Application/Notifications/Ports.cs
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.Application.Notifications;

public abstract record SaveSubscriptionResult
{
    private SaveSubscriptionResult() { }
    public sealed record Refused                                           : SaveSubscriptionResult;
    public sealed record Saved(PushSubscription Subscription, bool IsNew) : SaveSubscriptionResult;
    public sealed record Failed                                            : SaveSubscriptionResult;
}

public abstract record RemoveSubscriptionResult
{
    private RemoveSubscriptionResult() { }
    public sealed record Refused   : RemoveSubscriptionResult;
    public sealed record Removed   : RemoveSubscriptionResult;
    public sealed record NotFound  : RemoveSubscriptionResult;
    public sealed record Failed    : RemoveSubscriptionResult;
}

public abstract record SendAnnouncementResult
{
    private SendAnnouncementResult() { }
    public sealed record Refused  : SendAnnouncementResult;
    public sealed record Accepted : SendAnnouncementResult;
    public sealed record Failed   : SendAnnouncementResult;
}

public abstract record GetNotificationHistoryResult
{
    private GetNotificationHistoryResult() { }
    public sealed record Refused                                            : GetNotificationHistoryResult;
    public sealed record Ok(IReadOnlyList<NotificationRecord> Records)     : GetNotificationHistoryResult;
    public sealed record Failed                                             : GetNotificationHistoryResult;
}

public interface INotificationStore
{
    Task<SaveSubscriptionResult>  SaveSubscriptionAsync(PushSubscription sub, CancellationToken ct = default);
    Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(HouseholdRef householdRef, CancellationToken ct = default);
    Task<PushSubscription?> GetSubscriptionAsync(HouseholdRef householdRef, CancellationToken ct = default);
    Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default);

    Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default);
    Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(HouseholdRef householdRef, CancellationToken ct = default);
}

public enum NotificationKind { ChargePosted, PaymentRecorded, BbqReminder, Announcement }

public interface INotificationDispatcher
{
    Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default);
    Task BroadcastAsync(string title, string body, CancellationToken ct = default);
}
