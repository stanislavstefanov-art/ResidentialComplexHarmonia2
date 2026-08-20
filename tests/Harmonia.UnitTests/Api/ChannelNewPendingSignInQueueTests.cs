using Harmonia.Api.Adapters;
using Harmonia.Application.PendingSignIn;

namespace Harmonia.UnitTests.Api;

public class ChannelNewPendingSignInQueueTests
{
    private static NewPendingSignIn Signal() => new(DateTimeOffset.UtcNow);

    [Fact]
    public async Task Enqueued_signal_can_be_dequeued()
    {
        var queue = new ChannelNewPendingSignInQueue();
        queue.Enqueue(Signal());

        var received = await queue.DequeueAsync(CancellationToken.None);

        Assert.NotEqual(default, received.OccurredAt);
    }

    [Fact]
    public void DrainPending_reports_and_clears_everything_still_waiting()
    {
        var queue = new ChannelNewPendingSignInQueue();
        queue.Enqueue(Signal());
        queue.Enqueue(Signal());
        queue.Enqueue(Signal());

        Assert.Equal(3, queue.DrainPending());
        Assert.Equal(0, queue.DrainPending());
    }

    [Fact]
    public void Enqueue_past_capacity_neither_throws_nor_blocks()
    {
        // Enqueue runs inside session resolution. A full queue must degrade by
        // dropping, never by throwing into the authentication path.
        var queue = new ChannelNewPendingSignInQueue();

        for (var i = 0; i < 500; i++)
            queue.Enqueue(Signal());

        Assert.Equal(100, queue.DrainPending());
    }

    [Fact]
    public async Task DequeueAsync_honours_cancellation_while_empty()
    {
        var queue = new ChannelNewPendingSignInQueue();
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            async () => await queue.DequeueAsync(cts.Token));
    }
}
