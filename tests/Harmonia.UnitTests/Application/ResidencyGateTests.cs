using Harmonia.Application;
using Harmonia.Application.Reservations;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

// T8 (500 plan test table): the residency gate refuses non-residents on BOTH surfaces
// (AC-6, NFR-3) — no slot data returned, no claim attempted, nothing touches the store.
public class ResidencyGateTests
{
    private static readonly DateOnly Day = new(2026, 7, 18);

    public static TheoryData<SessionContext?> NonResidentSessions => new()
    {
        { null },                                            // no valid session at all
        { new SessionContext(false, new HouseholdRef("HH-X")) }, // session, but not a resident
    };

    [Theory] // T8 — read surface
    [MemberData(nameof(NonResidentSessions))]
    public async Task Read_refuses_non_resident_and_returns_no_slot_data(SessionContext? ctx)
    {
        var store = new RecordingStore();
        var useCase = new GetDayAvailability(new FakeSession(ctx), new FakeSlotGrid("SLOT"), store);

        var result = await useCase.ExecuteAsync(Day);

        Assert.IsType<AvailabilityResult.Refused>(result);
        Assert.Equal(0, store.GetDayHoldersCalls); // no data read for non-residents
    }

    [Theory] // T8 — reserve surface
    [MemberData(nameof(NonResidentSessions))]
    public async Task Reserve_refuses_non_resident_and_creates_no_reservation(SessionContext? ctx)
    {
        var store = new RecordingStore();
        var useCase = new ReserveSlot(new FakeSession(ctx), new FakeSlotGrid("SLOT"), store);

        var result = await useCase.ExecuteAsync(Day, "SLOT");

        Assert.IsType<ReserveResult.Refused>(result);
        Assert.Empty(store.ClaimCalls); // AC-6: no reservation is created
    }
}
