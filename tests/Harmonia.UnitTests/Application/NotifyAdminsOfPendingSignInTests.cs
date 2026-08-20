using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class NotifyAdminsOfPendingSignInTests
{
    [Fact]
    public async Task Dispatches_once_to_every_admin_household()
    {
        var store = new FakeNotificationStore();
        store.AdminRefs.Add(new HouseholdRef("HH-1"));
        store.AdminRefs.Add(new HouseholdRef("HH-2"));
        var dispatcher = new FakeNotificationDispatcher();

        await new NotifyAdminsOfPendingSignIn(store, dispatcher).ExecuteAsync();

        Assert.Equal(2, dispatcher.DispatchCalls.Count);
        Assert.All(dispatcher.DispatchCalls, d => Assert.Equal(NotificationKind.PendingSignIn, d.Kind));
        Assert.Contains(dispatcher.DispatchCalls, d => d.HouseholdRef.Value == "HH-1");
        Assert.Contains(dispatcher.DispatchCalls, d => d.HouseholdRef.Value == "HH-2");
    }

    [Fact]
    public async Task Dispatches_nothing_when_there_are_no_admins()
    {
        var store = new FakeNotificationStore();
        var dispatcher = new FakeNotificationDispatcher();

        await new NotifyAdminsOfPendingSignIn(store, dispatcher).ExecuteAsync();

        Assert.Empty(dispatcher.DispatchCalls);
    }

    [Fact]
    public async Task Never_broadcasts()
    {
        // Broadcasting would tell every resident that someone is awaiting
        // admission — a privacy leak, not merely noise.
        var store = new FakeNotificationStore();
        store.AdminRefs.Add(new HouseholdRef("HH-1"));
        var dispatcher = new FakeNotificationDispatcher();

        await new NotifyAdminsOfPendingSignIn(store, dispatcher).ExecuteAsync();

        Assert.Empty(dispatcher.BroadcastCalls);
    }
}
