using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Application;

public class ListChargesTests
{
    private static readonly HouseholdRef Household = new("HH-LIST");

    private static SessionContext ResidentCtx(string ref1 = "HH-LIST")
        => new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef(ref1));

    private static SessionContext AdminCtx =>
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact] // No session — refused
    public async Task No_session_returns_refused()
    {
        var result = await new ListCharges(new FakeSession(null), new FakeMaintenanceFeeStore())
            .ExecuteAsync(Household);

        Assert.IsType<ListChargesResult.Refused>(result);
    }

    [Fact] // Non-resident, non-admin — refused
    public async Task Non_resident_non_admin_returns_refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-X"));
        var result = await new ListCharges(new FakeSession(ctx), new FakeMaintenanceFeeStore())
            .ExecuteAsync(Household);

        Assert.IsType<ListChargesResult.Refused>(result);
    }

    [Fact] // Resident reading own charges — allowed
    public async Task Resident_can_read_own_charges()
    {
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge("idem-1"), default);

        var result = await new ListCharges(new FakeSession(ResidentCtx()), store)
            .ExecuteAsync(Household);

        var ok = Assert.IsType<ListChargesResult.Ok>(result);
        Assert.Single(ok.Charges);
    }

    [Fact] // Resident reading another household's charges — refused
    public async Task Resident_cannot_read_other_household_charges()
    {
        var other = new HouseholdRef("HH-OTHER");
        var result = await new ListCharges(new FakeSession(ResidentCtx()), new FakeMaintenanceFeeStore())
            .ExecuteAsync(other);

        Assert.IsType<ListChargesResult.Refused>(result);
    }

    [Fact] // Admin can read any household
    public async Task Admin_can_read_any_household()
    {
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge("idem-2"), default);

        var result = await new ListCharges(new FakeSession(AdminCtx), store)
            .ExecuteAsync(Household);

        var ok = Assert.IsType<ListChargesResult.Ok>(result);
        Assert.Single(ok.Charges);
    }

    [Fact] // Empty ledger returns Ok with empty list, not Refused
    public async Task Empty_ledger_returns_ok_with_empty_list()
    {
        var result = await new ListCharges(new FakeSession(ResidentCtx()), new FakeMaintenanceFeeStore())
            .ExecuteAsync(Household);

        var ok = Assert.IsType<ListChargesResult.Ok>(result);
        Assert.Empty(ok.Charges);
    }

    private static MaintenanceFeeCharge MakeCharge(string idempotencyKey) =>
        new(Guid.NewGuid(), Household, 100m, "Fee", "2026-07", DateTimeOffset.UtcNow, idempotencyKey);
}
