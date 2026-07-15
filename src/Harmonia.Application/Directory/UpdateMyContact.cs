namespace Harmonia.Application.Directory;

/// <summary>
/// Lets a resident update their own contact details.
/// R2: the target <see cref="HouseholdRef"/> is always taken from <see cref="ISession.Resolve()"/>
/// — never from any caller-supplied parameter.
/// </summary>
public sealed class UpdateMyContact(ISession session, IDirectoryStore store)
{
    public async Task<UpdateContactResult> ExecuteAsync(
        string? displayName, string? phone, string? email, bool? isOptedOut = null,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true, HouseholdRef: not null })
            return new UpdateContactResult.Refused();

        try
        {
            return await store.UpsertContactAsync(
                ctx.HouseholdRef.Value, displayName, phone, email, isOptedOut, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new UpdateContactResult.Failed();
        }
    }
}
