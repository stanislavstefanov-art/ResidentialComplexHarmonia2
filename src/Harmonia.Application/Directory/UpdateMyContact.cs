namespace Harmonia.Application.Directory;

/// <summary>
/// Lets a resident update their own contact details, resolved strictly by their own Entra
/// OID — never by role, which two residents can share (R2, and the actual bug this fixes).
/// </summary>
public sealed class UpdateMyContact(ISession session, IDirectoryStore store)
{
    public async Task<UpdateContactResult> ExecuteAsync(
        string? displayName, string? phone, string? email, bool? isOptedOut = null,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { HouseholdRef: not null, EntraObjectId: not null })
            return new UpdateContactResult.Refused();

        try
        {
            return await store.UpsertContactByOidAsync(
                ctx.EntraObjectId, displayName, phone, email, isOptedOut, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new UpdateContactResult.Failed(); }
    }
}
