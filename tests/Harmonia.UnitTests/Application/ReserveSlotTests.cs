using Harmonia.Application.Reservations;
using Harmonia.Domain.Reservations;

namespace Harmonia.UnitTests.Application;

// T9, T10 (500 plan test table) + outcome pass-through of the reserve use case.
public class ReserveSlotTests
{
    private static readonly DateOnly Day = new(2026, 7, 18);
    private static readonly HouseholdRef SessionHousehold = new("HH-SESSION");

    private static ReserveSlot UseCase(RecordingStore store)
        => new(
            new FakeSession(new SessionContext(true, SessionHousehold)),
            new FakeSlotGrid("SLOT"),
            store);

    [Fact] // T9 — household is derived from the session ONLY (R2, ADR-005)
    public async Task Claim_passes_session_derived_household_to_store()
    {
        var store = new RecordingStore { NextClaimResult = ClaimResult.Claimed };

        await UseCase(store).ExecuteAsync(Day, "SLOT");

        var call = Assert.Single(store.ClaimCalls);
        Assert.Equal(SessionHousehold, call.HouseholdRef);
        Assert.Equal(Day, call.Day);
        Assert.Equal("SLOT", call.SlotKey);
    }

    [Fact] // T10 — unknown slot key: 404-shaped result, no claim attempted
    public async Task Unknown_slot_key_returns_unknown_slot_without_claiming()
    {
        var store = new RecordingStore();

        var result = await UseCase(store).ExecuteAsync(Day, "NOT-IN-GRID");

        Assert.IsType<ReserveResult.UnknownSlot>(result);
        Assert.Empty(store.ClaimCalls);
    }

    [Fact] // outcome pass-through: the store's result reaches the caller via OutcomeMapper
    public async Task Store_result_is_mapped_to_the_observable_outcome()
    {
        var store = new RecordingStore { NextClaimResult = ClaimResult.AlreadyHeldByOther };

        var result = await UseCase(store).ExecuteAsync(Day, "SLOT");

        var outcome = Assert.IsType<ReserveResult.Outcome>(result);
        Assert.Equal(ClaimOutcome.RefusedAlreadyTaken, outcome.Value);
    }
}
