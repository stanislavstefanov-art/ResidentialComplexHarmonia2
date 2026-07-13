using Harmonia.Domain;

namespace Harmonia.Application.Notifications;

public sealed class RemoveSubscription(ISession session, INotificationStore store)
{
    public async Task<RemoveSubscriptionResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true })
            return new RemoveSubscriptionResult.Refused();
        if (ctx.HouseholdRef is null)
            return new RemoveSubscriptionResult.Refused();

        return await store.RemoveSubscriptionAsync(ctx.HouseholdRef.Value, ct);
    }
}
