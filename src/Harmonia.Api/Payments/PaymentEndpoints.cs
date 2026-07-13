using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Payments;
using Harmonia.Domain.Payments;

namespace Harmonia.Api.Payments;

public sealed record RecordPaymentRequest(
    string   HouseholdRef,
    decimal  AmountEur,
    string   Period,
    DateOnly DateReceived,
    string   IdempotencyKey);

public sealed record PaymentDto(
    Guid           Id,
    string         HouseholdRef,
    decimal        AmountEur,
    string         Period,
    DateOnly       DateReceived,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

public sealed record BalanceLineDto(
    string  HouseholdRef,
    decimal TotalCharged,
    decimal TotalPaid,
    decimal Balance);

public sealed record BalanceDto(string Label, IReadOnlyList<BalanceLineDto> Lines);

public static class PaymentEndpoints
{
    public static async Task<IResult> RecordPaymentEndpoint(
        RecordPayment useCase,
        RecordPaymentRequest body,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            body.HouseholdRef, body.AmountEur, body.Period,
            body.DateReceived, body.IdempotencyKey, ct);
        switch (result)
        {
            case RecordPaymentResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case RecordPaymentResult.Created created:
                return TypedResults.Json(ToDto(created.Payment),
                    statusCode: StatusCodes.Status201Created);
            case RecordPaymentResult.Duplicate duplicate:
                return TypedResults.Json(ToDto(duplicate.Payment),
                    statusCode: StatusCodes.Status200OK);
            case RecordPaymentResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> ListAllPaymentsEndpoint(
        ListAllPayments useCase,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        switch (result)
        {
            case ListPaymentsResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case ListPaymentsResult.Ok ok:
                return TypedResults.Json(
                    ok.Payments.Select(ToDto).ToList(),
                    statusCode: StatusCodes.Status200OK);
            case ListPaymentsResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> ListMyPaymentsEndpoint(
        ListMyPayments useCase,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        switch (result)
        {
            case ListPaymentsResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case ListPaymentsResult.Ok ok:
                return TypedResults.Json(
                    ok.Payments.Select(ToDto).ToList(),
                    statusCode: StatusCodes.Status200OK);
            case ListPaymentsResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> GetBalanceEndpoint(
        GetBalance useCase,
        string? period,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(period, ct);
        switch (result)
        {
            case GetBalanceResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case GetBalanceResult.InvalidPeriod:
                return TypedResults.BadRequest("Period must be in YYYY-MM format.");
            case GetBalanceResult.Ok ok:
                return TypedResults.Json(
                    new BalanceDto(ok.Label, ok.Lines
                        .Select(l => new BalanceLineDto(
                            l.HouseholdRef.Value, l.TotalCharged, l.TotalPaid, l.Balance))
                        .ToList()),
                    statusCode: StatusCodes.Status200OK);
            case GetBalanceResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private static PaymentDto ToDto(MaintenanceFeePayment p) =>
        new(p.Id, p.HouseholdRef.Value, p.AmountEur, p.Period,
            p.DateReceived, p.RecordedAt, p.IdempotencyKey);
}
