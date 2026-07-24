using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Me;
using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Api;

public class MeEndpointsTests
{
    [Fact]
    public async Task Refused_returns_403()
    {
        var result = await MeEndpoints.GetMe(
            UseCase(null), NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Pending_returns_200_with_status_pending()
    {
        var ctx = new SessionContext(
            IsResident: false, IsAdmin: false, HouseholdRef: null,
            EntraObjectId: "oid-1", IsPending: true);

        var result = await MeEndpoints.GetMe(
            UseCase(ctx), NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<MeStatusDto>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Equal("pending", json.Value!.Status);
    }

    [Fact]
    public async Task Resident_session_returns_200_with_status_ok()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false,
            HouseholdRef: new HouseholdRef("HH-1"),
            EntraObjectId: "oid-1", IsPending: false);

        var result = await MeEndpoints.GetMe(
            UseCase(ctx), NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<MeStatusDto>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Equal("ok", json.Value!.Status);
    }

    [Fact]
    public async Task Admin_session_returns_200_with_status_ok()
    {
        var ctx = new SessionContext(
            IsResident: false, IsAdmin: true, HouseholdRef: null,
            EntraObjectId: "admin-oid-1", IsPending: false);

        var result = await MeEndpoints.GetMe(
            UseCase(ctx), NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<MeStatusDto>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Equal("ok", json.Value!.Status);
    }

    private static GetCallerStatus UseCase(SessionContext? ctx)
        => new(new FakeSession(ctx));
}
