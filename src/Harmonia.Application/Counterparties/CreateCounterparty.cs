namespace Harmonia.Application.Counterparties;

public sealed class CreateCounterparty(ISession session, ICounterpartyStore store)
{
    public async Task<CreateCounterpartyResult> ExecuteAsync(
        string name, string category, string parentCategory,
        string? vatNumber, string? phone, string? email, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new CreateCounterpartyResult.Refused();
        try
        {
            var created = await store.CreateAsync(name, category, parentCategory, vatNumber, phone, email, ct);
            return new CreateCounterpartyResult.Created(created);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new CreateCounterpartyResult.Failed(); }
    }
}
