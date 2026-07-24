using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class GetCallerStatusTests
{
    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var uc = new GetCallerStatus(new FakeSession(null));
        Assert.IsType<GetCallerStatusResult.Refused>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Pending_session_returns_Pending()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: false,
            HouseholdRef: null, EntraObjectId: "oid-abc", IsPending: true);
        var uc = new GetCallerStatus(new FakeSession(ctx));
        Assert.IsType<GetCallerStatusResult.Pending>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Resident_session_returns_Ok()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false,
            HouseholdRef: new HouseholdRef("HH-1"), EntraObjectId: "oid-r", IsPending: false);
        var uc = new GetCallerStatus(new FakeSession(ctx));
        Assert.IsType<GetCallerStatusResult.Ok>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task Admin_session_returns_Ok()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true,
            HouseholdRef: null, EntraObjectId: "oid-a", IsPending: false);
        var uc = new GetCallerStatus(new FakeSession(ctx));
        Assert.IsType<GetCallerStatusResult.Ok>(await uc.ExecuteAsync());
    }

    [Fact]
    public async Task No_role_session_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: false,
            HouseholdRef: null, EntraObjectId: null, IsPending: false);
        var uc = new GetCallerStatus(new FakeSession(ctx));
        Assert.IsType<GetCallerStatusResult.Refused>(await uc.ExecuteAsync());
    }
}
