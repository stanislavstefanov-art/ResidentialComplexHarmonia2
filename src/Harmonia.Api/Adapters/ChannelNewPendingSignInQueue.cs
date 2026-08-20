using System.Threading.Channels;
using Harmonia.Application.PendingSignIn;

namespace Harmonia.Api.Adapters;

/// <summary>
/// Bounded in-memory queue. Dropping under pressure is correct rather than merely
/// tolerable: the message is "someone is waiting", not "this person is waiting", so
/// a signal already queued fully covers a dropped one. DropWrite also guarantees
/// Enqueue never blocks the request thread.
/// </summary>
public sealed class ChannelNewPendingSignInQueue : INewPendingSignInQueue
{
    private const int Capacity = 100;

    private readonly Channel<NewPendingSignIn> _channel =
        Channel.CreateBounded<NewPendingSignIn>(new BoundedChannelOptions(Capacity)
        {
            FullMode     = BoundedChannelFullMode.DropWrite,
            SingleReader = true,
        });

    public void Enqueue(NewPendingSignIn signal) => _channel.Writer.TryWrite(signal);

    public ValueTask<NewPendingSignIn> DequeueAsync(CancellationToken ct)
        => _channel.Reader.ReadAsync(ct);

    public int DrainPending()
    {
        var drained = 0;
        while (_channel.Reader.TryRead(out _)) drained++;
        return drained;
    }
}
