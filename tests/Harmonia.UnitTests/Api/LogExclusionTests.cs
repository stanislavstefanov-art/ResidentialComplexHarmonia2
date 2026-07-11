using Microsoft.Extensions.Logging;
using Harmonia.Api.Reservations;
using Harmonia.Application.Reservations;
using Harmonia.Domain.Reservations;

namespace Harmonia.UnitTests.Api;

/// <summary>Captures fully-formatted log lines so the test can scan them for PII.</summary>
public sealed class CapturingLogger : ILogger
{
    public List<string> Lines { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
        LogLevel logLevel, EventId eventId, TState state, Exception? exception,
        Func<TState, Exception?, string> formatter)
        => Lines.Add(formatter(state, exception) + (exception is null ? "" : " " + exception));
}

// T16 (Sec, 500 plan test table): householdRef never appears in emitted log lines
// during the claim and the refusal paths (R3 — EU personal data stays out of logs).
public class LogExclusionTests
{
    private const string SecretRef = "HH-SECRET-42";
    private static readonly DateOnly Day = new(2026, 7, 18);

    private static ReserveSlot UseCase(RecordingStore store)
        => new(
            new FakeSession(new SessionContext(true, new HouseholdRef(SecretRef))),
            new FakeSlotGrid("SLOT"),
            store);

    [Theory] // T16 / SEC-CHK-10 — every outcome path logs, and none leaks
    [InlineData(ClaimResult.Claimed)]
    [InlineData(ClaimResult.AlreadyHeldByOther)]
    [InlineData(ClaimResult.AlreadyHeldByMe)]
    [InlineData(ClaimResult.Unavailable)]
    public async Task Claim_logs_outcome_without_household_ref(ClaimResult storeResult)
    {
        var logger = new CapturingLogger();
        var store = new RecordingStore { NextClaimResult = storeResult };

        await ReservationEndpoints.ClaimSlot(UseCase(store), Day, "SLOT", logger, default);

        Assert.NotEmpty(logger.Lines); // the hook is real: something IS logged
        Assert.All(logger.Lines, line => Assert.DoesNotContain(SecretRef, line));
    }
}
