using Harmonia.Application;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

// Gap #4 bootstrap: verify the IsAdmin flag and nullable HouseholdRef on SessionContext.
// Admins have no apartment (null HouseholdRef); residents always have one.
public class AdminSessionContextTests
{
    [Fact]
    public void Admin_context_has_null_household_and_is_not_resident()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);

        Assert.True(ctx.IsAdmin);
        Assert.False(ctx.IsResident);
        Assert.Null(ctx.HouseholdRef);
    }

    [Fact]
    public void Resident_context_is_not_admin_and_has_non_null_household()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));

        Assert.False(ctx.IsAdmin);
        Assert.True(ctx.IsResident);
        Assert.NotNull(ctx.HouseholdRef);
    }
}
