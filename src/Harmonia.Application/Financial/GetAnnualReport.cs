using Harmonia.Application.Expenses;

namespace Harmonia.Application.Financial;

public sealed class GetAnnualReport(ISession session, IIncomeStore incomeStore, IExpenseStore expenseStore)
{
    public async Task<GetAnnualReportResult> ExecuteAsync(int year, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new GetAnnualReportResult.Refused();

        try
        {
            var incomeTask  = incomeStore.GetAnnualIncomeAsync(year, ct);
            var expenseTask = expenseStore.GetAnnualExpensesAsync(year, ct);
            await Task.WhenAll(incomeTask, expenseTask);

            var income   = incomeTask.Result;
            var expenses = expenseTask.Result;

            var months = Enumerable.Range(1, 12)
                .Select(m => $"{year}-{m:D2}")
                .ToArray();

            // ── Maintenance fees ──────────────────────────────────────────
            var mfByMonth = new decimal[12];
            foreach (var row in income.MaintenanceFeeRows)
                mfByMonth[row.MonthNum - 1] += row.Total;
            var mfLine = new MonthlyLine("Maintenance Fees", mfByMonth, mfByMonth.Sum());

            // ── Other income by category ──────────────────────────────────
            var otherGrouped = income.OtherIncomeRows
                .GroupBy(r => r.Category)
                .Select(g =>
                {
                    var byMonth = new decimal[12];
                    foreach (var r in g) byMonth[r.MonthNum - 1] += r.Total;
                    return new MonthlyLine(g.Key, byMonth, byMonth.Sum());
                })
                .ToArray();

            // ── Expenses by parent + sub category ────────────────────────
            var expGrouped = expenses.Rows
                .GroupBy(r => r.ParentCategory)
                .Select(pg =>
                {
                    var subCategories = pg
                        .GroupBy(r => r.SubCategory)
                        .Select(sg =>
                        {
                            var byMonth = new decimal[12];
                            foreach (var r in sg) byMonth[r.MonthNum - 1] += r.Total;
                            return new SubCategoryLine(sg.Key, byMonth, byMonth.Sum());
                        })
                        .ToArray();
                    return new ParentCategoryLine(pg.Key, subCategories);
                })
                .ToArray();

            // ── Period result ─────────────────────────────────────────────
            var totalIncome  = new decimal[12];
            var totalExpense = new decimal[12];

            foreach (var m in income.MaintenanceFeeRows)  totalIncome[m.MonthNum - 1]  += m.Total;
            foreach (var m in income.OtherIncomeRows)     totalIncome[m.MonthNum - 1]  += m.Total;
            foreach (var m in expenses.Rows)              totalExpense[m.MonthNum - 1] += m.Total;

            var periodByMonth = Enumerable.Range(0, 12)
                .Select(i => totalIncome[i] - totalExpense[i])
                .ToArray();

            var report = new AnnualReportData(
                Year:                year,
                Months:              months,
                MaintenanceFees:     mfLine,
                OtherIncome:         otherGrouped,
                Expenses:            expGrouped,
                PeriodResultByMonth: periodByMonth,
                PeriodResultTotal:   periodByMonth.Sum());

            return new GetAnnualReportResult.Ok(report);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception) { return new GetAnnualReportResult.Failed(); }
    }
}
