namespace Harmonia.Application.Directory;

/// <summary>
/// Resident Art. 17 self-erase. HouseholdRef is sourced exclusively from the verified session (R2).
/// </summary>
public sealed class EraseMyContact(ISession session, IDirectoryStore store)
{
    public async Task<EraseContactResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true, HouseholdRef: not null })
            return new EraseContactResult.Refused();
        try
        {
            return await store.DeleteContactAsync(ctx.HouseholdRef.Value, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new EraseContactResult.Failed(); }
    }
}
