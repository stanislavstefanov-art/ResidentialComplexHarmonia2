using Harmonia.Domain;

namespace Harmonia.Application.Notifications;

public sealed class GetNotificationHistory(ISession session, INotificationStore store)
{
    public async Task<GetNotificationHistoryResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new GetNotificationHistoryResult.Refused();
        if (ctx.HouseholdRef is null)
            return new GetNotificationHistoryResult.Refused();

        try
        {
            var records = await store.GetHistoryAsync(ctx.HouseholdRef.Value, ct);
            return new GetNotificationHistoryResult.Ok(records);
        }
        catch (Exception)
        {
            return new GetNotificationHistoryResult.Failed();
        }
    }
}
