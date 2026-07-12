using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlMaintenanceFeeStoreTests(SqlServerFixture fixture)
{
    private static readonly HouseholdRef Household = new("HH-FEE-TEST");

    private SqlMaintenanceFeeStore Store => new(fixture.ConnectionString);

    private static MaintenanceFeeCharge MakeCharge(string idempotencyKey, decimal amount = 100m)
        => new(Guid.NewGuid(), Household, amount, "Monthly fee", "2026-07",
               DateTimeOffset.UtcNow, idempotencyKey);

    [Fact] // New charge is persisted and returned as Created
    public async Task New_charge_is_persisted_and_returned_as_created()
    {
        var charge = MakeCharge($"idem-{Guid.NewGuid():N}");

        var result = await Store.RecordChargeAsync(charge);

        var created = Assert.IsType<RecordChargeResult.Created>(result);
        Assert.Equal(charge.Id, created.Charge.Id);
        Assert.Equal(charge.AmountEur, created.Charge.AmountEur);
    }

    [Fact] // Duplicate idempotency key returns Duplicate with the original charge
    public async Task Duplicate_idempotency_key_returns_duplicate_with_original()
    {
        var key = $"idem-{Guid.NewGuid():N}";
        var first = MakeCharge(key, 100m);
        await Store.RecordChargeAsync(first);

        var duplicate = MakeCharge(key, 999m); // different amount, same key
        var result = await Store.RecordChargeAsync(duplicate);

        var dup = Assert.IsType<RecordChargeResult.Duplicate>(result);
        Assert.Equal(first.Id, dup.Charge.Id); // original row returned
        Assert.Equal(100m, dup.Charge.AmountEur); // amount is the original, not 999
    }

    [Fact] // Listed charges are ordered by ChargedAt descending (newest first)
    public async Task Listed_charges_are_ordered_newest_first()
    {
        var h = new HouseholdRef($"HH-ORDER-{Guid.NewGuid():N}");
        var store = new SqlMaintenanceFeeStore(fixture.ConnectionString);

        await store.RecordChargeAsync(new MaintenanceFeeCharge(
            Guid.NewGuid(), h, 10m, "Fee", "2026-05",
            new DateTimeOffset(2026, 5, 1, 0, 0, 0, TimeSpan.Zero),
            $"k1-{Guid.NewGuid():N}"));
        await store.RecordChargeAsync(new MaintenanceFeeCharge(
            Guid.NewGuid(), h, 20m, "Fee", "2026-06",
            new DateTimeOffset(2026, 6, 1, 0, 0, 0, TimeSpan.Zero),
            $"k2-{Guid.NewGuid():N}"));
        await store.RecordChargeAsync(new MaintenanceFeeCharge(
            Guid.NewGuid(), h, 30m, "Fee", "2026-07",
            new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero),
            $"k3-{Guid.NewGuid():N}"));

        var charges = await store.ListChargesAsync(h);

        Assert.Equal(3, charges.Count);
        Assert.Equal(30m, charges[0].AmountEur); // most recent first
        Assert.Equal(20m, charges[1].AmountEur);
        Assert.Equal(10m, charges[2].AmountEur);
    }

    [Fact] // Empty household returns empty list, not error
    public async Task Empty_household_returns_empty_list()
    {
        var empty = new HouseholdRef($"HH-EMPTY-{Guid.NewGuid():N}");

        var charges = await Store.ListChargesAsync(empty);

        Assert.Empty(charges);
    }
}
