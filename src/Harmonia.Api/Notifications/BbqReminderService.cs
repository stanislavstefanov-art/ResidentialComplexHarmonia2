// src/Harmonia.Api/Notifications/BbqReminderService.cs
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Notifications;
using Harmonia.Application.Reservations;

namespace Harmonia.Api.Notifications;

public sealed class BbqReminderService(
    INotificationDispatcher dispatcher,
    IReservationStore reservationStore,
    ILogger<BbqReminderService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now  = DateTime.UtcNow;
            var next = now.Date.AddDays(1).AddHours(7); // 07:00 UTC next day
            if (next <= now) next = next.AddDays(1);
            await Task.Delay(next - now, stoppingToken);
            if (stoppingToken.IsCancellationRequested) break;
            await SendTomorrowRemindersAsync(stoppingToken);
        }
    }

    private async Task SendTomorrowRemindersAsync(CancellationToken ct)
    {
        try
        {
            var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
            var holders  = await reservationStore.GetDayBookingHoldersAsync(tomorrow, ct);
            foreach (var householdRef in holders)
                await dispatcher.DispatchAsync(NotificationKind.BbqReminder, householdRef, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        {
            logger.LogWarning("BBQ reminder run failed");
        }
    }
}
