namespace Harmonia.Application.Households;

public sealed class GetHouseholds(ISession session, IHouseholdStore store)
{
    public async Task<GetHouseholdsResult> ExecuteAsync(CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new GetHouseholdsResult.Refused();
        try
        {
            return new GetHouseholdsResult.Ok(await store.ListAsync(ct));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new GetHouseholdsResult.Failed(); }
    }
}
