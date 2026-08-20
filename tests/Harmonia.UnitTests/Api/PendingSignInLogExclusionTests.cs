using System.Security.Claims;
using Harmonia.Api.Identity;
using Harmonia.Api.Notifications;
using Harmonia.Application.Notifications;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Harmonia.UnitTests.Api;

/// <summary>Typed variant of <see cref="CapturingLogger"/> for classes that take
/// ILogger&lt;T&gt; rather than a plain ILogger.</summary>
public sealed class CapturingLogger<T> : ILogger<T>
{
    private readonly CapturingLogger _inner = new();

    public List<string> Lines => _inner.Lines;

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => _inner.BeginScope(state);
    public bool IsEnabled(LogLevel logLevel) => _inner.IsEnabled(logLevel);

    public void Log<TState>(
        LogLevel logLevel, EventId eventId, TState state, Exception? exception,
        Func<TState, Exception?, string> formatter)
        => _inner.Log(logLevel, eventId, state, exception, formatter);
}

// R3 — no OID/email/name/HouseholdRef ever appears in this feature's log lines, even
// on its failure paths (design spec: 2026-08-19-admin-pending-signup-notification-design.md).
public class PendingSignInLogExclusionTests
{
    private const string SecretValue = "secret-do-not-log-9f3a";

    [Fact]
    public void Admin_flag_mirror_failure_does_not_log_the_oid()
    {
        var logger = new CapturingLogger<EntraSession>();
        var lookup = new ThrowingSetAdminFlagLookup("HH-1", isAdmin: false);
        var user = Authenticated(("oid", SecretValue), (ClaimTypes.Role, "admin"));
        var session = new EntraSession(
            new StubAccessor(new DefaultHttpContext { User = user }),
            new FakePendingSignInStore(),
            lookup,
            logger,
            new FakeNewPendingSignInQueue());

        session.Resolve();

        Assert.NotEmpty(logger.Lines); // the hook is real: something IS logged
        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretValue, line));
    }

    [Fact]
    public async Task A_failed_notification_round_does_not_log_admin_household_refs()
    {
        var logger = new CapturingLogger<PendingSignInNotifier>();
        var store = new FakeNotificationStore();
        store.AdminRefs.Add(new HouseholdRef(SecretValue));
        var queue = new FakeNewPendingSignInQueue();
        queue.Enqueue(new NewPendingSignIn(DateTimeOffset.UtcNow));
        var notifier = new PendingSignInNotifier(
            queue, new NotifyAdminsOfPendingSignIn(store, new FailingNotificationDispatcher()), logger);

        await notifier.StartAsync(CancellationToken.None);
        await notifier.StopAsync(CancellationToken.None);

        Assert.NotEmpty(logger.Lines);
        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretValue, line));
    }

    private static ClaimsPrincipal Authenticated(params (string Type, string Value)[] claims)
    {
        var identity = new ClaimsIdentity(
            claims.Select(c => new Claim(c.Type, c.Value)),
            authenticationType: "TestBearer");
        return new ClaimsPrincipal(identity);
    }

    private sealed class StubAccessor(HttpContext? ctx) : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get => ctx; set { } }
    }

    private sealed class ThrowingSetAdminFlagLookup(string? householdRef, bool isAdmin) : IHouseholdByOidLookup
    {
        public Task<HouseholdLink?> FindAsync(string oid, CancellationToken ct = default)
            => Task.FromResult(householdRef is null ? null : new HouseholdLink(householdRef, "Owner", isAdmin));

        public Task SetAdminFlagAsync(string oid, bool isAdmin, CancellationToken ct = default)
            => throw new InvalidOperationException("Simulated store failure");
    }
}
