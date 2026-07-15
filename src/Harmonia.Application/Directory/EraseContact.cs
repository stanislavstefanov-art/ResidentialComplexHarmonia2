using Harmonia.Application;
using Harmonia.Domain;

namespace Harmonia.Application.Directory;

/// <summary>
/// Board DSAR hard-delete. Requires IsAdmin.
/// householdRef comes from the URL path parameter — never from the request body (R2).
/// </summary>
public sealed class EraseContact(ISession session, IDirectoryStore store)
{
    public async Task<EraseContactResult> ExecuteAsync(
        string householdRef, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new EraseContactResult.Refused();
        try
        {
            return await store.DeleteContactAsync(new HouseholdRef(householdRef), ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new EraseContactResult.Failed(); }
    }
}
