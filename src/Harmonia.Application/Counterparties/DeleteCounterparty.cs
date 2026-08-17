namespace Harmonia.Application.Counterparties;

public sealed class DeleteCounterparty(ISession session, ICounterpartyStore store)
{
    public async Task<DeleteCounterpartyResult> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new DeleteCounterpartyResult.Refused();
        try
        {
            return await store.DeleteAsync(id, ct) switch
            {
                DeleteCounterpartyStoreResult.Ok       => new DeleteCounterpartyResult.Ok(),
                DeleteCounterpartyStoreResult.HasBills => new DeleteCounterpartyResult.HasBills(),
                DeleteCounterpartyStoreResult.NotFound => new DeleteCounterpartyResult.NotFound(),
                _                                       => new DeleteCounterpartyResult.Failed()
            };
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new DeleteCounterpartyResult.Failed(); }
    }
}
