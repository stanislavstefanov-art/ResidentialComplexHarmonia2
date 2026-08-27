using Harmonia.Application;
using Harmonia.Domain;

namespace Harmonia.Application.Directory;

/// <summary>
/// Board DSAR hard-delete. Requires IsAdmin.
/// householdRef comes from the URL path parameter — never from the request body (R2).
/// role defaults to "Owner" for backward compatibility with the current admin UI, which does
/// not yet expose a resident picker for a household with more than one same-role resident —
/// that picker ships as a follow-up slice (see spec's accepted limitation).
/// </summary>
public sealed class EraseContact(ISession session, IDirectoryStore store)
{
    public async Task<EraseContactResult> ExecuteAsync(
        string householdRef, string role = "Owner", CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new EraseContactResult.Refused();
        try
        {
            return await store.DeleteContactAsync(new HouseholdRef(householdRef), role, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new EraseContactResult.Failed(); }
    }
}
