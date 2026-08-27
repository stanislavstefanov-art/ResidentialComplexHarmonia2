using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

/// <summary>
/// Board-only: sets DepartedAt for a resident, starting the 1-year retention clock (ADR-0004).
/// householdRef sourced from URL path param (R2). role defaults to "Owner" for backward
/// compatibility with the current admin UI (see EraseContact's doc comment for the same
/// rationale).
/// </summary>
public sealed class MarkDeparted(ISession session, IDirectoryStore store)
{
    public async Task<MarkDepartedResult> ExecuteAsync(
        string householdRef, string role = "Owner", CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new MarkDepartedResult.Refused();
        try
        {
            return await store.MarkDepartedAsync(new HouseholdRef(householdRef), role, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new MarkDepartedResult.Failed(); }
    }
}
