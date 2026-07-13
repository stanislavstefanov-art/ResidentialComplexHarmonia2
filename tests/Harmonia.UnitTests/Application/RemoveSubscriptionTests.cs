using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class RemoveSubscriptionTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-REM-1"));

    private static RemoveSubscription UseCase(INotificationStore store, SessionContext? ctx = null)
        => new(new FakeSession(ctx ?? ResidentCtx), store);

    [Fact]
    public async Task Resident_removes_existing_subscription_returns_Removed()
    {
        var store = new FakeNotificationStore();
        await new SaveSubscription(new FakeSession(ResidentCtx), store)
            .ExecuteAsync("https://push.example.com/x", "k", "a", null);

        var result = await UseCase(store).ExecuteAsync();

        Assert.IsType<RemoveSubscriptionResult.Removed>(result);
    }

    [Fact]
    public async Task Resident_removes_nonexistent_returns_NotFound()
    {
        var result = await UseCase(new FakeNotificationStore()).ExecuteAsync();
        Assert.IsType<RemoveSubscriptionResult.NotFound>(result);
    }

    [Fact]
    public async Task Non_resident_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx).ExecuteAsync();
        Assert.IsType<RemoveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new RemoveSubscription(new FakeSession(null), new FakeNotificationStore());
        var result = await useCase.ExecuteAsync();
        Assert.IsType<RemoveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_without_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx).ExecuteAsync();
        Assert.IsType<RemoveSubscriptionResult.Refused>(result);
    }
}
