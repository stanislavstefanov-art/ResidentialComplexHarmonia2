namespace Harmonia.Application.Counterparties;

public sealed class GetCounterparty(ISession session, ICounterpartyStore store)
{
    public async Task<GetCounterpartyResult> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new GetCounterpartyResult.Refused();
        try
        {
            var found = await store.GetAsync(id, ct);
            return found is null
                ? new GetCounterpartyResult.NotFound()
                : new GetCounterpartyResult.Ok(found);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new GetCounterpartyResult.Failed(); }
    }
}
