using Harmonia.Domain;

namespace Harmonia.Application.Directory;

/// <summary>
/// Admin-only: fully removes a resident by deleting their HouseholdContacts row and
/// HouseholdLinks row. After this the resident's Entra account is unlinked and they
/// re-enter the pending flow on next sign-in.
/// householdRef and role come from the URL path parameters (R2).
/// R3: householdRef is never logged here.
/// </summary>
public sealed class RemoveResident(ISession session, IDirectoryStore store)
{
    public async Task<RemoveResidentResult> ExecuteAsync(
        string householdRef, string role, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new RemoveResidentResult.Refused();
        try
        {
            return await store.RemoveResidentAsync(new HouseholdRef(householdRef), role, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new RemoveResidentResult.Failed(); }
    }
}
