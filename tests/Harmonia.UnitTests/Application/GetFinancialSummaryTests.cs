using Harmonia.Application;
using Harmonia.Application.FinancialSummary;
using Harmonia.Domain;
using Harmonia.Domain.Expenses;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Application;

public class GetFinancialSummaryTests
{
    [Fact]
    public async Task Resident_gets_summary_with_correct_totals()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var feeStore = new FakeMaintenanceFeeStore();
        var expStore = new FakeExpenseStore();
        await feeStore.RecordChargeAsync(MakeCharge(150m, "2026-07", "c1"), default);
        await feeStore.RecordChargeAsync(MakeCharge(50m, "2026-06", "c2"), default);
        await expStore.RecordExpenseAsync(MakeExpense(200m, new DateOnly(2026, 7, 15), "e1"), default);
        await expStore.RecordExpenseAsync(MakeExpense(99m, new DateOnly(2026, 6, 30), "e2"), default);
        var useCase = new GetFinancialSummary(new FakeSession(ctx), feeStore, expStore);

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetFinancialSummaryResult.Ok>(result);
        Assert.Equal("2026-07", ok.Period);
        Assert.Equal(150m, ok.TotalChargesEur);
        Assert.Equal(200m, ok.TotalExpensesEur);
    }

    [Fact]
    public async Task Admin_gets_empty_summary_with_no_data()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new GetFinancialSummary(new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakeExpenseStore());

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetFinancialSummaryResult.Ok>(result);
        Assert.Equal(0m, ok.TotalChargesEur);
        Assert.Equal(0m, ok.TotalExpensesEur);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new GetFinancialSummary(new FakeSession(null), new FakeMaintenanceFeeStore(), new FakeExpenseStore());

        var result = await useCase.ExecuteAsync("2026-07");

        Assert.IsType<GetFinancialSummaryResult.Refused>(result);
    }

    [Fact]
    public async Task Invalid_period_format_returns_InvalidPeriod()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var useCase = new GetFinancialSummary(new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakeExpenseStore());

        Assert.IsType<GetFinancialSummaryResult.InvalidPeriod>(await useCase.ExecuteAsync("2026-7"));
        Assert.IsType<GetFinancialSummaryResult.InvalidPeriod>(await useCase.ExecuteAsync("202607"));
        Assert.IsType<GetFinancialSummaryResult.InvalidPeriod>(await useCase.ExecuteAsync(""));
        Assert.IsType<GetFinancialSummaryResult.InvalidPeriod>(await useCase.ExecuteAsync("2026-13"));
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var useCase = new GetFinancialSummary(new FakeSession(ctx), new FailingMaintenanceFeeStore(), new FakeExpenseStore());

        var result = await useCase.ExecuteAsync("2026-07");

        Assert.IsType<GetFinancialSummaryResult.Failed>(result);
    }

    [Fact]
    public async Task Expense_on_last_day_of_month_is_included()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var expStore = new FakeExpenseStore();
        await expStore.RecordExpenseAsync(MakeExpense(75m, new DateOnly(2026, 7, 31), "e-last"), default);
        var useCase = new GetFinancialSummary(new FakeSession(ctx), new FakeMaintenanceFeeStore(), expStore);

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetFinancialSummaryResult.Ok>(result);
        Assert.Equal(75m, ok.TotalExpensesEur);
    }

    private static MaintenanceFeeCharge MakeCharge(decimal amount, string period, string key) =>
        new(Guid.NewGuid(), new HouseholdRef("HH-1"), amount, "Test", period, DateTimeOffset.UtcNow, key);

    private static AssociationExpense MakeExpense(decimal amount, DateOnly date, string key) =>
        new(Guid.NewGuid(), amount, "Test", "Maintenance", date, DateTimeOffset.UtcNow, key);
}
