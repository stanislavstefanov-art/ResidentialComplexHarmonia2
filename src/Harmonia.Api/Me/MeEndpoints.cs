using Harmonia.Application.PendingSignIn;
using Microsoft.Extensions.Logging;

namespace Harmonia.Api.Me;

public sealed record MeStatusDto(string Status);

/// <summary>
/// HTTP handler for GET /me — returns the caller's activation status.
/// R3: OID, email, householdRef are never passed to any logger in this class.
/// </summary>
public static class MeEndpoints
{
    public static async Task<IResult> GetMe(
        GetCallerStatus useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        logger.LogInformation("GET /me — {Outcome}", result.GetType().Name);
        return result switch
        {
            GetCallerStatusResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            GetCallerStatusResult.Pending => TypedResults.Json(new MeStatusDto("pending"), statusCode: StatusCodes.Status200OK),
            GetCallerStatusResult.Ok      => TypedResults.Json(new MeStatusDto("ok"),      statusCode: StatusCodes.Status200OK),
            _                             => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }
}
