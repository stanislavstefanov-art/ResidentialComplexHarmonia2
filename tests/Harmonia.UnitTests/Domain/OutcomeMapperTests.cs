using Harmonia.Domain.Reservations;

namespace Harmonia.UnitTests.Domain;

// T4–T7 (500 plan test table): mapOutcome covers every ClaimResult branch.
public class OutcomeMapperTests
{
    [Fact] // T4
    public void Claimed_maps_to_confirmed_yours()
    {
        Assert.Equal(ClaimOutcome.ConfirmedYours, OutcomeMapper.Map(ClaimResult.Claimed));
    }

    [Fact] // T5
    public void Already_held_by_other_maps_to_refused_already_taken()
    {
        Assert.Equal(ClaimOutcome.RefusedAlreadyTaken, OutcomeMapper.Map(ClaimResult.AlreadyHeldByOther));
    }

    [Fact] // T6 — idempotent retry (R2): my own earlier win is confirmed, never refused
    public void Already_held_by_me_maps_to_confirmed_yours()
    {
        Assert.Equal(ClaimOutcome.ConfirmedYours, OutcomeMapper.Map(ClaimResult.AlreadyHeldByMe));
    }

    [Fact] // T7 — unknown result never fabricates success (DA3)
    public void Unavailable_maps_to_couldnt_confirm()
    {
        Assert.Equal(ClaimOutcome.CouldntConfirm, OutcomeMapper.Map(ClaimResult.Unavailable));
    }
}
