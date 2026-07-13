// tests/Harmonia.UnitTests/Api/NotificationEndpointsTests.cs
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Notifications;
using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.UnitTests.Api;

public class NotificationEndpointsTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-EP-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    // ── POST /notifications/subscribe ──────────────────────────────────────

    [Fact]
    public async Task Subscribe_new_returns_201()
    {
        var store   = new FakeNotificationStore();
        var useCase = new SaveSubscription(new FakeSession(ResidentCtx), store);
        var body    = new SaveSubscriptionRequest("https://push.example.com/x", "k", "a");

        var result = await NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body, email: null, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status201Created, status.StatusCode);
    }

    [Fact]
    public async Task Subscribe_update_returns_200()
    {
        var store   = new FakeNotificationStore();
        var useCase = new SaveSubscription(new FakeSession(ResidentCtx), store);
        var body    = new SaveSubscriptionRequest("https://push.example.com/x", "k", "a");

        // First call — creates (IsNew=true); second call — updates (IsNew=false)
        await NotificationEndpoints.SaveSubscriptionEndpoint(useCase, body, null, NullLogger.Instance, default);
        var result = await NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body, null, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task Subscribe_non_resident_returns_403()
    {
        var useCase = new SaveSubscription(new FakeSession(null), new FakeNotificationStore());
        var body    = new SaveSubscriptionRequest("https://push.example.com/x", "k", "a");

        var result = await NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body, null, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Subscribe_store_failure_returns_500()
    {
        var useCase = new SaveSubscription(new FakeSession(ResidentCtx), new FailingNotificationStore());
        var body    = new SaveSubscriptionRequest("https://push.example.com/x", "k", "a");

        var result = await NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body, null, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }

    // ── DELETE /notifications/subscribe ────────────────────────────────────

    [Fact]
    public async Task Unsubscribe_existing_returns_204()
    {
        var store   = new FakeNotificationStore();
        var saveUC  = new SaveSubscription(new FakeSession(ResidentCtx), store);
        await saveUC.ExecuteAsync("https://push.example.com/x", "k", "a", null);
        var removeUC = new RemoveSubscription(new FakeSession(ResidentCtx), store);

        var result = await NotificationEndpoints.RemoveSubscriptionEndpoint(
            removeUC, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status204NoContent, status.StatusCode);
    }

    [Fact]
    public async Task Unsubscribe_nonexistent_returns_404()
    {
        var useCase = new RemoveSubscription(new FakeSession(ResidentCtx), new FakeNotificationStore());

        var result = await NotificationEndpoints.RemoveSubscriptionEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, status.StatusCode);
    }

    [Fact]
    public async Task Unsubscribe_non_resident_returns_403()
    {
        var useCase = new RemoveSubscription(new FakeSession(null), new FakeNotificationStore());

        var result = await NotificationEndpoints.RemoveSubscriptionEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    // ── POST /notifications/announce ───────────────────────────────────────

    [Fact]
    public async Task Announce_admin_returns_202()
    {
        var useCase = new SendAnnouncement(new FakeSession(AdminCtx), new FakeNotificationDispatcher());
        var body    = new AnnouncementRequest("Board update", "We have news.");

        var result = await NotificationEndpoints.AnnounceEndpoint(
            useCase, body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status202Accepted, status.StatusCode);
    }

    [Fact]
    public async Task Announce_non_admin_returns_403()
    {
        var useCase = new SendAnnouncement(new FakeSession(null), new FakeNotificationDispatcher());
        var body    = new AnnouncementRequest("Hello", "Body");

        var result = await NotificationEndpoints.AnnounceEndpoint(
            useCase, body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Announce_dispatcher_failure_returns_500()
    {
        var useCase = new SendAnnouncement(new FakeSession(AdminCtx), new FailingNotificationDispatcher());
        var body    = new AnnouncementRequest("Hello", "Body");

        var result = await NotificationEndpoints.AnnounceEndpoint(
            useCase, body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }

    // ── GET /notifications ─────────────────────────────────────────────────

    [Fact]
    public async Task GetHistory_resident_returns_200()
    {
        var store   = new FakeNotificationStore();
        var useCase = new GetNotificationHistory(new FakeSession(ResidentCtx), store);

        var result = await NotificationEndpoints.GetHistoryEndpoint(useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task GetHistory_no_session_returns_403()
    {
        var useCase = new GetNotificationHistory(new FakeSession(null), new FakeNotificationStore());

        var result = await NotificationEndpoints.GetHistoryEndpoint(useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task GetHistory_store_failure_returns_500()
    {
        var useCase = new GetNotificationHistory(
            new FakeSession(ResidentCtx), new FailingNotificationStore());

        var result = await NotificationEndpoints.GetHistoryEndpoint(useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }
}
