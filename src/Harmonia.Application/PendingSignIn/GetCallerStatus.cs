namespace Harmonia.Application.PendingSignIn;

public abstract record GetCallerStatusResult
{
    private GetCallerStatusResult() { }
    /// <summary>No valid session or no recognised role.</summary>
    public sealed record Refused : GetCallerStatusResult;
    /// <summary>Valid JWT, authenticated, but no linked household — show pending screen.</summary>
    public sealed record Pending : GetCallerStatusResult;
    /// <summary>Resident or admin — full access.</summary>
    public sealed record Ok      : GetCallerStatusResult;
}

public sealed class GetCallerStatus(ISession session)
{
    public Task<GetCallerStatusResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is null)                   return Task.FromResult<GetCallerStatusResult>(new GetCallerStatusResult.Refused());
        if (ctx.IsPending)                 return Task.FromResult<GetCallerStatusResult>(new GetCallerStatusResult.Pending());
        if (ctx.IsResident || ctx.IsAdmin) return Task.FromResult<GetCallerStatusResult>(new GetCallerStatusResult.Ok());
        return Task.FromResult<GetCallerStatusResult>(new GetCallerStatusResult.Refused());
    }
}
