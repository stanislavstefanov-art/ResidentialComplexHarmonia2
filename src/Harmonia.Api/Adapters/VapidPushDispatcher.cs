// src/Harmonia.Api/Adapters/VapidPushDispatcher.cs
using System.Net;
using System.Text.Json;
using Azure;
using Azure.Communication.Email;
using Microsoft.Extensions.Logging;
using WebPush;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.Api.Reservations.Adapters;

public sealed record VapidConfig(string Subject, string PublicKey, string PrivateKey);
public sealed record AcsEmailConfig(string ConnectionString, string SenderAddress);

public sealed class VapidPushDispatcher(
    INotificationStore store,
    VapidConfig vapidConfig,
    AcsEmailConfig acsConfig,
    ILogger<VapidPushDispatcher> logger) : INotificationDispatcher
{
    public async Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default)
    {
        var title   = TitleFor(kind);
        var body    = BodyFor(kind);
        var sub     = await store.GetSubscriptionAsync(householdRef, ct);
        string channel;

        if (sub is not null)
        {
            channel = await TrySendPushAsync(sub, title, body) ? "push" : "skipped";
            if (channel == "skipped" && sub.FallbackEmail is not null)
                channel = await TrySendEmailAsync(sub.FallbackEmail, title, body, ct) ? "email" : "skipped";
        }
        else
        {
            channel = "skipped";
        }

        await store.AppendHistoryAsync(
            new NotificationRecord(Guid.NewGuid(), householdRef, title, DateTimeOffset.UtcNow, channel), ct);
    }

    public async Task BroadcastAsync(string title, string body, CancellationToken ct = default)
    {
        var subs = await store.ListAllSubscriptionsAsync(ct);
        foreach (var sub in subs)
        {
            var channel = await TrySendPushAsync(sub, title, body) ? "push" : "skipped";
            if (channel == "skipped" && sub.FallbackEmail is not null)
                channel = await TrySendEmailAsync(sub.FallbackEmail, title, body, ct) ? "email" : "skipped";

            await store.AppendHistoryAsync(
                new NotificationRecord(Guid.NewGuid(), sub.HouseholdRef, title, DateTimeOffset.UtcNow, channel), ct);
        }
    }

    private async Task<bool> TrySendPushAsync(Harmonia.Domain.Notifications.PushSubscription sub, string title, string body)
    {
        // Generic payload — no amounts, no HouseholdRef (R3)
        var payload = JsonSerializer.Serialize(new { title, body });
        try
        {
            var client  = new WebPushClient();
            var vapidDetails = new VapidDetails(vapidConfig.Subject, vapidConfig.PublicKey, vapidConfig.PrivateKey);
            var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256dhKey, sub.AuthKey);
            await client.SendNotificationAsync(pushSub, payload, vapidDetails);
            return true;
        }
        catch (WebPushException ex) when (ex.StatusCode == HttpStatusCode.Gone)
        {
            // Subscription revoked by browser — silently remove (fire-and-forget; no ct available here)
            _ = store.RemoveSubscriptionAsync(sub.HouseholdRef);
            return false;
        }
        catch (Exception)
        {
            logger.LogWarning("Push delivery failed (details omitted per R3)");
            return false;
        }
    }

    private async Task<bool> TrySendEmailAsync(
        string email, string title, string body, CancellationToken ct)
    {
        try
        {
            var client  = new EmailClient(acsConfig.ConnectionString);
            var message = new EmailMessage(
                senderAddress: acsConfig.SenderAddress,
                content:       new EmailContent(title) { PlainText = body },
                recipients:    new EmailRecipients([new EmailAddress(email)]));
            // WaitUntil.Started = fire-and-forget: we don't wait for delivery receipt (R3)
            await client.SendAsync(WaitUntil.Started, message, ct);
            return true;
        }
        catch (Exception)
        {
            logger.LogWarning("Email delivery failed (details omitted per R3)");
            return false;
        }
    }

    private static string TitleFor(NotificationKind kind) => kind switch
    {
        NotificationKind.ChargePosted    => "New maintenance fee charge",
        NotificationKind.PaymentRecorded => "Payment recorded",
        NotificationKind.BbqReminder     => "BBQ booking reminder",
        NotificationKind.Announcement    => "Announcement from the board",
        _                                => "Harmonia notification"
    };

    private static string BodyFor(NotificationKind kind) => kind switch
    {
        NotificationKind.ChargePosted    => "A new maintenance fee charge has been posted to your apartment.",
        NotificationKind.PaymentRecorded => "A payment has been recorded for your apartment.",
        NotificationKind.BbqReminder     => "Reminder: you have a BBQ booking tomorrow.",
        NotificationKind.Announcement    => "The board has a message for you. Log in to Harmonia to view it.",
        _                                => "You have a new notification."
    };
}
