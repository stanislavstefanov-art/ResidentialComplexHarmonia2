using Harmonia.Api.Adapters;
using Harmonia.Application.Counterparties;
using Xunit;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public sealed class SqlCounterpartyStoreTests(SqlServerFixture db)
{
    private SqlCounterpartyStore Store() => new(db.ConnectionString);

    [Fact]
    public async Task Create_then_Get_round_trips()
    {
        var store = Store();
        var name = $"rel-cp-{Guid.NewGuid():N}";
        var created = await store.CreateAsync(name, "Electricity", "Utilities", "BG123", "+359", "b@p.bg");

        var fetched = await store.GetAsync(created.Id);
        Assert.NotNull(fetched);
        Assert.Equal(name, fetched!.Name);
        Assert.Equal("Electricity", fetched.Category);
        Assert.Equal("BG123", fetched.VatNumber);
    }

    [Fact]
    public async Task List_includes_created()
    {
        var store = Store();
        var name = $"rel-cp-{Guid.NewGuid():N}";
        await store.CreateAsync(name, "Water", "Utilities", null, null, null);
        var all = await store.ListAsync();
        Assert.Contains(all, c => c.Name == name);
    }

    [Fact]
    public async Task Update_changes_values_and_returns_ok()
    {
        var store = Store();
        var created = await store.CreateAsync($"rel-cp-{Guid.NewGuid():N}", "Old", "Utilities", null, null, null);
        var newName = $"rel-cp-{Guid.NewGuid():N}";
        var result = await store.UpdateAsync(created.Id, newName, "Water", "Utilities", "BG9", "+1", "n@n.bg");
        var ok = Assert.IsType<UpdateCounterpartyStoreResult.Ok>(result);
        Assert.Equal(newName, ok.Counterparty.Name);
        Assert.Equal("Water", ok.Counterparty.Category);
    }

    [Fact]
    public async Task Update_missing_returns_not_found()
    {
        var result = await Store().UpdateAsync(Guid.NewGuid(), "N", "C", "P", null, null, null);
        Assert.IsType<UpdateCounterpartyStoreResult.NotFound>(result);
    }

    [Fact]
    public async Task Delete_removes_row()
    {
        var store = Store();
        var created = await store.CreateAsync($"rel-cp-{Guid.NewGuid():N}", "Electricity", "Utilities", null, null, null);
        Assert.IsType<DeleteCounterpartyStoreResult.Ok>(await store.DeleteAsync(created.Id));
        Assert.Null(await store.GetAsync(created.Id));
    }

    [Fact]
    public async Task Delete_missing_returns_not_found()
        => Assert.IsType<DeleteCounterpartyStoreResult.NotFound>(await Store().DeleteAsync(Guid.NewGuid()));
}
