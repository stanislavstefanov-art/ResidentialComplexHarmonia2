using Reserve.Application;
using Reserve.Domain;

namespace Reserve.UnitTests.Application;

// AC-1 wiring: the read use case enumerates the configured grid (never hard-coded)
// and derives each slot's state from the authoritative holders read.
public class GetDayAvailabilityTests
{
    private static readonly DateOnly Day = new(2026, 7, 18);
    private static readonly HouseholdRef Me = new("HH-ME");
    private static readonly HouseholdRef Other = new("HH-OTHER");

    [Fact]
    public async Task Read_returns_every_grid_slot_with_derived_state()
    {
        var store = new RecordingStore();
        store.Holders["S2"] = Me;
        store.Holders["S3"] = Other;
        var useCase = new GetDayAvailability(
            new FakeSession(new SessionContext(true, Me)),
            new FakeSlotGrid("S1", "S2", "S3"),
            store);

        var result = await useCase.ExecuteAsync(Day);

        var ok = Assert.IsType<AvailabilityResult.Ok>(result);
        Assert.Equal(Day, ok.Day);
        Assert.Equal(
            new[]
            {
                new SlotView("S1", SlotState.Free),
                new SlotView("S2", SlotState.TakenMine),
                new SlotView("S3", SlotState.TakenOther),
            },
            ok.Slots);
    }
}
