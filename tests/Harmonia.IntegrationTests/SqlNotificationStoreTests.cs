// tests/Harmonia.IntegrationTests/SqlNotificationStoreTests.cs
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlNotificationStoreTests(SqlServerFixture fixture)
{
    private SqlNotificationStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task Save_first_time_returns_Saved_IsNew_true()
    {
        var store = Store;
        var hh    = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");
        var sub   = MakeSub(hh);

        var result = await store.SaveSubscriptionAsync(sub);

        var saved = Assert.IsType<SaveSubscriptionResult.Saved>(result);
        Assert.True(saved.IsNew);
        Assert.Equal(hh, saved.Subscription.HouseholdRef);
    }

    [Fact]
    public async Task Save_second_time_returns_Saved_IsNew_false_and_updates_endpoint()
    {
        var store = Store;
        var hh    = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");
        await store.SaveSubscriptionAsync(MakeSub(hh, "https://push.example.com/v1"));

        var result = await store.SaveSubscriptionAsync(MakeSub(hh, "https://push.example.com/v2"));

        var saved = Assert.IsType<SaveSubscriptionResult.Saved>(result);
        Assert.False(saved.IsNew);
        Assert.Equal("https://push.example.com/v2", saved.Subscription.Endpoint);
    }

    [Fact]
    public async Task Remove_existing_returns_Removed()
    {
        var store = Store;
        var hh    = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");
        await store.SaveSubscriptionAsync(MakeSub(hh));

        var result = await store.RemoveSubscriptionAsync(hh);

        Assert.IsType<RemoveSubscriptionResult.Removed>(result);
    }

    [Fact]
    public async Task Remove_nonexistent_returns_NotFound()
    {
        var hh     = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");
        var result = await Store.RemoveSubscriptionAsync(hh);
        Assert.IsType<RemoveSubscriptionResult.NotFound>(result);
    }

    [Fact]
    public async Task GetHistory_returns_last_30_days_only()
    {
        var store = Store;
        var hh    = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");

        var recent = new NotificationRecord(Guid.NewGuid(), hh, "Recent", DateTimeOffset.UtcNow, "push");
        var old    = new NotificationRecord(Guid.NewGuid(), hh, "Old", DateTimeOffset.UtcNow.AddDays(-31), "push");

        await store.AppendHistoryAsync(recent);
        await store.AppendHistoryAsync(old);

        var records = await store.GetHistoryAsync(hh);

        Assert.Single(records);
        Assert.Equal("Recent", records[0].Title);
    }

    private static PushSubscription MakeSub(HouseholdRef hh, string endpoint = "https://push.example.com/test")
        => new(hh, endpoint, "p256key", "authkey", null, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);
}
