using Harmonia.Domain;

namespace Harmonia.Application.MaintenanceFees;

/// <summary>
/// Use case: list all maintenance fee charges for a household.
/// Residents may only read their own household's ledger.
/// Admins may read any household's ledger.
/// </summary>
public sealed class ListCharges(ISession session, IMaintenanceFeeStore store)
{
    public async Task<ListChargesResult> ExecuteAsync(
        HouseholdRef targetHousehold, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is null)
            return new ListChargesResult.Refused();

        if (!ctx.IsAdmin)
        {
            if (!ctx.IsResident || ctx.HouseholdRef != targetHousehold)
                return new ListChargesResult.Refused();
        }

        var charges = await store.ListChargesAsync(targetHousehold, ct);
        return new ListChargesResult.Ok(charges);
    }
}
