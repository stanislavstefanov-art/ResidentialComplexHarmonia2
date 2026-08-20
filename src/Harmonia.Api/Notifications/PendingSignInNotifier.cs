using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Notifications;
using Harmonia.Application.PendingSignIn;

namespace Harmonia.Api.Notifications;

/// <summary>
/// Drains new-sign-up signals and notifies admins. Runs off the request thread so
/// session resolution never waits on a push round-trip.
///
/// Unlike BbqReminderService this does not schedule far ahead, so App Service Free
/// unloading the app is far less damaging: the drain happens moments after the
/// enqueue, when the app is definitionally running because a request just arrived.
/// </summary>
public sealed class PendingSignInNotifier(
    INewPendingSignInQueue queue,
    NotifyAdminsOfPendingSignIn notifyAdmins,
    ILogger<PendingSignInNotifier> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // Force a genuine async yield every iteration. Without this, a queue whose
            // DequeueAsync ever completes synchronously (e.g. an empty in-memory queue)
            // lets the whole loop run synchronously on the caller's thread inside
            // StartAsync, which never returns control to the host and spins one core.
            await Task.Yield();

            try
            {
                await queue.DequeueAsync(stoppingToken);

                // Coalesce a burst into one round.
                var alsoWaiting = queue.DrainPending();
                if (alsoWaiting > 0)
                    logger.LogInformation(
                        "Coalesced {Count} further pending sign-in signals into one notification round",
                        alsoWaiting);

                await notifyAdmins.ExecuteAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception)
            {
                // R3: no detail — the failure may concern a specific admin's delivery.
                logger.LogWarning("Pending sign-in notification run failed");
            }
        }
    }
}
