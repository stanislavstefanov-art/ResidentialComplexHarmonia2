using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;
using Harmonia.Domain.Payments;

namespace Harmonia.UnitTests.Application;

public class GetBalanceTests
{
    private static MaintenanceFeeCharge MakeCharge(
        string hh, decimal amount, string period, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(hh), amount, "Monthly fee", period,
            DateTimeOffset.UtcNow, key);

    private static MaintenanceFeePayment MakePayment(
        string hh, decimal amount, string period, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(hh), amount, period,
            new DateOnly(2026, 7, 10), DateTimeOffset.UtcNow, key);

    [Fact]
    public async Task Admin_sees_all_apartments_for_period()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var feeStore = new FakeMaintenanceFeeStore();
        var payStore = new FakePaymentStore();
        await feeStore.RecordChargeAsync(MakeCharge("HH-1", 300m, "2026-07", "c1"), default);
        await feeStore.RecordChargeAsync(MakeCharge("HH-2", 400m, "2026-07", "c2"), default);
        await payStore.RecordPaymentAsync(MakePayment("HH-1", 200m, "2026-07", "p1"), default);
        var useCase = new GetBalance(new FakeSession(ctx), feeStore, payStore);

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetBalanceResult.Ok>(result);
        Assert.Equal("2026-07", ok.Label);
        Assert.Equal(2, ok.Lines.Count);
        var hh1 = ok.Lines.Single(l => l.HouseholdRef.Value == "HH-1");
        Assert.Equal(300m, hh1.TotalCharged);
        Assert.Equal(200m, hh1.TotalPaid);
        Assert.Equal(100m, hh1.Balance);
        var hh2 = ok.Lines.Single(l => l.HouseholdRef.Value == "HH-2");
        Assert.Equal(400m, hh2.TotalCharged);
        Assert.Equal(0m,   hh2.TotalPaid);
        Assert.Equal(400m, hh2.Balance);
    }

    [Fact]
    public async Task Resident_sees_only_own_apartment()
    {
        var hh = new HouseholdRef("HH-1");
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: hh);
        var feeStore = new FakeMaintenanceFeeStore();
        var payStore = new FakePaymentStore();
        await feeStore.RecordChargeAsync(MakeCharge("HH-1", 300m, "2026-07", "c1"), default);
        await feeStore.RecordChargeAsync(MakeCharge("HH-2", 400m, "2026-07", "c2"), default);
        await payStore.RecordPaymentAsync(MakePayment("HH-1", 150m, "2026-07", "p1"), default);
        var useCase = new GetBalance(new FakeSession(ctx), feeStore, payStore);

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetBalanceResult.Ok>(result);
        Assert.Single(ok.Lines);
        Assert.Equal("HH-1", ok.Lines[0].HouseholdRef.Value);
        Assert.Equal(300m, ok.Lines[0].TotalCharged);
        Assert.Equal(150m, ok.Lines[0].TotalPaid);
        Assert.Equal(150m, ok.Lines[0].Balance);
    }

    [Fact]
    public async Task YTD_label_and_filter_applied_when_no_period()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var feeStore = new FakeMaintenanceFeeStore();
        var payStore = new FakePaymentStore();
        var year = DateTime.UtcNow.Year;
        await feeStore.RecordChargeAsync(
            MakeCharge("HH-1", 100m, $"{year}-01", "c1"), default);
        await feeStore.RecordChargeAsync(
            MakeCharge("HH-1", 100m, $"{year - 1}-12", "c2"), default);
        var useCase = new GetBalance(new FakeSession(ctx), feeStore, payStore);

        var result = await useCase.ExecuteAsync(null);

        var ok = Assert.IsType<GetBalanceResult.Ok>(result);
        Assert.Equal($"YTD-{year}", ok.Label);
        Assert.Single(ok.Lines);
        Assert.Equal(100m, ok.Lines[0].TotalCharged);
    }

    [Fact]
    public async Task Invalid_period_returns_InvalidPeriod()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var useCase = new GetBalance(
            new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakePaymentStore());

        var result = await useCase.ExecuteAsync("bad-period");

        Assert.IsType<GetBalanceResult.InvalidPeriod>(result);
    }

    [Fact]
    public async Task Empty_data_returns_empty_lines()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new GetBalance(
            new FakeSession(ctx), new FakeMaintenanceFeeStore(), new FakePaymentStore());

        var result = await useCase.ExecuteAsync("2026-07");

        var ok = Assert.IsType<GetBalanceResult.Ok>(result);
        Assert.Empty(ok.Lines);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new GetBalance(
            new FakeSession(null), new FakeMaintenanceFeeStore(), new FakePaymentStore());

        var result = await useCase.ExecuteAsync("2026-07");

        Assert.IsType<GetBalanceResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new GetBalance(
            new FakeSession(ctx), new FailingMaintenanceFeeStore(), new FakePaymentStore());

        var result = await useCase.ExecuteAsync("2026-07");

        Assert.IsType<GetBalanceResult.Failed>(result);
    }
}
