namespace Harmonia.Application.Counterparties;

public sealed class UpdateCounterparty(ISession session, ICounterpartyStore store)
{
    public async Task<UpdateCounterpartyResult> ExecuteAsync(
        Guid id, string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new UpdateCounterpartyResult.Refused();
        try
        {
            return await store.UpdateAsync(id, name, category, parentCategory, vatNumber, phone, email, ct) switch
            {
                UpdateCounterpartyStoreResult.Ok ok    => new UpdateCounterpartyResult.Ok(ok.Counterparty),
                UpdateCounterpartyStoreResult.NotFound => new UpdateCounterpartyResult.NotFound(),
                _                                       => new UpdateCounterpartyResult.Failed()
            };
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new UpdateCounterpartyResult.Failed(); }
    }
}
