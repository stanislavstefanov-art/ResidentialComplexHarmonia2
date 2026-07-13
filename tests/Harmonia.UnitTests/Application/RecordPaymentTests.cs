using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.UnitTests.Application;

public class RecordPaymentTests
{
    private static (RecordPayment UseCase, FakePaymentStore Store) Build(SessionContext? ctx)
    {
        var store = new FakePaymentStore();
        return (new RecordPayment(new FakeSession(ctx), store, new FakeNotificationDispatcher()), store);
    }

    [Fact]
    public async Task Admin_creates_payment()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var (useCase, _) = Build(ctx);

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var created = Assert.IsType<RecordPaymentResult.Created>(result);
        Assert.Equal(new HouseholdRef("HH-1"), created.Payment.HouseholdRef);
        Assert.Equal(500m, created.Payment.AmountEur);
        Assert.Equal("2026-07", created.Payment.Period);
        Assert.Equal(new DateOnly(2026, 7, 10), created.Payment.DateReceived);
    }

    [Fact]
    public async Task Duplicate_idempotency_key_returns_Duplicate()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var (useCase, _) = Build(ctx);
        await useCase.ExecuteAsync("HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        Assert.IsType<RecordPaymentResult.Duplicate>(result);
    }

    [Fact]
    public async Task Non_admin_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var (useCase, _) = Build(ctx);

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        Assert.IsType<RecordPaymentResult.Refused>(result);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var (useCase, _) = Build(null);

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        Assert.IsType<RecordPaymentResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new RecordPayment(new FakeSession(ctx), new FailingPaymentStore(), new FakeNotificationDispatcher());

        var result = await useCase.ExecuteAsync(
            "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

        Assert.IsType<RecordPaymentResult.Failed>(result);
    }
}
