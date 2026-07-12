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
    public sealed record Refused                                        : ListExpensesResult;
    public sealed record Ok(IReadOnlyList<AssociationExpense> Expenses) : ListExpensesResult;
    public sealed record Failed                                         : ListExpensesResult;
}

public interface IExpenseStore
{
    Task<RecordExpenseResult> RecordExpenseAsync(
        AssociationExpense expense, CancellationToken ct = default);

    Task<IReadOnlyList<AssociationExpense>> ListExpensesAsync(
        CancellationToken ct = default);
}
