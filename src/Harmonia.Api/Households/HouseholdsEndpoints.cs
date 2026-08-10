using Microsoft.AspNetCore.Http;
using Harmonia.Application.Households;

namespace Harmonia.Api.Households;

public sealed record HouseholdDto(string HouseholdRef, decimal SqMeters);
public sealed record UpsertHouseholdRequest(decimal SqMeters);

public static class HouseholdsEndpoints
{
    public static async Task<IResult> GetHouseholdsEndpoint(
        GetHouseholds useCase, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        return result switch
        {
            GetHouseholdsResult.Refused    => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            GetHouseholdsResult.Ok ok      => TypedResults.Ok(
                ok.Households.Select(h => new HouseholdDto(h.HouseholdRef.Value, h.SqMeters)).ToList()),
            GetHouseholdsResult.Failed     => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                              => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> UpsertHouseholdEndpoint(
        UpsertHousehold useCase, string householdRef, UpsertHouseholdRequest body, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(householdRef, body.SqMeters, ct);
        return result switch
        {
            UpsertHouseholdResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            UpsertHouseholdResult.Ok       => TypedResults.Ok(),
            UpsertHouseholdResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                              => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    // householdRef as query param — refs can contain '/' which ASP.NET Core leaves undecoded in path segments.
    public static async Task<IResult> DeleteHouseholdEndpoint(
        DeleteHousehold useCase, string householdRef, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(householdRef, ct);
        return result switch
        {
            DeleteHouseholdResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            DeleteHouseholdResult.NotFound => TypedResults.NotFound(),
            DeleteHouseholdResult.Ok       => TypedResults.NoContent(),
            DeleteHouseholdResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                              => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }
}
