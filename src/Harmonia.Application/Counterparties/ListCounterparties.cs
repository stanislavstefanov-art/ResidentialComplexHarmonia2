namespace Harmonia.Application.Counterparties;

public sealed class ListCounterparties(ISession session, ICounterpartyStore store)
{
    public async Task<ListCounterpartiesResult> ExecuteAsync(CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new ListCounterpartiesResult.Refused();
        try
        {
            return new ListCounterpartiesResult.Ok(await store.ListAsync(ct));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new ListCounterpartiesResult.Failed(); }
    }
}
