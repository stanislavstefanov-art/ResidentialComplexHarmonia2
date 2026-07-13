using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Payments;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlPaymentStoreTests(SqlServerFixture fixture)
{
    private SqlPaymentStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task Record_first_time_returns_Created_and_duplicate_returns_same_payment()
    {
        var store = Store;
        var payment = new MaintenanceFeePayment(
            Id:             Guid.NewGuid(),
            HouseholdRef:   new HouseholdRef("HH-PAY-TEST"),
            AmountEur:      750m,
            Period:         "2026-07",
            DateReceived:   new DateOnly(2026, 7, 15),
            RecordedAt:     DateTimeOffset.UtcNow,
            IdempotencyKey: $"pay-rel-{Guid.NewGuid():N}");

        var first  = await store.RecordPaymentAsync(payment);
        var second = await store.RecordPaymentAsync(payment);

        var created   = Assert.IsType<RecordPaymentResult.Created>(first);
        var duplicate = Assert.IsType<RecordPaymentResult.Duplicate>(second);
        Assert.Equal(created.Payment.Id, duplicate.Payment.Id);
        Assert.Equal(750m, duplicate.Payment.AmountEur);
        Assert.Equal(new DateOnly(2026, 7, 15), duplicate.Payment.DateReceived);
    }

    [Fact]
    public async Task ListPaymentsByHousehold_returns_only_that_household_ordered_desc()
    {
        var store = Store;
        var hh = new HouseholdRef($"HH-LIST-{Guid.NewGuid():N}");
        var p1 = MakePayment(hh, "2026-05", new DateOnly(2026, 5, 10),  $"k1-{Guid.NewGuid():N}");
        var p2 = MakePayment(hh, "2026-07", new DateOnly(2026, 7, 1),   $"k2-{Guid.NewGuid():N}");
        var other = MakePayment(
            new HouseholdRef("HH-OTHER"), "2026-07", new DateOnly(2026, 7, 5), $"k3-{Guid.NewGuid():N}");

        await store.RecordPaymentAsync(p1);
        await store.RecordPaymentAsync(p2);
        await store.RecordPaymentAsync(other);

        var payments = await store.ListPaymentsByHouseholdAsync(hh);
        Assert.Equal(2, payments.Count);
        Assert.All(payments, p => Assert.Equal(hh, p.HouseholdRef));
        Assert.True(payments[0].DateReceived >= payments[1].DateReceived);
    }

    private static MaintenanceFeePayment MakePayment(
        HouseholdRef hh, string period, DateOnly dateReceived, string key) =>
        new(Guid.NewGuid(), hh, 500m, period, dateReceived, DateTimeOffset.UtcNow, key);
}
