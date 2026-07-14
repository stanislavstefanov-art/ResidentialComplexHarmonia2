namespace Harmonia.Application.Directory;

public sealed class UpdateMyContact(ISession session, IDirectoryStore store)
{
    public async Task<UpdateContactResult> ExecuteAsync(
        string? displayName, string? phone, string? email,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true, HouseholdRef: not null })
            return new UpdateContactResult.Refused();

        return await store.UpsertContactAsync(ctx.HouseholdRef.Value, displayName, phone, email, ct);
    }
}
