using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Financial;
using Harmonia.Domain.Financial;

namespace Harmonia.Api.Financial;

public sealed record RecordIncomeRequest(
    string   Category,
    string   Description,
    decimal  AmountEur,
    DateOnly IncomeDate,
    string   IdempotencyKey);

public sealed record IncomeDto(
    Guid           Id,
    string         Category,
    string         Description,
    decimal        AmountEur,
    DateOnly       IncomeDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

public static class IncomeEndpoints
{
    public static async Task<IResult> RecordIncomeEndpoint(
        RecordIncome useCase, RecordIncomeRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(
            body.Category, body.Description, body.AmountEur, body.IncomeDate, body.IdempotencyKey, ct);

        return result switch
        {
            RecordIncomeResult.Refused             => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            RecordIncomeResult.Created created     => TypedResults.Json(ToDto(created.Income), statusCode: StatusCodes.Status201Created),
            RecordIncomeResult.Duplicate duplicate => TypedResults.Json(ToDto(duplicate.Income), statusCode: StatusCodes.Status200OK),
            RecordIncomeResult.Failed              => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                                      => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static IncomeDto ToDto(AssociationIncome i) =>
        new(i.Id, i.Category, i.Description, i.AmountEur, i.IncomeDate, i.RecordedAt, i.IdempotencyKey);
}
