using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class PurgeExpiredPendingSignInsTests
{
    private static SessionContext AdminSession()
        => new(IsResident: false, IsAdmin: true, HouseholdRef: null,
               EntraObjectId: "admin-1", IsPending: false);

    private static PurgeExpiredPendingSignIns UseCase(SessionContext? ctx, List<PendingSignIn>? pending = null)
    {
        var store = new FakePendingSignInStoreV2 { Pending = pending ?? [] };
        return new PurgeExpiredPendingSignIns(new FakeSession(ctx), store);
    }

    [Fact]
    public async Task Admin_with_expired_rows_returns_Ok_with_correct_count()
    {
        var items = new List<PendingSignIn>
        {
            new("oid-1", "a@x.com", "Alice", DateTimeOffset.UtcNow.AddDays(-91)),
            new("oid-2", "b@x.com", "Bob",   DateTimeOffset.UtcNow.AddDays(-95)),
            new("oid-3", "c@x.com", "Carol", DateTimeOffset.UtcNow.AddDays(-1))  // recent, not purged
        };

        var result = await UseCase(AdminSession(), items).ExecuteAsync();

        var ok = Assert.IsType<PurgeExpiredPendingResult.Ok>(result);
        Assert.Equal(2, ok.Deleted);
    }

    [Fact]
    public async Task Admin_with_no_expired_rows_returns_Ok_zero()
    {
        var items = new List<PendingSignIn>
        {
            new("oid-1", "a@x.com", "Alice", DateTimeOffset.UtcNow.AddDays(-1)),
            new("oid-2", "b@x.com", "Bob",   DateTimeOffset.UtcNow.AddDays(-2))
        };

        var result = await UseCase(AdminSession(), items).ExecuteAsync();

        var ok = Assert.IsType<PurgeExpiredPendingResult.Ok>(result);
        Assert.Equal(0, ok.Deleted);
    }

    [Fact]
    public async Task Non_admin_session_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false,
            HouseholdRef: new HouseholdRef("HH-1"), EntraObjectId: "oid-1", IsPending: false);

        var result = await UseCase(ctx).ExecuteAsync();

        Assert.IsType<PurgeExpiredPendingResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var result = await UseCase(null).ExecuteAsync();

        Assert.IsType<PurgeExpiredPendingResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var useCase = new PurgeExpiredPendingSignIns(new FakeSession(AdminSession()), new FailingPendingSignInStore());

        var result = await useCase.ExecuteAsync();

        Assert.IsType<PurgeExpiredPendingResult.Failed>(result);
    }
}
