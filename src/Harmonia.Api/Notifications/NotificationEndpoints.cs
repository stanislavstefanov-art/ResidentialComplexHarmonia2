// src/Harmonia.Api/Notifications/NotificationEndpoints.cs
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Notifications;
using Harmonia.Domain.Notifications;

namespace Harmonia.Api.Notifications;

public sealed record SaveSubscriptionRequest(string Endpoint, string P256dhKey, string AuthKey);
public sealed record AnnouncementRequest(string Title, string Body);
public sealed record SubscriptionDto(string HouseholdRef, DateTimeOffset UpdatedAt);
public sealed record NotificationRecordDto(Guid Id, string Title, DateTimeOffset SentAt, string Channel);

public static class NotificationEndpoints
{
    // email is extracted from Entra claims by the caller (Program.cs handler) — never from body (R2/R3).
    public static async Task<IResult> SaveSubscriptionEndpoint(
        SaveSubscription useCase, SaveSubscriptionRequest body,
        string? email, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(body.Endpoint, body.P256dhKey, body.AuthKey, email, ct);
        switch (result)
        {
            case SaveSubscriptionResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case SaveSubscriptionResult.Saved saved:
                return TypedResults.Json(
                    new SubscriptionDto(saved.Subscription.HouseholdRef.Value, saved.Subscription.UpdatedAt),
                    statusCode: saved.IsNew ? StatusCodes.Status201Created : StatusCodes.Status200OK);
            case SaveSubscriptionResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> RemoveSubscriptionEndpoint(
        RemoveSubscription useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        switch (result)
        {
            case RemoveSubscriptionResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case RemoveSubscriptionResult.Removed:
                return TypedResults.NoContent();
            case RemoveSubscriptionResult.NotFound:
                return TypedResults.NotFound();
            case RemoveSubscriptionResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> AnnounceEndpoint(
        SendAnnouncement useCase, AnnouncementRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(body.Title, body.Body, ct);
        switch (result)
        {
            case SendAnnouncementResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case SendAnnouncementResult.Accepted:
                return TypedResults.StatusCode(StatusCodes.Status202Accepted);
            case SendAnnouncementResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> GetHistoryEndpoint(
        GetNotificationHistory useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        switch (result)
        {
            case GetNotificationHistoryResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case GetNotificationHistoryResult.Ok ok:
                var dtos = ok.Records.Select(r =>
                    new NotificationRecordDto(r.Id, r.Title, r.SentAt, r.Channel)).ToList();
                return TypedResults.Json(dtos, statusCode: StatusCodes.Status200OK);
            case GetNotificationHistoryResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }
}
