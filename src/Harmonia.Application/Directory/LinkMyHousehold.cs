using Harmonia.Application.PendingSignIn;

namespace Harmonia.Application.Directory;

/// <summary>
/// Lets an admin link their own Entra OID to a household they reside in.
/// R2: the OID comes from the verified session, never from the request body.
/// R3: OID and householdRef are personal data — never logged here.
/// </summary>
public sealed class LinkMyHousehold(ISession session, IPendingSignInStore pendingStore)
{
    public async Task<LinkMyHouseholdResult> ExecuteAsync(
        string householdRef, string role, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true, EntraObjectId: not null })
            return new LinkMyHouseholdResult.Refused();
        try
        {
            return await pendingStore.DirectLinkAsync(ctx.EntraObjectId, householdRef, role, ct) switch
            {
                DirectLinkResult.Ok            => new LinkMyHouseholdResult.Ok(),
                DirectLinkResult.AlreadyLinked => new LinkMyHouseholdResult.AlreadyLinked(),
                _                              => new LinkMyHouseholdResult.Failed()
            };
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new LinkMyHouseholdResult.Failed();
        }
    }
}
