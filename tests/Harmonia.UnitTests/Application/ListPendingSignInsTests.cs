using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class ListPendingSignInsTests
{
    private static SessionContext AdminSession()
        => new(IsResident: false, IsAdmin: true, HouseholdRef: null,
               EntraObjectId: "admin-1", IsPending: false);

    private static ListPendingSignIns UseCase(SessionContext? ctx, List<PendingSignIn>? pending = null)
    {
        var store = new FakePendingSignInStoreV2 { Pending = pending ?? [] };
        return new ListPendingSignIns(new FakeSession(ctx), store);
    }

    [Fact]
    public async Task Admin_returns_Ok_with_items()
    {
        var items = new List<PendingSignIn>
        {
            new("oid-1", "a@x.com", "Alice", DateTimeOffset.UtcNow.AddDays(-2)),
            new("oid-2", "b@x.com", "Bob",   DateTimeOffset.UtcNow.AddDays(-1))
        };

        var result = await UseCase(AdminSession(), items).ExecuteAsync();

        var ok = Assert.IsType<ListPendingResult.Ok>(result);
        Assert.Equal(2, ok.Items.Count);
        Assert.Equal("oid-1", ok.Items[0].EntraObjectId);
        Assert.Equal("oid-2", ok.Items[1].EntraObjectId);
    }

    [Fact]
    public async Task Admin_returns_Ok_empty_list()
    {
        var result = await UseCase(AdminSession()).ExecuteAsync();

        var ok = Assert.IsType<ListPendingResult.Ok>(result);
        Assert.Empty(ok.Items);
    }

    [Fact]
    public async Task Non_admin_session_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false,
            HouseholdRef: new HouseholdRef("HH-1"), EntraObjectId: "oid-1", IsPending: false);

        var result = await UseCase(ctx).ExecuteAsync();

        Assert.IsType<ListPendingResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var result = await UseCase(null).ExecuteAsync();

        Assert.IsType<ListPendingResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new ListPendingSignIns(new FakeSession(AdminSession()), new FailingPendingSignInStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<ListPendingResult.Failed>(result);
    }
}
