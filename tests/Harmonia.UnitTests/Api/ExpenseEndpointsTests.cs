using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Expenses;
using Harmonia.Application;
using Harmonia.Application.Expenses;
using Harmonia.Domain.Expenses;

namespace Harmonia.UnitTests.Api;

public class ExpenseEndpointsTests
{
    private static readonly DateOnly TestDate = new(2026, 7, 1);

    private static RecordExpenseRequest TestRequest(string key = "k1") =>
        new(150m, "Gardening", "Maintenance", TestDate, key);

    [Fact]
    public async Task Admin_record_returns_201()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new RecordExpense(new FakeSession(ctx), new FakeExpenseStore());

        var result = await ExpenseEndpoints.RecordExpenseEndpoint(useCase, TestRequest(), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status201Created, status.StatusCode);
    }

    [Fact]
    public async Task Duplicate_key_returns_200()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakeExpenseStore();
        var useCase = new RecordExpense(new FakeSession(ctx), store);
        await useCase.ExecuteAsync(100m, "X", "Y", TestDate, "dup");

        var result = await ExpenseEndpoints.RecordExpenseEndpoint(useCase, TestRequest("dup"), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task Non_admin_record_returns_403()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var useCase = new RecordExpense(new FakeSession(ctx), new FakeExpenseStore());

        var result = await ExpenseEndpoints.RecordExpenseEndpoint(useCase, TestRequest(), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task No_session_record_returns_403()
    {
        var useCase = new RecordExpense(new FakeSession(null), new FakeExpenseStore());

        var result = await ExpenseEndpoints.RecordExpenseEndpoint(useCase, TestRequest(), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Resident_list_returns_200()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var store = new FakeExpenseStore();
        await store.RecordExpenseAsync(
            new AssociationExpense(Guid.NewGuid(), 100m, "X", "Y", TestDate, DateTimeOffset.UtcNow, "k1"), default);
        var useCase = new ListExpenses(new FakeSession(ctx), store);

        var result = await ExpenseEndpoints.ListExpensesEndpoint(useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task No_session_list_returns_403()
    {
        var useCase = new ListExpenses(new FakeSession(null), new FakeExpenseStore());

        var result = await ExpenseEndpoints.ListExpensesEndpoint(useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }
}
