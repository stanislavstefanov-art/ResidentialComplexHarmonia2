using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

/// <summary>
/// Returns the directory list with a role-differentiated projection.
/// Admin sessions receive the full <see cref="GetDirectoryResult.BoardView"/>;
/// resident sessions receive the name-only <see cref="GetDirectoryResult.ResidentView"/>.
/// </summary>
public sealed class GetDirectory(ISession session, IDirectoryStore store)
{
    public async Task<GetDirectoryResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is null) return new GetDirectoryResult.Refused();

        try
        {
            var entries = await store.ListAllAsync(ct);

            if (ctx.IsAdmin)
                return new GetDirectoryResult.BoardView(entries);

            if (ctx.IsResident)
                return new GetDirectoryResult.ResidentView(entries);

            return new GetDirectoryResult.Refused();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            return new GetDirectoryResult.Failed();
        }
    }
}
