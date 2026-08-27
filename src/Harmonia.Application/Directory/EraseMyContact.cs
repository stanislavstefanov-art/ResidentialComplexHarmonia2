namespace Harmonia.Application.Directory;

/// <summary>
/// Resident Art. 17 self-erase, resolved strictly by their own Entra OID — never by role,
/// which two residents can share (R2, and the actual bug this fixes: erasing your own
/// contact must never delete a co-resident's data).
/// </summary>
public sealed class EraseMyContact(ISession session, IDirectoryStore store)
{
    public async Task<EraseContactResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true, HouseholdRef: not null, EntraObjectId: not null })
            return new EraseContactResult.Refused();
        try
        {
            return await store.DeleteContactByOidAsync(ctx.EntraObjectId, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new EraseContactResult.Failed(); }
    }
}
