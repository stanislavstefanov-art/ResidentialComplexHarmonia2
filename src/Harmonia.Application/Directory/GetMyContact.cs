namespace Harmonia.Application.Directory;

/// <summary>
/// Returns the current resident's own contact record.
/// R2: household identity is always resolved from <see cref="ISession.Resolve()"/> — never a caller parameter.
/// R3: HouseholdRef value is never logged here.
/// </summary>
public sealed class GetMyContact(ISession session, IDirectoryStore store)
{
    public async Task<GetMyContactResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true, HouseholdRef: not null })
            return new GetMyContactResult.Refused();

        try
        {
            var contact = await store.GetContactAsync(ctx.HouseholdRef.Value, ct);
            return contact is null
                ? new GetMyContactResult.NotFound()
                : new GetMyContactResult.Ok(contact);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new GetMyContactResult.Failed();
        }
    }
}
