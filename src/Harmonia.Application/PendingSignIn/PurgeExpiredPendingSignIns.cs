namespace Harmonia.Application.PendingSignIn;

public abstract record PurgeExpiredPendingResult
{
    private PurgeExpiredPendingResult() { }
    public sealed record Refused         : PurgeExpiredPendingResult;
    public sealed record Failed          : PurgeExpiredPendingResult;
    public sealed record Ok(int Deleted) : PurgeExpiredPendingResult;
}

public sealed class PurgeExpiredPendingSignIns(ISession session, IPendingSignInStore store)
{
    private static readonly TimeSpan RetentionWindow = TimeSpan.FromDays(90);

    public async Task<PurgeExpiredPendingResult> ExecuteAsync(CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new PurgeExpiredPendingResult.Refused();
        try
        {
            var cutoff  = DateTimeOffset.UtcNow - RetentionWindow;
            var deleted = await store.PurgeExpiredAsync(cutoff, ct);
            return new PurgeExpiredPendingResult.Ok(deleted);
        }
        catch
        {
            return new PurgeExpiredPendingResult.Failed();
        }
    }
}
