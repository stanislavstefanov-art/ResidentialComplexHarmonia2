using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Directory;
using Harmonia.Domain.Directory;

namespace Harmonia.Api.Directory;

public sealed record DirectoryEntryPublicDto(string HouseholdRef, string? DisplayName);

public sealed record DirectoryEntryFullDto(
    string         HouseholdRef,
    string?        DisplayName,
    string?        Phone,
    string?        Email,
    string?        Notes,
    DateTimeOffset UpdatedAt);

public sealed record UpdateContactRequest(string? DisplayName, string? Phone, string? Email);

public sealed record UpdateNotesRequest(string? Notes);

public static class DirectoryEndpoints
{
    public static async Task<IResult> GetDirectoryEndpoint(
        GetDirectory useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        return result switch
        {
            GetDirectoryResult.Refused         => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            GetDirectoryResult.ResidentView rv => TypedResults.Json(
                rv.Entries.Select(e =>
                    new DirectoryEntryPublicDto(e.HouseholdRef.Value, e.DisplayName)).ToList(),
                statusCode: StatusCodes.Status200OK),
            GetDirectoryResult.BoardView bv    => TypedResults.Json(
                bv.Entries.Select(ToFullDto).ToList(),
                statusCode: StatusCodes.Status200OK),
            GetDirectoryResult.Failed          => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> UpdateMyContactEndpoint(
        UpdateMyContact useCase, UpdateContactRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(body.DisplayName, body.Phone, body.Email, ct);
        return result switch
        {
            UpdateContactResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            UpdateContactResult.Ok      => TypedResults.Ok(),
            UpdateContactResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> UpdateContactEndpoint(
        UpdateContact useCase, string householdRef, UpdateContactRequest body,
        ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            householdRef, body.DisplayName, body.Phone, body.Email, ct);
        return result switch
        {
            UpdateContactResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            UpdateContactResult.Ok      => TypedResults.Ok(),
            UpdateContactResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    public static async Task<IResult> UpdateNotesEndpoint(
        UpdateNotes useCase, string householdRef, UpdateNotesRequest body,
        ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(householdRef, body.Notes, ct);
        return result switch
        {
            UpdateNotesResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            UpdateNotesResult.Ok      => TypedResults.Ok(),
            UpdateNotesResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                         => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static DirectoryEntryFullDto ToFullDto(HouseholdContact c) =>
        new(c.HouseholdRef.Value, c.DisplayName, c.Phone, c.Email, c.Notes, c.UpdatedAt);
}
