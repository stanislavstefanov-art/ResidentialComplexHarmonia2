using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class RecordChargeNotificationTests
{
    private static readonly HouseholdRef Target = new("HH-NOTIFY-1");
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Created_charge_dispatches_ChargePosted()
    {
        var store      = new FakeMaintenanceFeeStore();
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordCharge(new FakeSession(AdminCtx), store, dispatcher);

        await useCase.ExecuteAsync(Target, 100m, "Fee", "2026-07", "key-notify-1");

        Assert.Single(dispatcher.DispatchCalls);
        Assert.Equal(NotificationKind.ChargePosted, dispatcher.DispatchCalls[0].Kind);
        Assert.Equal(Target, dispatcher.DispatchCalls[0].HouseholdRef);
    }

    [Fact]
    public async Task Duplicate_charge_does_not_dispatch()
    {
        var store      = new FakeMaintenanceFeeStore();
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordCharge(new FakeSession(AdminCtx), store, dispatcher);

        await useCase.ExecuteAsync(Target, 100m, "Fee", "2026-07", "key-dup");
        dispatcher.DispatchCalls.Clear();

        await useCase.ExecuteAsync(Target, 100m, "Fee", "2026-07", "key-dup");

        Assert.Empty(dispatcher.DispatchCalls);
    }

    [Fact]
    public async Task Store_failure_does_not_dispatch()
    {
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordCharge(new FakeSession(AdminCtx), new FailingMaintenanceFeeStore(), dispatcher);

        await useCase.ExecuteAsync(Target, 100m, "Fee", "2026-07", "key-fail");

        Assert.Empty(dispatcher.DispatchCalls);
    }
}
