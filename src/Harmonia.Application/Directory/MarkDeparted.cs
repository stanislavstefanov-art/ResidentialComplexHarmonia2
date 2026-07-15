using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

/// <summary>
/// Board-only: sets DepartedAt for a resident, starting the 1-year retention clock (ADR-0004).
/// householdRef sourced from URL path param (R2).
/// </summary>
public sealed class MarkDeparted(ISession session, IDirectoryStore store)
{
    public async Task<MarkDepartedResult> ExecuteAsync(
        string householdRef, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new MarkDepartedResult.Refused();
        try
        {
            return await store.MarkDepartedAsync(new HouseholdRef(householdRef), ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new MarkDepartedResult.Failed(); }
    }
}
