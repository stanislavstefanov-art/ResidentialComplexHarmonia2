using Reserve.Domain;

namespace Reserve.UnitTests.Domain;

// T1–T3 (500 plan test table): deriveState is pure and covers all three states (AC-1).
public class SlotStateDeriverTests
{
    private static readonly HouseholdRef Me = new("HH-A");
    private static readonly HouseholdRef Other = new("HH-B");

    [Fact] // T1
    public void Absent_holder_derives_free()
    {
        Assert.Equal(SlotState.Free, SlotStateDeriver.Derive(holder: null, me: Me));
    }

    [Fact] // T2
    public void Holder_equal_to_me_derives_taken_mine()
    {
        Assert.Equal(SlotState.TakenMine, SlotStateDeriver.Derive(holder: Me, me: Me));
    }

    [Fact] // T3
    public void Holder_other_than_me_derives_taken_other()
    {
        Assert.Equal(SlotState.TakenOther, SlotStateDeriver.Derive(holder: Other, me: Me));
    }
}
