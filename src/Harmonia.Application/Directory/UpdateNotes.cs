using Harmonia.Domain;

namespace Harmonia.Application.Directory;

public sealed class UpdateNotes(ISession session, IDirectoryStore store)
{
    public async Task<UpdateNotesResult> ExecuteAsync(
        string householdRef, string? notes,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new UpdateNotesResult.Refused();

        try
        {
            return await store.UpsertNotesAsync(new HouseholdRef(householdRef), notes, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateNotesResult.Failed();
        }
    }
}
