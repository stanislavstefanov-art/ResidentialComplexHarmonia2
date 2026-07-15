using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlDirectoryStoreTests(SqlServerFixture fixture)
{
    private SqlDirectoryStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task UpsertContact_insert_creates_row_readable_by_ListAll()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");

        var result = await Store.UpsertContactAsync(hh, "Alice Smith", "555-0100", "alice@example.com");
        Assert.IsType<UpdateContactResult.Ok>(result);

        var all = await Store.ListAllAsync();
        var entry = all.FirstOrDefault(e => e.HouseholdRef == hh);
        Assert.NotNull(entry);
        Assert.Equal("Alice Smith", entry.DisplayName);
        Assert.Equal("555-0100", entry.Phone);
        Assert.Equal("alice@example.com", entry.Email);
        Assert.Null(entry.Notes);
    }

    [Fact]
    public async Task UpsertContact_partial_update_preserves_existing_phone()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Bob", "555-0200", null);

        await Store.UpsertContactAsync(hh, "Robert", null, null);

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.Equal("Robert", entry.DisplayName);
        Assert.Equal("555-0200", entry.Phone);
    }

    [Fact]
    public async Task UpsertNotes_insert_then_update_replaces_notes()
    {
        var hh = new HouseholdRef($"HH-DIR-{Guid.NewGuid():N}");
        await Store.UpsertNotesAsync(hh, "Parking spot A12");
        await Store.UpsertNotesAsync(hh, "Parking spot B7");

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.Equal("Parking spot B7", entry.Notes);
    }

    [Fact]
    public async Task UpsertContact_sets_IsOptedOut_and_ListAll_returns_it()
    {
        var hh = new HouseholdRef($"HH-DIR-OPT-{Guid.NewGuid():N}");

        await Store.UpsertContactAsync(hh, "Dave", null, null, isOptedOut: true);

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.True(entry.IsOptedOut);
    }

    [Fact]
    public async Task UpsertContact_null_isOptedOut_preserves_existing_value()
    {
        var hh = new HouseholdRef($"HH-DIR-OPT-PRES-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Eve", null, null, isOptedOut: true);

        await Store.UpsertContactAsync(hh, "Eve Updated", null, null, isOptedOut: null);

        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.True(entry.IsOptedOut);
    }

    [Fact]
    public async Task ListAll_returns_rows_ordered_by_household_ref()
    {
        var prefix = $"HH-DIR-ORD-{Guid.NewGuid():N}";
        var a = new HouseholdRef($"{prefix}-A");
        var b = new HouseholdRef($"{prefix}-B");
        await Store.UpsertContactAsync(b, "Zara", null, null);
        await Store.UpsertContactAsync(a, "Alice", null, null);

        var all = await Store.ListAllAsync();
        var relevant = all.Where(e => e.HouseholdRef == a || e.HouseholdRef == b).ToList();

        Assert.Equal(2, relevant.Count);
        Assert.True(string.Compare(
            relevant[0].HouseholdRef.Value,
            relevant[1].HouseholdRef.Value,
            StringComparison.Ordinal) < 0);
    }
}
