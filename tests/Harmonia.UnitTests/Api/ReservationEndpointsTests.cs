using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Reservations;
using Harmonia.Application.Reservations;
using Harmonia.Domain.Reservations;

namespace Harmonia.UnitTests.Api;

// HTTP translation of the use-case results (500 plan §interfaces): the design's
// state/outcome vocabulary and status codes, with no business logic in the handler.
public class ReservationEndpointsTests
{
    private static readonly DateOnly Day = new(2026, 7, 18);
    private static readonly SessionContext Resident = new(true, new HouseholdRef("HH-ME"));

    private static GetDayAvailability ReadUseCase(SessionContext? ctx, RecordingStore store)
        => new(new FakeSession(ctx), new FakeSlotGrid("SLOT"), store);

    private static ReserveSlot ClaimUseCase(SessionContext? ctx, RecordingStore store)
        => new(new FakeSession(ctx), new FakeSlotGrid("SLOT"), store);

    [Fact] // AC-6: non-resident read → 401, no payload
    public async Task Read_refused_returns_401()
    {
        var result = await ReservationEndpoints.GetDaySlots(
            ReadUseCase(null, new RecordingStore()), Day, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, status.StatusCode);
    }

    [Fact] // AC-1: day view uses the design vocabulary free / taken-mine / taken-other
    public async Task Read_returns_200_with_design_state_tokens()
    {
        var store = new RecordingStore();
        store.Holders["SLOT"] = new HouseholdRef("HH-ME"); // taken by me

        var result = await ReservationEndpoints.GetDaySlots(
            ReadUseCase(Resident, store), Day, NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<DaySlotsDto>>(result);
        Assert.Equal(StatusCodes.Status200OK, json.StatusCode);
        Assert.Equal("2026-07-18", json.Value!.Day);
        var slot = Assert.Single(json.Value.Slots);
        Assert.Equal(new SlotDto("SLOT", "taken-mine"), slot);
    }

    [Theory] // T4/T5/T7 at the HTTP edge + 401/404 (500 plan validation table)
    [InlineData(ClaimResult.Claimed, StatusCodes.Status200OK, "confirmed-yours")]
    [InlineData(ClaimResult.AlreadyHeldByMe, StatusCodes.Status200OK, "confirmed-yours")]
    [InlineData(ClaimResult.AlreadyHeldByOther, StatusCodes.Status409Conflict, "refused-already-taken")]
    [InlineData(ClaimResult.Unavailable, StatusCodes.Status503ServiceUnavailable, "couldnt-confirm")]
    public async Task Claim_maps_outcome_to_status_and_token(
        ClaimResult storeResult, int expectedStatus, string expectedToken)
    {
        var store = new RecordingStore { NextClaimResult = storeResult };

        var result = await ReservationEndpoints.ClaimSlot(
            ClaimUseCase(Resident, store), Day, "SLOT", NullLogger.Instance, default);

        var json = Assert.IsType<JsonHttpResult<ClaimResponseDto>>(result);
        Assert.Equal(expectedStatus, json.StatusCode);
        Assert.Equal(expectedToken, json.Value!.Outcome);
    }

    [Fact]
    public async Task Claim_refused_for_non_resident_returns_401()
    {
        var result = await ReservationEndpoints.ClaimSlot(
            ClaimUseCase(null, new RecordingStore()), Day, "SLOT", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, status.StatusCode);
    }

    [Fact]
    public async Task Claim_on_unknown_slot_returns_404()
    {
        var result = await ReservationEndpoints.ClaimSlot(
            ClaimUseCase(Resident, new RecordingStore()), Day, "NOT-IN-GRID", NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, status.StatusCode);
    }
}
