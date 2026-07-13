using Harmonia.Application;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.UnitTests.Application;

public class ListAllPaymentsTests
{
    private static MaintenanceFeePayment MakePayment(string hh, string period, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(hh), 500m, period,
            new DateOnly(2026, 7, 10), DateTimeOffset.UtcNow, key);

    [Fact]
    public async Task Admin_returns_all_payments()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var store = new FakePaymentStore();
        await store.RecordPaymentAsync(MakePayment("HH-1", "2026-07", "p1"), default);
        await store.RecordPaymentAsync(MakePayment("HH-2", "2026-07", "p2"), default);
        var useCase = new ListAllPayments(new FakeSession(ctx), store);

        var result = await useCase.ExecuteAsync();

        var ok = Assert.IsType<ListPaymentsResult.Ok>(result);
        Assert.Equal(2, ok.Payments.Count);
    }

    [Fact]
    public async Task Non_admin_returns_Refused()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var useCase = new ListAllPayments(new FakeSession(ctx), new FakePaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Refused>(result);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new ListAllPayments(new FakeSession(null), new FakePaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new ListAllPayments(new FakeSession(ctx), new FailingPaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Failed>(result);
    }
}
