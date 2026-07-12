using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Application.MaintenanceFees;

public sealed class ListAllCharges(ISession session, IMaintenanceFeeStore store)
{
    public async Task<ListAllChargesResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new ListAllChargesResult.Refused();

        try
        {
            var charges = await store.ListAllChargesAsync(ct);
            return new ListAllChargesResult.Ok(charges);
        }
        catch (Exception)
        {
            return new ListAllChargesResult.Failed();
        }
    }
}
