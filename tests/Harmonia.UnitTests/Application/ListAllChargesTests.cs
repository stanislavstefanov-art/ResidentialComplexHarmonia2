using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Application;

public class ListAllChargesTests
{
    private static SessionContext AdminCtx =>
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Admin_can_list_all_charges()
    {
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge(new HouseholdRef("HH-A"), "k1"), default);
        await store.RecordChargeAsync(MakeCharge(new HouseholdRef("HH-B"), "k2"), default);
        var useCase = new ListAllCharges(new FakeSession(AdminCtx), store);

        var result = await useCase.ExecuteAsync();

        var ok = Assert.IsType<ListAllChargesResult.Ok>(result);
        Assert.Equal(2, ok.Charges.Count);
    }

    [Fact]
    public async Task Resident_returns_refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-A"));
        var useCase = new ListAllCharges(new FakeSession(ctx), new FakeMaintenanceFeeStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListAllChargesResult.Refused>(result);
    }

    [Fact]
    public async Task No_session_returns_refused()
    {
        var useCase = new ListAllCharges(new FakeSession(null), new FakeMaintenanceFeeStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListAllChargesResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_failed()
    {
        var useCase = new ListAllCharges(new FakeSession(AdminCtx), new FailingMaintenanceFeeStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListAllChargesResult.Failed>(result);
    }

    private static MaintenanceFeeCharge MakeCharge(HouseholdRef household, string key) =>
        new(Guid.NewGuid(), household, 100m, "Fee", "2026-07", DateTimeOffset.UtcNow, key);
}
