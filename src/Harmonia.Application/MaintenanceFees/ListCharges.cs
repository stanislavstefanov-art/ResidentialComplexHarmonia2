using Harmonia.Domain;

namespace Harmonia.Application.MaintenanceFees;

/// <summary>
/// Use case: list maintenance fee charges for the calling resident's household.
/// Household is always derived from the session (R2). Admin listing is out of scope (spec §2).
/// </summary>
public sealed class ListCharges(ISession session, IMaintenanceFeeStore store)
{
    public async Task<ListChargesResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is null || !ctx.IsResident || ctx.HouseholdRef is null)
            return new ListChargesResult.Refused();

        try
        {
            var charges = await store.ListChargesAsync(ctx.HouseholdRef.Value, ct);
            return new ListChargesResult.Ok(charges);
        }
        catch (Exception)
        {
            return new ListChargesResult.Failed();
        }
    }
}
