using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class GetDirectoryTests
{
    [Fact]
    public async Task FakeDirectoryStore_ListAllAsync_returns_empty_list()
    {
        var store = new FakeDirectoryStore();
        var all = await store.ListAllAsync();
        Assert.Empty(all);
    }
}
