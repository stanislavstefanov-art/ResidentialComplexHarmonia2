using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class ActivatePendingSignInsTests
{
    private static SessionContext AdminSession()
        => new(IsResident: false, IsAdmin: true, HouseholdRef: null,
               EntraObjectId: "admin-1", IsPending: false);

    private static ActivatePendingSignIn UseCase(SessionContext? ctx, FakePendingSignInStoreV2? store = null)
    {
        store ??= new FakePendingSignInStoreV2();
        return new ActivatePendingSignIn(new FakeSession(ctx), store);
    }

    [Fact]
    public async Task Admin_with_pending_oid_returns_Ok()
    {
        var pending = new List<PendingSignIn>
        {
            new("oid-1", "a@x.com", "Alice", DateTimeOffset.UtcNow.AddDays(-1))
        };
        var store = new FakePendingSignInStoreV2 { Pending = pending };
        var useCase = new ActivatePendingSignIn(new FakeSession(AdminSession()), store);

        var result = await useCase.ExecuteAsync("oid-1", "HH-1", "Owner");

        Assert.IsType<ActivatePendingSignInResult.Ok>(result);
        Assert.Empty(store.Pending);
    }

    [Fact]
    public async Task Admin_with_unknown_oid_returns_NotFound()
    {
        var store = new FakePendingSignInStoreV2 { Pending = [] };
        var useCase = new ActivatePendingSignIn(new FakeSession(AdminSession()), store);

        var result = await useCase.ExecuteAsync("oid-unknown", "HH-1", "Owner");

        Assert.IsType<ActivatePendingSignInResult.NotFound>(result);
    }

    [Fact]
    public async Task Admin_with_already_activated_oid_returns_AlreadyActivated()
    {
        var store = new FakePendingSignInStoreV2();
        store.AlreadyActivated.Add("oid-activated");
        var useCase = new ActivatePendingSignIn(new FakeSession(AdminSession()), store);

        var result = await useCase.ExecuteAsync("oid-activated", "HH-1", "Owner");

        Assert.IsType<ActivatePendingSignInResult.AlreadyActivated>(result);
    }

    [Fact]
    public async Task Non_admin_session_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false,
            HouseholdRef: new HouseholdRef("HH-1"), EntraObjectId: "oid-1", IsPending: false);

        var result = await UseCase(ctx).ExecuteAsync("oid-1", "HH-1", "Owner");

        Assert.IsType<ActivatePendingSignInResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var result = await UseCase(null).ExecuteAsync("oid-1", "HH-1", "Owner");

        Assert.IsType<ActivatePendingSignInResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new ActivatePendingSignIn(new FakeSession(AdminSession()), new FailingPendingSignInStore());

        var result = await useCase.ExecuteAsync("oid-1", "HH-1", "Owner");

        Assert.IsType<ActivatePendingSignInResult.Failed>(result);
    }
}
