using Harmonia.Application;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.UnitTests.Application;

public class ListMyPaymentsTests
{
    private static MaintenanceFeePayment MakePayment(string hh, string key) =>
        new(Guid.NewGuid(), new HouseholdRef(hh), 500m, "2026-07",
            new DateOnly(2026, 7, 10), DateTimeOffset.UtcNow, key);

    [Fact]
    public async Task Resident_sees_only_own_payments()
    {
        var hh = new HouseholdRef("HH-1");
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: hh);
        var store = new FakePaymentStore();
        await store.RecordPaymentAsync(MakePayment("HH-1", "p1"), default);
        await store.RecordPaymentAsync(MakePayment("HH-2", "p2"), default);
        var useCase = new ListMyPayments(new FakeSession(ctx), store);

        var result = await useCase.ExecuteAsync();

        var ok = Assert.IsType<ListPaymentsResult.Ok>(result);
        Assert.Single(ok.Payments);
        Assert.Equal(hh, ok.Payments[0].HouseholdRef);
    }

    [Fact]
    public async Task Admin_with_no_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new ListMyPayments(new FakeSession(ctx), new FakePaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Refused>(result);
    }

    [Fact]
    public async Task No_session_returns_Refused()
    {
        var useCase = new ListMyPayments(new FakeSession(null), new FakePaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Refused>(result);
    }

    [Fact]
    public async Task Store_error_returns_Failed()
    {
        var hh = new HouseholdRef("HH-1");
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: hh);
        var useCase = new ListMyPayments(new FakeSession(ctx), new FailingPaymentStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPaymentsResult.Failed>(result);
    }
}
