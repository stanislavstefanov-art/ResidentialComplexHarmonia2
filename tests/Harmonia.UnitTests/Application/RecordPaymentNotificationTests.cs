using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Application.Payments;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class RecordPaymentNotificationTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Created_payment_dispatches_PaymentRecorded()
    {
        var store      = new FakePaymentStore();
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordPayment(new FakeSession(AdminCtx), store, dispatcher);

        await useCase.ExecuteAsync("HH-PAY-N1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-notify-1");

        Assert.Single(dispatcher.DispatchCalls);
        Assert.Equal(NotificationKind.PaymentRecorded, dispatcher.DispatchCalls[0].Kind);
        Assert.Equal(new HouseholdRef("HH-PAY-N1"), dispatcher.DispatchCalls[0].HouseholdRef);
    }

    [Fact]
    public async Task Duplicate_payment_does_not_dispatch()
    {
        var store      = new FakePaymentStore();
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordPayment(new FakeSession(AdminCtx), store, dispatcher);

        await useCase.ExecuteAsync("HH-PAY-N2", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-dup");
        dispatcher.DispatchCalls.Clear();

        await useCase.ExecuteAsync("HH-PAY-N2", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-dup");

        Assert.Empty(dispatcher.DispatchCalls);
    }

    [Fact]
    public async Task Store_failure_does_not_dispatch()
    {
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordPayment(new FakeSession(AdminCtx), new FailingPaymentStore(), dispatcher);

        await useCase.ExecuteAsync("HH-PAY-N3", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-fail");

        Assert.Empty(dispatcher.DispatchCalls);
    }
}
