namespace Harmonia.Application.PendingSignIn;

public abstract record ActivatePendingSignInResult
{
    private ActivatePendingSignInResult() { }
    public sealed record Refused          : ActivatePendingSignInResult;
    public sealed record Failed           : ActivatePendingSignInResult;
    public sealed record NotFound         : ActivatePendingSignInResult;
    public sealed record AlreadyActivated : ActivatePendingSignInResult;
    public sealed record Ok               : ActivatePendingSignInResult;
}

public sealed class ActivatePendingSignIn(ISession session, IPendingSignInStore store)
{
    public async Task<ActivatePendingSignInResult> ExecuteAsync(
        string oid, string householdRef, CancellationToken ct = default)
    {
        if (session.Resolve() is not { IsAdmin: true })
            return new ActivatePendingSignInResult.Refused();
        try
        {
            return await store.ActivateAsync(oid, householdRef, ct) switch
            {
                ActivateResult.Ok               => new ActivatePendingSignInResult.Ok(),
                ActivateResult.NotFound         => new ActivatePendingSignInResult.NotFound(),
                ActivateResult.AlreadyActivated => new ActivatePendingSignInResult.AlreadyActivated(),
                _                               => new ActivatePendingSignInResult.Failed()
            };
        }
        catch
        {
            return new ActivatePendingSignInResult.Failed();
        }
    }
}
