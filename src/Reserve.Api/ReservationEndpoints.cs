using Reserve.Application;
using Reserve.Domain;

namespace Reserve.Api;

public sealed record SlotDto(string SlotKey, string State);

public sealed record DaySlotsDto(string Day, IReadOnlyList<SlotDto> Slots);

public sealed record ClaimResponseDto(string Outcome);

/// <summary>
/// HTTP translation for the two surfaces — translation only, no business logic
/// (architecture.md). Maps use-case results to the wire contract:
/// 401 refused, 404 unknown slot, 200 confirmed-yours, 409 refused-already-taken,
/// 503 couldnt-confirm. Log lines carry day/slot/outcome only — never the
/// household reference (R3, T16).
/// </summary>
public static class ReservationEndpoints
{
    public static async Task<IResult> GetDaySlots(
        GetDayAvailability useCase, DateOnly day, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(day, ct);

        return result switch
        {
            AvailabilityResult.Refused => Results.Unauthorized(),
            AvailabilityResult.Ok ok => Results.Json(
                new DaySlotsDto(
                    ok.Day.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                    ok.Slots.Select(s => new SlotDto(s.SlotKey, StateToken(s.State))).ToList()),
                statusCode: StatusCodes.Status200OK),
            _ => Results.StatusCode(StatusCodes.Status500InternalServerError),
        };
    }

    public static async Task<IResult> ClaimSlot(
        ReserveSlot useCase, DateOnly day, string slotKey, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(day, slotKey, ct);

        switch (result)
        {
            case ReserveResult.Refused:
                return Results.Unauthorized();
            case ReserveResult.UnknownSlot:
                return Results.NotFound();
            case ReserveResult.Outcome outcome:
                // R3: log the observable outcome only — never the household reference.
                logger.LogInformation(
                    "Claim {Day}/{SlotKey}: {Outcome}", day, slotKey, OutcomeToken(outcome.Value));
                return Results.Json(
                    new ClaimResponseDto(OutcomeToken(outcome.Value)),
                    statusCode: StatusFor(outcome.Value));
            default:
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private static string StateToken(SlotState state)
        => state switch
        {
            SlotState.Free => "free",
            SlotState.TakenMine => "taken-mine",
            _ => "taken-other",
        };

    private static string OutcomeToken(ClaimOutcome outcome)
        => outcome switch
        {
            ClaimOutcome.ConfirmedYours => "confirmed-yours",
            ClaimOutcome.RefusedAlreadyTaken => "refused-already-taken",
            _ => "couldnt-confirm",
        };

    private static int StatusFor(ClaimOutcome outcome)
        => outcome switch
        {
            ClaimOutcome.ConfirmedYours => StatusCodes.Status200OK,
            ClaimOutcome.RefusedAlreadyTaken => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status503ServiceUnavailable,
        };
}
