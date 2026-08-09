using Harmonia.Domain;

namespace Harmonia.Application.Households;

public sealed class UpsertHousehold(ISession session, IHouseholdStore store)
{
    public async Task<UpsertHouseholdResult> ExecuteAsync(
        string householdRef, decimal sqMeters, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new UpsertHouseholdResult.Refused();
        try
        {
            return await store.UpsertAsync(new HouseholdRef(householdRef), sqMeters, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new UpsertHouseholdResult.Failed(); }
    }
}
