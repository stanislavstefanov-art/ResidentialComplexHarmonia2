namespace Harmonia.Application.Notifications;

/// <summary>
/// Tells every admin that a new sign-up is awaiting admission.
///
/// Deliberately has NO session check, unlike every other use case. This one is
/// system-initiated: there is no caller and no request. R2 governs acting on
/// behalf of a caller, and the recipient list is read from the store, never from
/// request input — so the rule is satisfied, not bypassed.
///
/// R3: the dispatched payload names nobody (see VapidPushDispatcher.BodyFor).
/// </summary>
public sealed class NotifyAdminsOfPendingSignIn(
    INotificationStore store, INotificationDispatcher dispatcher)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        foreach (var adminRef in await store.GetAdminHouseholdRefsAsync(ct))
            await dispatcher.DispatchAsync(NotificationKind.PendingSignIn, adminRef, ct);
    }
}
