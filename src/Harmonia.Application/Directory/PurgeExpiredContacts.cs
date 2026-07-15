namespace Harmonia.Application.Directory;

/// <summary>
/// Board-only: hard-deletes all HouseholdContacts rows where DepartedAt &lt; NOW() - 1 year (ADR-0004).
/// </summary>
public sealed class PurgeExpiredContacts(ISession session, IDirectoryStore store)
{
    public async Task<PurgeExpiredContactsResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new PurgeExpiredContactsResult.Refused();
        try
        {
            return await store.PurgeExpiredContactsAsync(ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new PurgeExpiredContactsResult.Failed(); }
    }
}
