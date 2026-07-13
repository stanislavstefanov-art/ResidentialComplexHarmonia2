using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.UnitTests.Application;

public class GetNotificationHistoryTests
{
    private static readonly HouseholdRef HH = new("HH-HIST-1");

    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: HH);

    private static readonly SessionContext AdminWithHH =
        new(IsResident: false, IsAdmin: true, HouseholdRef: HH);

    private static GetNotificationHistory UseCase(INotificationStore store, SessionContext? ctx = null)
        => new(new FakeSession(ctx ?? ResidentCtx), store);

    [Fact]
    public async Task Resident_returns_Ok_with_history()
    {
        var store = new FakeNotificationStore();
        await store.AppendHistoryAsync(new NotificationRecord(
            Guid.NewGuid(), HH, "Charge posted", DateTimeOffset.UtcNow, "push"));

        var result = await UseCase(store).ExecuteAsync();

        var ok = Assert.IsType<GetNotificationHistoryResult.Ok>(result);
        Assert.Single(ok.Records);
        Assert.Equal("Charge posted", ok.Records[0].Title);
    }

    [Fact]
    public async Task Admin_with_HouseholdRef_returns_Ok()
    {
        var store = new FakeNotificationStore();
        var result = await UseCase(store, AdminWithHH).ExecuteAsync();
        Assert.IsType<GetNotificationHistoryResult.Ok>(result);
    }

    [Fact]
    public async Task Admin_without_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx).ExecuteAsync();
        Assert.IsType<GetNotificationHistoryResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var useCase = new GetNotificationHistory(new FakeSession(null), new FakeNotificationStore());
        var result = await useCase.ExecuteAsync();
        Assert.IsType<GetNotificationHistoryResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var result = await UseCase(new FailingNotificationStore()).ExecuteAsync();
        Assert.IsType<GetNotificationHistoryResult.Failed>(result);
    }
}
