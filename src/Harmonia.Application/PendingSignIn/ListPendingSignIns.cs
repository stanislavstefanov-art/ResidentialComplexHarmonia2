namespace Harmonia.Application.PendingSignIn;

public abstract record ListPendingResult
{
    private ListPendingResult() { }
    public sealed record Refused                                : ListPendingResult;
    public sealed record Ok(IReadOnlyList<PendingSignIn> Items) : ListPendingResult;
}

public sealed class ListPendingSignIns(ISession session, IPendingSignInStore store)
{
    public async Task<ListPendingResult> ExecuteAsync(CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new ListPendingResult.Refused();
        var items = await store.ListAsync(ct);
        return new ListPendingResult.Ok(items);
    }
}
