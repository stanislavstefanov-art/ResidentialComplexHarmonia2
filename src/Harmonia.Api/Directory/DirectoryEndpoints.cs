using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Directory;
using Harmonia.Domain.Directory;

namespace Harmonia.Api.Directory;

/// <summary>Resident-facing view — name only, no PII (R3).</summary>
public sealed record DirectoryEntryPublicDto(string HouseholdRef, string? DisplayName);

/// <summary>Board-facing view — full contact details including phone, email, notes, and opt-out status.</summary>
public sealed record DirectoryEntryFullDto(
    string         HouseholdRef,
    string?        DisplayName,
    string?        Phone,
    string?        Email,
    string?        Notes,
    bool           IsOptedOut,
    DateTimeOffset UpdatedAt);

/// <summary>Request body for contact-detail updates (phone/email are PII — R3).</summary>
public sealed record UpdateContactRequest(
    string? DisplayName,
    string? Phone,
    string? Email,
    bool?   OptedOut = null);

public sealed record UpdateNotesRequest(string? Notes);

/// <summary>
/// HTTP translation layer for the member directory feature.
/// Maps use-case outcomes to HTTP status codes and DTOs; contains no business logic.
/// R3: phone and email values are never passed to any logger in this class.
/// </summary>
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
        var result = await useCase.ExecuteAsync(body.DisplayName, body.Phone, body.Email, body.OptedOut, ct);
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
            householdRef, body.DisplayName, body.Phone, body.Email, body.OptedOut, ct);
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

    /// <summary>
    /// DELETE /directory/contact — resident Art. 17 self-erase.
    /// HouseholdRef is resolved from session inside the use case (R2).
    /// R3: householdRef never logged here.
    /// </summary>
    public static async Task<IResult> EraseMyContactEndpoint(
        EraseMyContact useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        return result switch
        {
            EraseContactResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            EraseContactResult.Ok       => TypedResults.NoContent(),
            EraseContactResult.NotFound => TypedResults.NoContent(),   // 204 — idempotent Art. 17
            EraseContactResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    /// <summary>
    /// DELETE /directory/{householdRef}/contact — board DSAR hard-delete.
    /// R3: householdRef never logged here.
    /// </summary>
    public static async Task<IResult> EraseContactEndpoint(
        EraseContact useCase, string householdRef, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(householdRef, ct);
        return result switch
        {
            EraseContactResult.Refused  => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            EraseContactResult.Ok       => TypedResults.NoContent(),
            EraseContactResult.NotFound => TypedResults.NotFound(),    // 404 — board DSAR confirmation
            EraseContactResult.Failed   => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                           => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static DirectoryEntryFullDto ToFullDto(HouseholdContact c) =>
        new(c.HouseholdRef.Value, c.DisplayName, c.Phone, c.Email, c.Notes, c.IsOptedOut, c.UpdatedAt);
}
