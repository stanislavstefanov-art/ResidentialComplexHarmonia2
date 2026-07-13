using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.UnitTests.Application;

public class RecordChargeTests
{
    private static readonly HouseholdRef TargetHousehold = new("HH-TARGET");

    private static SessionContext AdminCtx =>
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    private static RecordCharge UseCase(IMaintenanceFeeStore store, SessionContext? ctx = null)
        => new(new FakeSession(ctx ?? AdminCtx), store, new FakeNotificationDispatcher());

    [Fact] // Non-admin session is refused — admin guard
    public async Task Non_admin_returns_refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var store = new FakeMaintenanceFeeStore();
        var useCase = new RecordCharge(new FakeSession(ctx), store, new FakeNotificationDispatcher());

        var result = await useCase.ExecuteAsync(
            TargetHousehold, 100m, "Maintenance", "2026-07", "key-1");

        Assert.IsType<RecordChargeResult.Refused>(result);
        Assert.Empty(store.RecordedCharges);
    }

    [Fact] // No session at all — refused
    public async Task No_session_returns_refused()
    {
        var store = new FakeMaintenanceFeeStore();
        var useCase = new RecordCharge(new FakeSession(null), store, new FakeNotificationDispatcher());

        var result = await useCase.ExecuteAsync(
            TargetHousehold, 100m, "Maintenance", "2026-07", "key-1");

        Assert.IsType<RecordChargeResult.Refused>(result);
    }

    [Fact] // Admin creates a new charge — 201-shaped Created result
    public async Task Admin_creates_new_charge_returns_created()
    {
        var store = new FakeMaintenanceFeeStore();

        var result = await UseCase(store).ExecuteAsync(
            TargetHousehold, 250m, "Monthly fee", "2026-07", "idem-abc");

        var created = Assert.IsType<RecordChargeResult.Created>(result);
        Assert.Equal(TargetHousehold, created.Charge.HouseholdRef);
        Assert.Equal(250m, created.Charge.AmountEur);
        Assert.Equal("Monthly fee", created.Charge.Description);
        Assert.Equal("2026-07", created.Charge.Period);
        Assert.Equal("idem-abc", created.Charge.IdempotencyKey);
        Assert.Single(store.RecordedCharges);
    }

    [Fact] // Duplicate idempotency key — 200-shaped Duplicate result, no second row
    public async Task Duplicate_idempotency_key_returns_duplicate_without_new_row()
    {
        var store = new FakeMaintenanceFeeStore();
        await UseCase(store).ExecuteAsync(TargetHousehold, 250m, "Fee", "2026-07", "idem-dup");

        var result = await UseCase(store).ExecuteAsync(
            TargetHousehold, 250m, "Fee", "2026-07", "idem-dup");

        Assert.IsType<RecordChargeResult.Duplicate>(result);
        Assert.Single(store.RecordedCharges); // still only one row
    }

    [Fact] // Target household comes from route param (R2 exception on admin POST)
    public async Task Target_household_is_passed_to_store_not_from_session()
    {
        var other = new HouseholdRef("HH-OTHER");
        var store = new FakeMaintenanceFeeStore();

        await UseCase(store).ExecuteAsync(other, 100m, "Fee", "2026-07", "key-x");

        var charge = Assert.Single(store.RecordedCharges);
        Assert.Equal(other, charge.HouseholdRef);
    }

    [Fact] // Store failure returns Failed, not an unhandled exception
    public async Task Store_failure_returns_failed()
    {
        var result = await UseCase(new FailingMaintenanceFeeStore()).ExecuteAsync(
            TargetHousehold, 100m, "Fee", "2026-07", "key-fail");

        Assert.IsType<RecordChargeResult.Failed>(result);
    }
}
