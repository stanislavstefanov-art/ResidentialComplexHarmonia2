namespace Harmonia.Application.Expenses;

public sealed class ListExpenses(ISession session, IExpenseStore store)
{
    public async Task<ListExpensesResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new ListExpensesResult.Refused();

        try
        {
            var expenses = await store.ListExpensesAsync(ct);
            return new ListExpensesResult.Ok(expenses);
        }
        catch (Exception)
        {
            return new ListExpensesResult.Failed();
        }
    }
}
