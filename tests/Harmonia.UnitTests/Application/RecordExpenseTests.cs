using Harmonia.Application;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.UnitTests.Application;

public class RecordExpenseTests
{
    private static readonly DateOnly TestDate = new(2026, 7, 1);

    [Fact]
    public async Task Admin_records_expense_returns_Created()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakeExpenseStore();
        var useCase = new RecordExpense(new FakeSession(ctx), store);

        var result = await useCase.ExecuteAsync(250m, "Gardening", "Maintenance", TestDate, "key-1");

        var created = Assert.IsType<RecordExpenseResult.Created>(result);
        Assert.Equal(250m, created.Expense.AmountEur);
        Assert.Equal("Gardening", created.Expense.Description);
        Assert.Equal("Maintenance", created.Expense.Category);
        Assert.Equal(TestDate, created.Expense.ExpenseDate);
    }

    [Fact]
    public async Task Duplicate_idempotency_key_returns_Duplicate()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakeExpenseStore();
        var useCase = new RecordExpense(new FakeSession(ctx), store);
        await useCase.ExecuteAsync(100m, "Cleaning", "Cleaning", TestDate, "dup-key");

        var result = await useCase.ExecuteAsync(999m, "Different", "Other", TestDate, "dup-key");

        var dup = Assert.IsType<RecordExpenseResult.Duplicate>(result);
        Assert.Equal(100m, dup.Expense.AmountEur);
    }

    [Fact]
    public async Task Resident_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var useCase = new RecordExpense(new FakeSession(ctx), new FakeExpenseStore());

        var result = await useCase.ExecuteAsync(100m, "X", "Y", TestDate, "k");

        Assert.IsType<RecordExpenseResult.Refused>(result);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new RecordExpense(new FakeSession(null), new FakeExpenseStore());

        var result = await useCase.ExecuteAsync(100m, "X", "Y", TestDate, "k");

        Assert.IsType<RecordExpenseResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new RecordExpense(new FakeSession(ctx), new FailingExpenseStore());

        var result = await useCase.ExecuteAsync(100m, "X", "Y", TestDate, "k");

        Assert.IsType<RecordExpenseResult.Failed>(result);
    }
}
