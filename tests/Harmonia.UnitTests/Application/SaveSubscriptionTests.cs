using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class SaveSubscriptionTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-SUB-1"));

    private static SaveSubscription UseCase(INotificationStore store, SessionContext? ctx = null)
        => new(new FakeSession(ctx ?? ResidentCtx), store);

    [Fact]
    public async Task Resident_creates_new_subscription_returns_Saved_IsNew_true()
    {
        var store = new FakeNotificationStore();
        var result = await UseCase(store).ExecuteAsync(
            "https://push.example.com/abc", "p256key", "authkey", "test@example.com");
        var saved = Assert.IsType<SaveSubscriptionResult.Saved>(result);
        Assert.True(saved.IsNew);
        Assert.Equal(new HouseholdRef("HH-SUB-1"), saved.Subscription.HouseholdRef);
        Assert.Equal("test@example.com", saved.Subscription.FallbackEmail);
    }

    [Fact]
    public async Task Resident_re_saves_subscription_returns_Saved_IsNew_false()
    {
        var store = new FakeNotificationStore();
        await UseCase(store).ExecuteAsync("https://push.example.com/abc", "p256key", "authkey", null);
        var result = await UseCase(store).ExecuteAsync("https://push.example.com/new", "k2", "a2", null);
        var saved = Assert.IsType<SaveSubscriptionResult.Saved>(result);
        Assert.False(saved.IsNew);
    }

    [Fact]
    public async Task Non_resident_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx)
            .ExecuteAsync("https://push.example.com/abc", "k", "a", null);
        Assert.IsType<SaveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new SaveSubscription(new FakeSession(null), new FakeNotificationStore());
        var result = await useCase.ExecuteAsync("https://push.example.com/abc", "k", "a", null);
        Assert.IsType<SaveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_without_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx)
            .ExecuteAsync("https://push.example.com/abc", "k", "a", null);
        Assert.IsType<SaveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var result = await UseCase(new FailingNotificationStore())
            .ExecuteAsync("https://push.example.com/abc", "k", "a", null);
        Assert.IsType<SaveSubscriptionResult.Failed>(result);
    }
}
