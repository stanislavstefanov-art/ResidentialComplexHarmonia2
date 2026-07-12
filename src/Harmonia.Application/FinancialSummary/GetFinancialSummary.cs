using Harmonia.Application.Expenses;
using Harmonia.Application.MaintenanceFees;

namespace Harmonia.Application.FinancialSummary;

public abstract record GetFinancialSummaryResult
{
    private GetFinancialSummaryResult() { }
    public sealed record Refused       : GetFinancialSummaryResult;
    public sealed record InvalidPeriod : GetFinancialSummaryResult;
    public sealed record Ok(string Period, decimal TotalChargesEur, decimal TotalExpensesEur)
                                       : GetFinancialSummaryResult;
    public sealed record Failed        : GetFinancialSummaryResult;
}

public sealed class GetFinancialSummary(
    ISession session,
    IMaintenanceFeeStore feeStore,
    IExpenseStore expenseStore)
{
    public async Task<GetFinancialSummaryResult> ExecuteAsync(
        string period, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new GetFinancialSummaryResult.Refused();

        if (!TryParsePeriod(period, out var year, out var month))
            return new GetFinancialSummaryResult.InvalidPeriod();

        try
        {
            var charges  = await feeStore.ListAllChargesAsync(ct);
            var expenses = await expenseStore.ListExpensesAsync(ct);

            var totalCharges = charges
                .Where(c => c.Period == period)
                .Sum(c => c.AmountEur);

            var totalExpenses = expenses
                .Where(e => e.ExpenseDate.Year == year && e.ExpenseDate.Month == month)
                .Sum(e => e.AmountEur);

            return new GetFinancialSummaryResult.Ok(period, totalCharges, totalExpenses);
        }
        catch (Exception)
        {
            return new GetFinancialSummaryResult.Failed();
        }
    }

    private static bool TryParsePeriod(string period, out int year, out int month)
    {
        year = 0; month = 0;
        if (period is not { Length: 7 } || period[4] != '-')
            return false;
        return int.TryParse(period[..4], out year)
            && int.TryParse(period[5..], out month)
            && month is >= 1 and <= 12;
    }
}
