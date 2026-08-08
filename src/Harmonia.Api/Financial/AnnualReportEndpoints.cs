using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Financial;

namespace Harmonia.Api.Financial;

public sealed record MonthlyLineDto(string Category, decimal[] ByMonth, decimal Total);
public sealed record SubCategoryLineDto(string Name, decimal[] ByMonth, decimal Total);
public sealed record ParentCategoryLineDto(string ParentCategory, SubCategoryLineDto[] SubCategories);
public sealed record AnnualReportDto(
    int Year,
    string[] Months,
    MonthlyLineDto MaintenanceFees,
    MonthlyLineDto[] OtherIncome,
    ParentCategoryLineDto[] Expenses,
    decimal[] PeriodResultByMonth,
    decimal PeriodResultTotal);

public static class AnnualReportEndpoints
{
    public static async Task<IResult> GetAnnualReportEndpoint(
        GetAnnualReport useCase, int year, string? format, ILogger logger, CancellationToken ct)
    {
        if (year < 2000 || year > 2100)
            return TypedResults.BadRequest("Year must be between 2000 and 2100.");

        var result = await useCase.ExecuteAsync(year, ct);

        return result switch
        {
            GetAnnualReportResult.Refused => TypedResults.StatusCode(StatusCodes.Status403Forbidden),
            GetAnnualReportResult.Ok ok   => format == "xlsx"
                ? Results.File(ExcelReportBuilder.Build(ok.Report),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"annual-report-{year}.xlsx")
                : TypedResults.Json(ToDto(ok.Report), statusCode: StatusCodes.Status200OK),
            GetAnnualReportResult.Failed  => TypedResults.StatusCode(StatusCodes.Status500InternalServerError),
            _                             => TypedResults.StatusCode(StatusCodes.Status500InternalServerError)
        };
    }

    private static AnnualReportDto ToDto(AnnualReportData r) =>
        new(
            Year:                r.Year,
            Months:              r.Months,
            MaintenanceFees:     new MonthlyLineDto(r.MaintenanceFees.Category, r.MaintenanceFees.ByMonth, r.MaintenanceFees.Total),
            OtherIncome:         r.OtherIncome.Select(l => new MonthlyLineDto(l.Category, l.ByMonth, l.Total)).ToArray(),
            Expenses:            r.Expenses.Select(p => new ParentCategoryLineDto(
                p.ParentCategory,
                p.SubCategories.Select(s => new SubCategoryLineDto(s.Name, s.ByMonth, s.Total)).ToArray()
            )).ToArray(),
            PeriodResultByMonth: r.PeriodResultByMonth,
            PeriodResultTotal:   r.PeriodResultTotal);
}
