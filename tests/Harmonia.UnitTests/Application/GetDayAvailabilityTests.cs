using Harmonia.Application;
using Harmonia.Application.Reservations;
using Harmonia.Domain;
using Harmonia.Domain.Reservations;

namespace Harmonia.UnitTests.Application;

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
            new FakeSession(new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: Me)),
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

    [Fact]
    public async Task Admin_with_linked_household_can_read_slots_and_sees_own_as_mine()
    {
        var store = new RecordingStore();
        store.Holders["S2"] = Me;
        store.Holders["S3"] = Other;
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: Me);
        var useCase = new GetDayAvailability(new FakeSession(ctx), new FakeSlotGrid("S1", "S2", "S3"), store);

        var result = await useCase.ExecuteAsync(Day);

        var ok = Assert.IsType<AvailabilityResult.Ok>(result);
        Assert.Equal(SlotState.TakenMine, ok.Slots.First(s => s.SlotKey == "S2").State);
    }

    [Fact]
    public async Task Admin_without_linked_household_can_read_slots_as_observer()
    {
        var store = new RecordingStore();
        store.Holders["S2"] = Me;
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var useCase = new GetDayAvailability(new FakeSession(ctx), new FakeSlotGrid("S1", "S2"), store);

        var result = await useCase.ExecuteAsync(Day);

        var ok = Assert.IsType<AvailabilityResult.Ok>(result);
        Assert.Equal(SlotState.TakenOther, ok.Slots.First(s => s.SlotKey == "S2").State);
    }
}
