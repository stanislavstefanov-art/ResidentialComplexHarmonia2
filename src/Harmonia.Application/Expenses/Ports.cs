using Harmonia.Domain.Expenses;

namespace Harmonia.Application.Expenses;

public abstract record RecordExpenseResult
{
    private RecordExpenseResult() { }
    public sealed record Refused                               : RecordExpenseResult;
    public sealed record Created(AssociationExpense Expense)   : RecordExpenseResult;
    public sealed record Duplicate(AssociationExpense Expense) : RecordExpenseResult;
    public sealed record Failed                                : RecordExpenseResult;
}

public abstract record ListExpensesResult
{
    private ListExpensesResult() { }
    public sealed record Refused                                    : ListExpensesResult;
    public sealed record Ok(IReadOnlyList<ExpenseListItem> Expenses) : ListExpensesResult;
    public sealed record Failed                                     : ListExpensesResult;
}

public interface IExpenseStore
{
    Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default);

    Task<IReadOnlyList<ExpenseListItem>> ListExpensesAsync(
        CancellationToken ct = default);

    Task<AnnualExpenseData> GetAnnualExpensesAsync(
        int year, CancellationToken ct = default);
}

/// Read-only projection for GET /expenses — joins Counterparty display fields.
/// AssociationExpense (the append-only write-side domain record) stays lean.
public sealed record ExpenseListItem(
    Guid           Id,
    decimal        AmountEur,
    string         Description,
    Guid           CounterpartyId,
    string         CounterpartyName,
    string         CounterpartyCategory,
    string         CounterpartyParentCategory,
    DateOnly       ExpenseDate,
    DateTimeOffset RecordedAt,
    string         IdempotencyKey);

public sealed record ExpenseMonthRow(string ParentCategory, string SubCategory, int MonthNum, decimal Total);

public sealed record AnnualExpenseData(IReadOnlyList<ExpenseMonthRow> Rows);
