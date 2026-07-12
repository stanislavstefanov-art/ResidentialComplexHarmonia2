using Harmonia.Application;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.UnitTests.Application;

public class ListExpensesTests
{
    private static readonly DateOnly TestDate = new(2026, 7, 1);

    [Fact]
    public async Task Resident_can_list_expenses()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var store = new FakeExpenseStore();
        await store.RecordExpenseAsync(MakeExpense("k1"), default);
        var useCase = new ListExpenses(new FakeSession(ctx), store);

        var result = await useCase.ExecuteAsync();

        var ok = Assert.IsType<ListExpensesResult.Ok>(result);
        Assert.Single(ok.Expenses);
    }

    [Fact]
    public async Task Admin_can_list_expenses()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakeExpenseStore();
        await store.RecordExpenseAsync(MakeExpense("k1"), default);
        var useCase = new ListExpenses(new FakeSession(ctx), store);

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListExpensesResult.Ok>(result);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new ListExpenses(new FakeSession(null), new FakeExpenseStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListExpensesResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var useCase = new ListExpenses(new FakeSession(ctx), new FailingExpenseStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListExpensesResult.Failed>(result);
    }

    private static AssociationExpense MakeExpense(string key) =>
        new(Guid.NewGuid(), 100m, "Test", "Maintenance", TestDate, DateTimeOffset.UtcNow, key);
}
