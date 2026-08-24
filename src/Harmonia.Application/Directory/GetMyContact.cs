namespace Harmonia.Application.Directory;

/// <summary>
/// Returns the current resident's own contact record, resolved strictly by their own Entra
/// OID — never by role, which two residents can share (R2, and the actual bug this fixes).
/// </summary>
public sealed class GetMyContact(ISession session, IDirectoryStore store)
{
    public async Task<GetMyContactResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { HouseholdRef: not null, EntraObjectId: not null })
            return new GetMyContactResult.Refused();

        try
        {
            var contact = await store.GetContactByOidAsync(ctx.EntraObjectId, ct);
            return contact is null
                ? new GetMyContactResult.NotFound()
                : new GetMyContactResult.Ok(contact);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new GetMyContactResult.Failed(); }
    }
}
