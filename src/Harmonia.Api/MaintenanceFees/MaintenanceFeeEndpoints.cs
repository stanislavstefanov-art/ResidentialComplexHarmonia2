using Microsoft.AspNetCore.Http.HttpResults;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Api.MaintenanceFees;

/// <summary>POST body for recording a maintenance fee charge.</summary>
public sealed record RecordChargeRequest(
    decimal AmountEur,
    string Description,
    string Period,
    string IdempotencyKey);

/// <summary>Wire representation of a maintenance fee charge (R3: HouseholdRef carried, never logged).</summary>
public sealed record ChargeDto(
    Guid Id,
    string HouseholdRef,
    decimal AmountEur,
    string Description,
    string Period,
    DateTimeOffset ChargedAt,
    string IdempotencyKey);

/// <summary>
/// HTTP translation for the maintenance fee ledger. Translation only — no business logic.
/// R3: HouseholdRef is personal data; log outcome tokens only, never the ref value.
/// </summary>
public static class MaintenanceFeeEndpoints
{
    public static async Task<IResult> RecordChargeEndpoint(
        RecordCharge useCase,
        string householdRef,
        RecordChargeRequest body,
        ILogger logger,
        CancellationToken ct)
    {
        var target = new HouseholdRef(householdRef);
        var result = await useCase.ExecuteAsync(
            target, body.AmountEur, body.Description, body.Period, body.IdempotencyKey, ct);

        switch (result)
        {
            case RecordChargeResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case RecordChargeResult.Created created:
                logger.LogInformation("Charge recorded: created");
                return TypedResults.Json(ToDto(created.Charge), statusCode: StatusCodes.Status201Created);
            case RecordChargeResult.Duplicate duplicate:
                logger.LogInformation("Charge recorded: duplicate (idempotent)");
                return TypedResults.Json(ToDto(duplicate.Charge), statusCode: StatusCodes.Status200OK);
            case RecordChargeResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> ListChargesEndpoint(
        ListCharges useCase,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);

        switch (result)
        {
            case ListChargesResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case ListChargesResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            case ListChargesResult.Ok ok:
                logger.LogInformation("Charges listed: {Count} charges", ok.Charges.Count);
                return TypedResults.Json(
                    ok.Charges.Select(ToDto).ToList(),
                    statusCode: StatusCodes.Status200OK);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private static ChargeDto ToDto(MaintenanceFeeCharge c) =>
        new(c.Id, c.HouseholdRef.Value, c.AmountEur, c.Description, c.Period, c.ChargedAt, c.IdempotencyKey);
}
