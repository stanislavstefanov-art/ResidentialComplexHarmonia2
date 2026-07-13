namespace Harmonia.Application.Notifications;

public sealed class SendAnnouncement(ISession session, INotificationDispatcher dispatcher)
{
    public async Task<SendAnnouncementResult> ExecuteAsync(
        string title, string body, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new SendAnnouncementResult.Refused();

        try
        {
            await dispatcher.BroadcastAsync(title, body, ct);
            return new SendAnnouncementResult.Accepted();
        }
        catch (Exception)
        {
            return new SendAnnouncementResult.Failed();
        }
    }
}
