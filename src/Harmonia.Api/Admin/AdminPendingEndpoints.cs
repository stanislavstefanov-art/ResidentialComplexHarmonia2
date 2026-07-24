using Harmonia.Application.PendingSignIn;
using Microsoft.Extensions.Logging;

namespace Harmonia.Api.Admin;

public sealed record PendingSignInDto(
    string         EntraObjectId,
    string         Email,
    string         DisplayName,
    DateTimeOffset FirstSeenAt);

public sealed record ActivateRequest(string HouseholdRef);

public sealed record PurgeExpiredDto(int Deleted);

/// <summary>
/// HTTP handlers for admin pending sign-in management.
/// R3: OID, email, displayName are personal data — never pass their values to any logger.
/// </summary>
public static class AdminPendingEndpoints
{
    public static async Task<IResult> ListPendingEndpoint(
        ListPendingSignIns useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        logger.LogInformation("GET /admin/pending — {Outcome}", result.GetType().Name);
        return result switch
        {
            ListPendingResult.Refused    => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            ListPendingResult.Failed     => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            ListPendingResult.Ok ok      => TypedResults.Json(
                ok.Items.Select(p => new PendingSignInDto(p.EntraObjectId, p.Email, p.DisplayName, p.FirstSeenAt)).ToList(),
                statusCode: StatusCodes.Status200OK),
            _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> ActivatePendingEndpoint(
        ActivatePendingSignIn useCase, string oid, ActivateRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(oid, body.HouseholdRef, ct);
        logger.LogInformation("POST /admin/pending/activate — {Outcome}", result.GetType().Name);
        return result switch
        {
            ActivatePendingSignInResult.Refused          => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            ActivatePendingSignInResult.NotFound         => TypedResults.StatusCode(StatusCodes.Status404NotFound),
            ActivatePendingSignInResult.AlreadyActivated => TypedResults.StatusCode(StatusCodes.Status409Conflict),
            ActivatePendingSignInResult.Failed           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            ActivatePendingSignInResult.Ok               => TypedResults.StatusCode(StatusCodes.Status200OK),
            _                                            => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> PurgeExpiredPendingEndpoint(
        PurgeExpiredPendingSignIns useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        logger.LogInformation("DELETE /admin/pending/purge-expired — {Outcome}", result.GetType().Name);
        return result switch
        {
            PurgeExpiredPendingResult.Refused    => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            PurgeExpiredPendingResult.Failed     => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            PurgeExpiredPendingResult.Ok ok      => TypedResults.Json(new PurgeExpiredDto(ok.Deleted), statusCode: StatusCodes.Status200OK),
            _                                   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }
}
