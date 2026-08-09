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
        if (ctx is null || ctx.HouseholdRef is null)
            return new GetMyContactResult.Refused();

        try
        {
            var role    = ctx.Role ?? "Owner";
            var contact = await store.GetContactAsync(ctx.HouseholdRef.Value, role, ct);

            // Fallback: if role stored in HouseholdLinks doesn't match the role stored in
            // HouseholdContacts (can happen when admin self-links after creating contact via
            // the admin update tool), try the other role so My Details is never silently empty.
            if (contact is null)
            {
                var other = role == "Owner" ? "Renter" : "Owner";
                contact = await store.GetContactAsync(ctx.HouseholdRef.Value, other, ct);
            }

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
