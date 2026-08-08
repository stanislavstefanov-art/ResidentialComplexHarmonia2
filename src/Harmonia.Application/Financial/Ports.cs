using Harmonia.Domain.Financial;

namespace Harmonia.Application.Financial;

public abstract record RecordIncomeResult
{
    private RecordIncomeResult() { }
    public sealed record Refused                              : RecordIncomeResult;
    public sealed record Created(AssociationIncome Income)   : RecordIncomeResult;
    public sealed record Duplicate(AssociationIncome Income) : RecordIncomeResult;
    public sealed record Failed                              : RecordIncomeResult;
}

public abstract record GetAnnualReportResult
{
    private GetAnnualReportResult() { }
    public sealed record Refused                        : GetAnnualReportResult;
    public sealed record Ok(AnnualReportData Report)   : GetAnnualReportResult;
    public sealed record Failed                        : GetAnnualReportResult;
}

public interface IIncomeStore
{
    Task<RecordIncomeResult> RecordIncomeAsync(
        AssociationIncome income, CancellationToken ct = default);

    Task<AnnualIncomeData> GetAnnualIncomeAsync(
        int year, CancellationToken ct = default);
}

public sealed record IncomeMonthRow(string Category, int MonthNum, decimal Total);
public sealed record MaintenanceFeeMonthRow(int MonthNum, decimal Total);

public sealed record AnnualIncomeData(
    IReadOnlyList<MaintenanceFeeMonthRow> MaintenanceFeeRows,
    IReadOnlyList<IncomeMonthRow> OtherIncomeRows);

// ── Assembled report ──────────────────────────────────────────────────────────

public sealed record MonthlyLine(string Category, decimal[] ByMonth, decimal Total);
public sealed record SubCategoryLine(string Name, decimal[] ByMonth, decimal Total);
public sealed record ParentCategoryLine(string ParentCategory, SubCategoryLine[] SubCategories);

public sealed record AnnualReportData(
    int Year,
    string[] Months,
    MonthlyLine MaintenanceFees,
    MonthlyLine[] OtherIncome,
    ParentCategoryLine[] Expenses,
    decimal[] PeriodResultByMonth,
    decimal PeriodResultTotal);
