using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.Application.Notifications;

public sealed class SaveSubscription(ISession session, INotificationStore store)
{
    public async Task<SaveSubscriptionResult> ExecuteAsync(
        string endpoint, string p256dhKey, string authKey,
        string? email, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true })
            return new SaveSubscriptionResult.Refused();
        if (ctx.HouseholdRef is null)
            return new SaveSubscriptionResult.Refused();

        var now = DateTimeOffset.UtcNow;
        var sub = new PushSubscription(
            HouseholdRef:  ctx.HouseholdRef.Value,
            Endpoint:      endpoint,
            P256dhKey:     p256dhKey,
            AuthKey:       authKey,
            FallbackEmail: email,
            CreatedAt:     now,
            UpdatedAt:     now);

        return await store.SaveSubscriptionAsync(sub, ct);
    }
}
