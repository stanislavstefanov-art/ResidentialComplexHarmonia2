using Harmonia.Api.Reservations.Adapters;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlListAllChargesTests(SqlServerFixture fixture)
{
    private SqlMaintenanceFeeStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task All_charges_ordered_by_household_then_newest_first()
    {
        var hA = new HouseholdRef($"HH-ALLA-{Guid.NewGuid():N}");
        var hB = new HouseholdRef($"HH-ALLB-{Guid.NewGuid():N}");
        var store = Store;

        await store.RecordChargeAsync(new MaintenanceFeeCharge(
            Guid.NewGuid(), hB, 10m, "Fee", "2026-05",
            new DateTimeOffset(2026, 5, 1, 0, 0, 0, TimeSpan.Zero), $"kb1-{Guid.NewGuid():N}"), default);
        await store.RecordChargeAsync(new MaintenanceFeeCharge(
            Guid.NewGuid(), hA, 30m, "Fee", "2026-07",
            new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero), $"ka2-{Guid.NewGuid():N}"), default);
        await store.RecordChargeAsync(new MaintenanceFeeCharge(
            Guid.NewGuid(), hA, 20m, "Fee", "2026-06",
            new DateTimeOffset(2026, 6, 1, 0, 0, 0, TimeSpan.Zero), $"ka3-{Guid.NewGuid():N}"), default);

        var all = await store.ListAllChargesAsync();

        // hA/hB contain unique GUIDs; filter is exact-match so only the 3 rows above can match.
        var ours = all.Where(c => c.HouseholdRef == hA || c.HouseholdRef == hB).ToList();
        Assert.True(ours.Count >= 3, $"Expected at least 3 rows for unique refs {hA.Value} and {hB.Value}");
        Assert.Equal(hA, ours[0].HouseholdRef);
        Assert.Equal(30m, ours[0].AmountEur);
        Assert.Equal(hA, ours[1].HouseholdRef);
        Assert.Equal(20m, ours[1].AmountEur);
        Assert.Equal(hB, ours[2].HouseholdRef);
        Assert.Equal(10m, ours[2].AmountEur);
    }

    [Fact]
    public async Task Returns_non_null_list()
    {
        var all = await Store.ListAllChargesAsync();
        Assert.NotNull(all);
    }
}
