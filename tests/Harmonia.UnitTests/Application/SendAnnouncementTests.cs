using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class SendAnnouncementTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    private static SendAnnouncement UseCase(INotificationDispatcher dispatcher, SessionContext? ctx = null)
        => new(new FakeSession(ctx ?? AdminCtx), dispatcher);

    [Fact]
    public async Task Admin_broadcasts_returns_Accepted()
    {
        var dispatcher = new FakeNotificationDispatcher();
        var result = await UseCase(dispatcher).ExecuteAsync("Hello", "Board message");
        Assert.IsType<SendAnnouncementResult.Accepted>(result);
        Assert.Single(dispatcher.BroadcastCalls);
        Assert.Equal("Hello", dispatcher.BroadcastCalls[0].Title);
    }

    [Fact]
    public async Task Non_admin_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var result = await UseCase(new FakeNotificationDispatcher(), ctx)
            .ExecuteAsync("Hello", "Body");
        Assert.IsType<SendAnnouncementResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new SendAnnouncement(new FakeSession(null), new FakeNotificationDispatcher());
        var result = await useCase.ExecuteAsync("Hello", "Body");
        Assert.IsType<SendAnnouncementResult.Refused>(result);
    }

    [Fact]
    public async Task Dispatcher_failure_returns_Failed()
    {
        var result = await UseCase(new FailingNotificationDispatcher())
            .ExecuteAsync("Hello", "Body");
        Assert.IsType<SendAnnouncementResult.Failed>(result);
    }
}
