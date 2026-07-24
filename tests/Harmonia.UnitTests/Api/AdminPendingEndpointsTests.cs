using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Admin;
using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Api;

public class AdminPendingEndpointsTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null,
            EntraObjectId: "admin-1", IsPending: false);

    // ── GET /admin/pending ──────────────────────────────────────────────────

    [Fact]
    public async Task ListPending_Ok_returns_200()
    {
        var store = new FakePendingSignInStoreV2
        {
            Pending = [new PendingSignIn("oid-1", "a@x.com", "Alice", DateTimeOffset.UtcNow.AddDays(-1))]
        };
        var uc = new ListPendingSignIns(new FakeSession(AdminCtx), store);
        var result = await AdminPendingEndpoints.ListPendingEndpoint(uc, NullLogger.Instance, default);
        var json = Assert.IsType<JsonHttpResult<List<PendingSignInDto>>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Single(json.Value!);
    }

    [Fact]
    public async Task ListPending_Refused_returns_403()
    {
        var uc = new ListPendingSignIns(new FakeSession(null), new FakePendingSignInStoreV2());
        var result = await AdminPendingEndpoints.ListPendingEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task ListPending_Failed_returns_500()
    {
        var uc = new ListPendingSignIns(new FakeSession(AdminCtx), new FailingPendingSignInStore());
        var result = await AdminPendingEndpoints.ListPendingEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── POST /admin/pending/{oid}/activate ─────────────────────────────────

    [Fact]
    public async Task ActivatePending_Ok_returns_200()
    {
        var store = new FakePendingSignInStoreV2
        {
            Pending = [new PendingSignIn("oid-1", "a@x.com", "Alice", DateTimeOffset.UtcNow.AddDays(-1))]
        };
        var uc = new ActivatePendingSignIn(new FakeSession(AdminCtx), store);
        var result = await AdminPendingEndpoints.ActivatePendingEndpoint(
            uc, "oid-1", new ActivateRequest("HH-1"), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status200OK,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task ActivatePending_NotFound_returns_404()
    {
        var store = new FakePendingSignInStoreV2();
        var uc = new ActivatePendingSignIn(new FakeSession(AdminCtx), store);
        var result = await AdminPendingEndpoints.ActivatePendingEndpoint(
            uc, "oid-missing", new ActivateRequest("HH-1"), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status404NotFound,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task ActivatePending_AlreadyActivated_returns_409()
    {
        var store = new FakePendingSignInStoreV2();
        store.AlreadyActivated.Add("oid-already");
        var uc = new ActivatePendingSignIn(new FakeSession(AdminCtx), store);
        var result = await AdminPendingEndpoints.ActivatePendingEndpoint(
            uc, "oid-already", new ActivateRequest("HH-1"), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status409Conflict,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task ActivatePending_Refused_returns_403()
    {
        var uc = new ActivatePendingSignIn(new FakeSession(null), new FakePendingSignInStoreV2());
        var result = await AdminPendingEndpoints.ActivatePendingEndpoint(
            uc, "oid-1", new ActivateRequest("HH-1"), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task ActivatePending_Failed_returns_500()
    {
        var uc = new ActivatePendingSignIn(new FakeSession(AdminCtx), new FailingPendingSignInStore());
        var result = await AdminPendingEndpoints.ActivatePendingEndpoint(
            uc, "oid-1", new ActivateRequest("HH-1"), NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    // ── DELETE /admin/pending/purge-expired ────────────────────────────────

    [Fact]
    public async Task PurgePending_Ok_returns_200_with_deleted_count()
    {
        var store = new FakePendingSignInStoreV2
        {
            Pending = [new PendingSignIn("oid-old", "old@x.com", "Old User", DateTimeOffset.UtcNow.AddDays(-100))]
        };
        var uc = new PurgeExpiredPendingSignIns(new FakeSession(AdminCtx), store);
        var result = await AdminPendingEndpoints.PurgeExpiredPendingEndpoint(uc, NullLogger.Instance, default);
        var json = Assert.IsType<JsonHttpResult<PurgeExpiredDto>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Equal(1, json.Value!.Deleted);
    }

    [Fact]
    public async Task PurgePending_Refused_returns_403()
    {
        var uc = new PurgeExpiredPendingSignIns(new FakeSession(null), new FakePendingSignInStoreV2());
        var result = await AdminPendingEndpoints.PurgeExpiredPendingEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task PurgePending_Failed_returns_500()
    {
        var uc = new PurgeExpiredPendingSignIns(new FakeSession(AdminCtx), new FailingPendingSignInStore());
        var result = await AdminPendingEndpoints.PurgeExpiredPendingEndpoint(uc, NullLogger.Instance, default);
        Assert.Equal(StatusCodes.Status500InternalServerError,
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }
}
