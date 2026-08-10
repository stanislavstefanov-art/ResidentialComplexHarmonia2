using Harmonia.Domain;

namespace Harmonia.Application.Households;

public sealed class DeleteHousehold(ISession session, IHouseholdStore store)
{
    public async Task<DeleteHouseholdResult> ExecuteAsync(
        string householdRef, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new DeleteHouseholdResult.Refused();
        try
        {
            return await store.DeleteAsync(new HouseholdRef(householdRef), ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new DeleteHouseholdResult.Failed(); }
    }
}
