using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.FinancialSummary;

namespace Harmonia.Api.FinancialSummary;

public sealed record FinancialSummaryDto(
    string Period,
    decimal TotalChargesEur,
    decimal TotalExpensesEur);

public static class FinancialSummaryEndpoints
{
    public static async Task<IResult> GetSummaryEndpoint(
        GetFinancialSummary useCase,
        string period,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(period, ct);
        switch (result)
        {
            case GetFinancialSummaryResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case GetFinancialSummaryResult.InvalidPeriod:
                return TypedResults.BadRequest("Period must be in YYYY-MM format.");
            case GetFinancialSummaryResult.Ok ok:
                return TypedResults.Json(
                    new FinancialSummaryDto(ok.Period, ok.TotalChargesEur, ok.TotalExpensesEur),
                    statusCode: StatusCodes.Status200OK);
            case GetFinancialSummaryResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }
}
