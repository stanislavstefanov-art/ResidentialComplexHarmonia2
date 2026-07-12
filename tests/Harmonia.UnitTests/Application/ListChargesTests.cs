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

    [Fact] // No session — refused
    public async Task No_session_returns_refused()
    {
        var result = await new ListCharges(new FakeSession(null), new FakeMaintenanceFeeStore())
            .ExecuteAsync();

        Assert.IsType<ListChargesResult.Refused>(result);
    }

    [Fact] // Non-resident, non-admin — refused
    public async Task Non_resident_non_admin_returns_refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-X"));
        var result = await new ListCharges(new FakeSession(ctx), new FakeMaintenanceFeeStore())
            .ExecuteAsync();

        Assert.IsType<ListChargesResult.Refused>(result);
    }

    [Fact] // Resident reading own charges — allowed (household derived from session)
    public async Task Resident_can_read_own_charges()
    {
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge("idem-1"), default);

        var result = await new ListCharges(new FakeSession(ResidentCtx()), store)
            .ExecuteAsync();

        var ok = Assert.IsType<ListChargesResult.Ok>(result);
        Assert.Single(ok.Charges);
    }

    [Fact] // Admin is refused — admin listing is out of scope (spec §2)
    public async Task Admin_returns_refused()
    {
        var adminCtx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakeMaintenanceFeeStore();
        await store.RecordChargeAsync(MakeCharge("idem-2"), default);

        var result = await new ListCharges(new FakeSession(adminCtx), store)
            .ExecuteAsync();

        Assert.IsType<ListChargesResult.Refused>(result);
    }

    [Fact] // Store error returns Failed, not an unhandled exception
    public async Task Store_error_returns_failed()
    {
        var result = await new ListCharges(new FakeSession(ResidentCtx()), new FailingMaintenanceFeeStore())
            .ExecuteAsync();

        Assert.IsType<ListChargesResult.Failed>(result);
    }

    [Fact] // Empty ledger returns Ok with empty list, not Refused
    public async Task Empty_ledger_returns_ok_with_empty_list()
    {
        var result = await new ListCharges(new FakeSession(ResidentCtx()), new FakeMaintenanceFeeStore())
            .ExecuteAsync();

        var ok = Assert.IsType<ListChargesResult.Ok>(result);
        Assert.Empty(ok.Charges);
    }

    private static MaintenanceFeeCharge MakeCharge(string idempotencyKey) =>
        new(Guid.NewGuid(), Household, 100m, "Fee", "2026-07", DateTimeOffset.UtcNow, idempotencyKey);
}
