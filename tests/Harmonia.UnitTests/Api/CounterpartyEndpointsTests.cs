using Harmonia.Api.Counterparties;
using Harmonia.Application;
using Harmonia.Application.Counterparties;
using Harmonia.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Xunit;

namespace Harmonia.UnitTests.Api;

public sealed class CounterpartyEndpointsTests
{
    private static FakeSession Admin()    => new(new SessionContext(IsResident: false, IsAdmin: true,  HouseholdRef: null));
    private static FakeSession Resident() => new(new SessionContext(IsResident: true,  IsAdmin: false, HouseholdRef: new HouseholdRef("X3 АП1")));
    private static CounterpartyRequest Req() => new("PowerCo", "Electricity", "Utilities", "BG123", "+359", "b@p.bg");

    private static int Status(IResult r)
        => Assert.IsAssignableFrom<IStatusCodeHttpResult>(r).StatusCode ?? 0;

    [Fact]
    public async Task Create_as_admin_returns_201()
    {
        var uc = new CreateCounterparty(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.CreateCounterpartyEndpoint(uc, Req(), default);
        Assert.Equal(StatusCodes.Status201Created, Status(result));
    }

    [Fact]
    public async Task Create_as_resident_returns_403()
    {
        var uc = new CreateCounterparty(Resident(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.CreateCounterpartyEndpoint(uc, Req(), default);
        Assert.Equal(StatusCodes.Status403Forbidden, Status(result));
    }

    [Fact]
    public async Task List_as_admin_returns_200()
    {
        var uc = new ListCounterparties(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.ListCounterpartiesEndpoint(uc, default);
        Assert.Equal(StatusCodes.Status200OK, Status(result));
    }

    [Fact]
    public async Task List_as_resident_returns_403()
    {
        var uc = new ListCounterparties(Resident(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.ListCounterpartiesEndpoint(uc, default);
        Assert.Equal(StatusCodes.Status403Forbidden, Status(result));
    }

    [Fact]
    public async Task Get_missing_returns_404()
    {
        var uc = new GetCounterparty(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.GetCounterpartyEndpoint(uc, System.Guid.NewGuid(), default);
        Assert.Equal(StatusCodes.Status404NotFound, Status(result));
    }

    [Fact]
    public async Task Update_missing_returns_404()
    {
        var uc = new UpdateCounterparty(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.UpdateCounterpartyEndpoint(uc, System.Guid.NewGuid(), Req(), default);
        Assert.Equal(StatusCodes.Status404NotFound, Status(result));
    }

    [Fact]
    public async Task Delete_existing_returns_204()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        var uc = new DeleteCounterparty(Admin(), store);
        var result = await CounterpartyEndpoints.DeleteCounterpartyEndpoint(uc, cp.Id, default);
        Assert.Equal(StatusCodes.Status204NoContent, Status(result));
    }

    [Fact]
    public async Task Delete_with_bills_returns_409()
    {
        var store = new FakeCounterpartyStore();
        var cp = await store.CreateAsync("PowerCo", "Electricity", "Utilities", null, null, null);
        store.WithBills.Add(cp.Id);
        var uc = new DeleteCounterparty(Admin(), store);
        var result = await CounterpartyEndpoints.DeleteCounterpartyEndpoint(uc, cp.Id, default);
        Assert.Equal(StatusCodes.Status409Conflict, Status(result));
    }

    [Fact]
    public async Task Delete_missing_returns_404()
    {
        var uc = new DeleteCounterparty(Admin(), new FakeCounterpartyStore());
        var result = await CounterpartyEndpoints.DeleteCounterpartyEndpoint(uc, System.Guid.NewGuid(), default);
        Assert.Equal(StatusCodes.Status404NotFound, Status(result));
    }
}
