using Harmonia.Domain;

namespace Harmonia.Application.Directory;

public sealed class UpdateContact(ISession session, IDirectoryStore store)
{
    public async Task<UpdateContactResult> ExecuteAsync(
        string householdRef, string? displayName, string? phone, string? email,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new UpdateContactResult.Refused();

        try
        {
            return await store.UpsertContactAsync(
                new HouseholdRef(householdRef), displayName, phone, email, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateContactResult.Failed();
        }
    }
}
