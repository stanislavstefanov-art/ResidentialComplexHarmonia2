using Harmonia.Api.Notifications;
using Harmonia.Application.Notifications;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;
using Microsoft.Extensions.Logging.Abstractions;

namespace Harmonia.UnitTests.Api;

public class PendingSignInNotifierTests
{
    private static (FakeNotificationStore Store, FakeNotificationDispatcher Dispatcher) Wiring()
    {
        var store = new FakeNotificationStore();
        store.AdminRefs.Add(new HouseholdRef("HH-admin"));
        return (store, new FakeNotificationDispatcher());
    }

    [Fact]
    public async Task One_signal_produces_one_dispatch_round()
    {
        var (store, dispatcher) = Wiring();
        var queue = new FakeNewPendingSignInQueue();
        queue.Enqueue(new NewPendingSignIn(DateTimeOffset.UtcNow));
        var notifier = new PendingSignInNotifier(
            queue, new NotifyAdminsOfPendingSignIn(store, dispatcher),
            NullLogger<PendingSignInNotifier>.Instance);

        await notifier.StartAsync(CancellationToken.None);
        await notifier.StopAsync(CancellationToken.None);

        Assert.Single(dispatcher.DispatchCalls);
    }

    [Fact]
    public async Task A_burst_of_signals_is_coalesced_into_one_dispatch_round()
    {
        // Three sign-ups seconds apart are one piece of news, and one round instead
        // of three keeps the database from being woken repeatedly.
        var (store, dispatcher) = Wiring();
        var queue = new FakeNewPendingSignInQueue();
        for (var i = 0; i < 3; i++) queue.Enqueue(new NewPendingSignIn(DateTimeOffset.UtcNow));
        var notifier = new PendingSignInNotifier(
            queue, new NotifyAdminsOfPendingSignIn(store, dispatcher),
            NullLogger<PendingSignInNotifier>.Instance);

        await notifier.StartAsync(CancellationToken.None);
        await notifier.StopAsync(CancellationToken.None);

        Assert.Single(dispatcher.DispatchCalls);
    }

    [Fact]
    public async Task A_failing_dispatch_does_not_kill_the_service()
    {
        var store = new FakeNotificationStore();
        store.AdminRefs.Add(new HouseholdRef("HH-admin"));
        var queue = new FakeNewPendingSignInQueue();
        queue.Enqueue(new NewPendingSignIn(DateTimeOffset.UtcNow));
        var notifier = new PendingSignInNotifier(
            queue, new NotifyAdminsOfPendingSignIn(store, new FailingNotificationDispatcher()),
            NullLogger<PendingSignInNotifier>.Instance);

        await notifier.StartAsync(CancellationToken.None);
        var stop = notifier.StopAsync(CancellationToken.None);

        await stop; // must complete rather than fault
        Assert.True(stop.IsCompletedSuccessfully);
    }
}
