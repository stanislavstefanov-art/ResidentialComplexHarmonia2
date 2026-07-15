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

        var result = await Store.UpsertContactAsync(hh, "Alice Smith", "555-0100", "alice@example.com", isOptedOut: null);
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
        await Store.UpsertContactAsync(hh, "Bob", "555-0200", null, isOptedOut: null);

        await Store.UpsertContactAsync(hh, "Robert", null, null, isOptedOut: null);

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
        await Store.UpsertContactAsync(b, "Zara", null, null, isOptedOut: null);
        await Store.UpsertContactAsync(a, "Alice", null, null, isOptedOut: null);

        var all = await Store.ListAllAsync();
        var relevant = all.Where(e => e.HouseholdRef == a || e.HouseholdRef == b).ToList();

        Assert.Equal(2, relevant.Count);
        Assert.True(string.Compare(
            relevant[0].HouseholdRef.Value,
            relevant[1].HouseholdRef.Value,
            StringComparison.Ordinal) < 0);
    }

    [Fact, Trait("Category", "Rel")]
    public async Task DeleteContact_existing_row_returns_Ok_and_row_is_gone()
    {
        var hh = new HouseholdRef($"HH-DEL-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Dave", null, null, isOptedOut: null);

        var result = await Store.DeleteContactAsync(hh);

        Assert.IsType<EraseContactResult.Ok>(result);
        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.HouseholdRef == hh);
    }

    [Fact, Trait("Category", "Rel")]
    public async Task DeleteContact_nonexistent_row_returns_NotFound()
    {
        var hh = new HouseholdRef($"HH-DEL-NF-{Guid.NewGuid():N}");

        var result = await Store.DeleteContactAsync(hh);

        Assert.IsType<EraseContactResult.NotFound>(result);
    }

    [Fact, Trait("Category", "Rel")]
    public async Task DeleteContact_does_not_affect_other_rows()
    {
        var target = new HouseholdRef($"HH-DEL-TGT-{Guid.NewGuid():N}");
        var other  = new HouseholdRef($"HH-DEL-OTH-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(target, "Eve",   null, null, isOptedOut: null);
        await Store.UpsertContactAsync(other,  "Frank", null, null, isOptedOut: null);

        await Store.DeleteContactAsync(target);

        var all = await Store.ListAllAsync();
        Assert.DoesNotContain(all, e => e.HouseholdRef == target);
        Assert.Contains(all,       e => e.HouseholdRef == other);
    }

    [Fact]
    public async Task MarkDeparted_sets_DepartedAt_and_row_appears_in_ListAll()
    {
        var hh = new HouseholdRef($"HH-DEP-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Departed Dave", null, null, isOptedOut: null);

        var result = await Store.MarkDepartedAsync(hh);

        Assert.IsType<MarkDepartedResult.Ok>(result);
        var all = await Store.ListAllAsync();
        var entry = all.First(e => e.HouseholdRef == hh);
        Assert.NotNull(entry.DepartedAt);
    }

    [Fact]
    public async Task MarkDeparted_nonexistent_row_returns_NotFound()
    {
        var hh = new HouseholdRef($"HH-DEP-NF-{Guid.NewGuid():N}");

        var result = await Store.MarkDepartedAsync(hh);

        Assert.IsType<MarkDepartedResult.NotFound>(result);
    }

    [Fact]
    public async Task MarkDeparted_already_departed_is_idempotent_and_preserves_original_date()
    {
        var hh = new HouseholdRef($"HH-DEP-IDEM-{Guid.NewGuid():N}");
        await Store.UpsertContactAsync(hh, "Eve", null, null, isOptedOut: null);

        // First call sets the date
        await Store.MarkDepartedAsync(hh);
        var all = await Store.ListAllAsync();
        var firstDate = all.First(e => e.HouseholdRef == hh).DepartedAt;
        Assert.NotNull(firstDate);

        // Small delay to ensure clock would advance if not preserved
        await Task.Delay(10);

        // Second call must return Ok and must NOT update DepartedAt
        var result = await Store.MarkDepartedAsync(hh);
        Assert.IsType<MarkDepartedResult.Ok>(result);
        all = await Store.ListAllAsync();
        Assert.Equal(firstDate, all.First(e => e.HouseholdRef == hh).DepartedAt);
    }
}
