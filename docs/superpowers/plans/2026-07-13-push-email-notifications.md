# Push + Email Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VAPID Web Push + ACS email notifications for charge, payment, and BBQ events, with resident subscription management and admin broadcast.

**Architecture:** Application-layer `INotificationDispatcher` port decouples domain use cases from delivery. SQL stores subscriptions and history. `VapidPushDispatcher` adapter (Api layer) handles VAPID push with ACS email fallback. `BbqReminderService` is a `BackgroundService` that fires daily at 07:00 UTC.

**Tech Stack:** .NET 8, raw ADO.NET (SQL Server), `WebPush` NuGet (VAPID), `Azure.Communication.Email` NuGet (ACS), xUnit + `NullLogger.Instance` for unit tests, real SQL Server for `[Trait("Category","Rel")]` integration tests.

---

## File Map

**Create:**
- `src/Harmonia.Domain/Notifications/PushSubscription.cs`
- `src/Harmonia.Domain/Notifications/NotificationRecord.cs`
- `src/Harmonia.Application/Notifications/Ports.cs`
- `src/Harmonia.Application/Notifications/SaveSubscription.cs`
- `src/Harmonia.Application/Notifications/RemoveSubscription.cs`
- `src/Harmonia.Application/Notifications/SendAnnouncement.cs`
- `src/Harmonia.Application/Notifications/GetNotificationHistory.cs`
- `src/Harmonia.Api/Notifications/NotificationEndpoints.cs`
- `src/Harmonia.Api/Notifications/BbqReminderService.cs`
- `src/Harmonia.Api/Adapters/SqlNotificationStore.cs`
- `src/Harmonia.Api/Adapters/VapidPushDispatcher.cs`
- `tests/Harmonia.UnitTests/Application/SaveSubscriptionTests.cs`
- `tests/Harmonia.UnitTests/Application/RemoveSubscriptionTests.cs`
- `tests/Harmonia.UnitTests/Application/SendAnnouncementTests.cs`
- `tests/Harmonia.UnitTests/Application/GetNotificationHistoryTests.cs`
- `tests/Harmonia.UnitTests/Application/RecordChargeNotificationTests.cs`
- `tests/Harmonia.UnitTests/Application/RecordPaymentNotificationTests.cs`
- `tests/Harmonia.UnitTests/Api/NotificationEndpointsTests.cs`
- `tests/Harmonia.IntegrationTests/SqlNotificationStoreTests.cs`

**Modify:**
- `tests/Harmonia.UnitTests/Fakes.cs` — add 4 fakes + update `RecordingStore`
- `src/Harmonia.Application/Ports.cs` — add `GetDayBookingHoldersAsync` to `IReservationStore`
- `src/Harmonia.Api/Adapters/SqlReservationStore.cs` — implement `GetDayBookingHoldersAsync`
- `src/Harmonia.Application/MaintenanceFees/RecordCharge.cs` — add `INotificationDispatcher`
- `src/Harmonia.Application/Payments/RecordPayment.cs` — add `INotificationDispatcher`
- `tests/Harmonia.UnitTests/Application/RecordChargeTests.cs` — update `UseCase` helper
- `tests/Harmonia.UnitTests/Application/RecordPaymentTests.cs` — update `Build` helper
- `src/Harmonia.Api/Program.cs` — wire notification services
- `db/schema.sql` — add two new tables
- `src/Harmonia.Api/appsettings.json` — add empty config keys
- `src/Harmonia.Api/Harmonia.Api.csproj` — add WebPush + Azure.Communication.Email packages

---

## Task 1: Domain types

**Test-first: no — pure data records, no behaviour to test**

**Files:**
- Create: `src/Harmonia.Domain/Notifications/PushSubscription.cs`
- Create: `src/Harmonia.Domain/Notifications/NotificationRecord.cs`

- [ ] **Step 1: Create `PushSubscription.cs`**

```csharp
// src/Harmonia.Domain/Notifications/PushSubscription.cs
namespace Harmonia.Domain.Notifications;

public sealed record PushSubscription(
    HouseholdRef   HouseholdRef,
    string         Endpoint,
    string         P256dhKey,
    string         AuthKey,
    string?        FallbackEmail,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
```

- [ ] **Step 2: Create `NotificationRecord.cs`**

```csharp
// src/Harmonia.Domain/Notifications/NotificationRecord.cs
namespace Harmonia.Domain.Notifications;

// Channel: "push" | "email" | "skipped"
public sealed record NotificationRecord(
    Guid           Id,
    HouseholdRef   HouseholdRef,
    string         Title,
    DateTimeOffset SentAt,
    string         Channel);
```

- [ ] **Step 3: Build to verify no errors**

```
dotnet build src/Harmonia.Domain/Harmonia.Domain.csproj
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/Harmonia.Domain/Notifications/
git commit -m "feat: add PushSubscription and NotificationRecord domain types"
```

---

## Task 2: Application ports

**Test-first: no — pure interface / result-union definitions**

**Files:**
- Create: `src/Harmonia.Application/Notifications/Ports.cs`

- [ ] **Step 1: Create `Ports.cs`**

```csharp
// src/Harmonia.Application/Notifications/Ports.cs
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.Application.Notifications;

public abstract record SaveSubscriptionResult
{
    private SaveSubscriptionResult() { }
    public sealed record Refused                                           : SaveSubscriptionResult;
    public sealed record Saved(PushSubscription Subscription, bool IsNew) : SaveSubscriptionResult;
    public sealed record Failed                                            : SaveSubscriptionResult;
}

public abstract record RemoveSubscriptionResult
{
    private RemoveSubscriptionResult() { }
    public sealed record Refused   : RemoveSubscriptionResult;
    public sealed record Removed   : RemoveSubscriptionResult;
    public sealed record NotFound  : RemoveSubscriptionResult;
    public sealed record Failed    : RemoveSubscriptionResult;
}

public abstract record SendAnnouncementResult
{
    private SendAnnouncementResult() { }
    public sealed record Refused  : SendAnnouncementResult;
    public sealed record Accepted : SendAnnouncementResult;
    public sealed record Failed   : SendAnnouncementResult;
}

public abstract record GetNotificationHistoryResult
{
    private GetNotificationHistoryResult() { }
    public sealed record Refused                                            : GetNotificationHistoryResult;
    public sealed record Ok(IReadOnlyList<NotificationRecord> Records)     : GetNotificationHistoryResult;
    public sealed record Failed                                             : GetNotificationHistoryResult;
}

public interface INotificationStore
{
    Task<SaveSubscriptionResult>  SaveSubscriptionAsync(PushSubscription sub, CancellationToken ct = default);
    Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(HouseholdRef householdRef, CancellationToken ct = default);
    Task<PushSubscription?> GetSubscriptionAsync(HouseholdRef householdRef, CancellationToken ct = default);
    Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default);

    Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default);
    Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(HouseholdRef householdRef, CancellationToken ct = default);
}

public enum NotificationKind { ChargePosted, PaymentRecorded, BbqReminder, Announcement }

public interface INotificationDispatcher
{
    Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default);
    Task BroadcastAsync(string title, string body, CancellationToken ct = default);
}
```

- [ ] **Step 2: Build**

```
dotnet build src/Harmonia.Application/Harmonia.Application.csproj
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/Harmonia.Application/Notifications/Ports.cs
git commit -m "feat: add INotificationStore, INotificationDispatcher ports + result unions"
```

---

## Task 3: Fakes

**Test-first: no — support infrastructure for all use-case tests**

**Files:**
- Modify: `tests/Harmonia.UnitTests/Fakes.cs`

- [ ] **Step 1: Add 4 notification fakes and update `RecordingStore`**

Open `tests/Harmonia.UnitTests/Fakes.cs`. Add at the top, after existing usings:

```csharp
using Harmonia.Application.Notifications;
using Harmonia.Domain.Notifications;
```

Then append these classes at the end of the file (before the final `}`):

```csharp
/// <summary>Records all calls; never throws. DispatchCalls keyed by kind.</summary>
public sealed class FakeNotificationStore : INotificationStore
{
    private readonly Dictionary<HouseholdRef, PushSubscription> _subs = [];
    private readonly List<NotificationRecord> _history = [];

    public Task<SaveSubscriptionResult> SaveSubscriptionAsync(
        PushSubscription sub, CancellationToken ct = default)
    {
        var isNew = !_subs.ContainsKey(sub.HouseholdRef);
        var stored = isNew ? sub : sub with { CreatedAt = _subs[sub.HouseholdRef].CreatedAt };
        _subs[sub.HouseholdRef] = stored;
        return Task.FromResult<SaveSubscriptionResult>(
            new SaveSubscriptionResult.Saved(stored, isNew));
    }

    public Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        if (!_subs.Remove(householdRef))
            return Task.FromResult<RemoveSubscriptionResult>(new RemoveSubscriptionResult.NotFound());
        return Task.FromResult<RemoveSubscriptionResult>(new RemoveSubscriptionResult.Removed());
    }

    public Task<PushSubscription?> GetSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        _subs.TryGetValue(householdRef, out var sub);
        return Task.FromResult(sub);
    }

    public Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<PushSubscription>>(_subs.Values.ToList());

    public Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default)
    {
        _history.Add(record);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
        var result = _history
            .Where(r => r.HouseholdRef == householdRef && r.SentAt >= cutoff)
            .OrderByDescending(r => r.SentAt)
            .ToList();
        return Task.FromResult<IReadOnlyList<NotificationRecord>>(result);
    }
}

public sealed class FailingNotificationStore : INotificationStore
{
    public Task<SaveSubscriptionResult> SaveSubscriptionAsync(
        PushSubscription sub, CancellationToken ct = default)
        => Task.FromResult<SaveSubscriptionResult>(new SaveSubscriptionResult.Failed());

    public Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => Task.FromResult<RemoveSubscriptionResult>(new RemoveSubscriptionResult.Failed());

    public Task<PushSubscription?> GetSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");

    public Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated store failure");
}

/// <summary>Records dispatch calls; never throws.</summary>
public sealed class FakeNotificationDispatcher : INotificationDispatcher
{
    public List<(NotificationKind Kind, HouseholdRef HouseholdRef)> DispatchCalls { get; } = [];
    public List<(string Title, string Body)> BroadcastCalls { get; } = [];

    public Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default)
    {
        DispatchCalls.Add((kind, householdRef));
        return Task.CompletedTask;
    }

    public Task BroadcastAsync(string title, string body, CancellationToken ct = default)
    {
        BroadcastCalls.Add((title, body));
        return Task.CompletedTask;
    }
}

public sealed class FailingNotificationDispatcher : INotificationDispatcher
{
    public Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated dispatcher failure");

    public Task BroadcastAsync(string title, string body, CancellationToken ct = default)
        => throw new InvalidOperationException("Simulated dispatcher failure");
}
```

Also update `RecordingStore` to add `GetDayBookingHoldersAsync` with a default no-op implementation
(the full interface addition happens in Task 9, but the fake must compile once the interface changes).
Hold off on this until Task 9 to avoid premature compilation breaks — add a `// TODO: Task 9` comment
here as a reminder.

- [ ] **Step 2: Build unit tests project**

```
dotnet build tests/Harmonia.UnitTests/Harmonia.UnitTests.csproj
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add tests/Harmonia.UnitTests/Fakes.cs
git commit -m "test: add FakeNotificationStore, FakeNotificationDispatcher and failing variants"
```

---

## Task 4: SaveSubscription use case + tests

**Test-first: yes — resident → Saved (IsNew=true), re-save → Saved (IsNew=false), non-resident → Refused, null HouseholdRef → Refused, store failure → Failed**

**Files:**
- Create: `src/Harmonia.Application/Notifications/SaveSubscription.cs`
- Create: `tests/Harmonia.UnitTests/Application/SaveSubscriptionTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
// tests/Harmonia.UnitTests/Application/SaveSubscriptionTests.cs
using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class SaveSubscriptionTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-SUB-1"));

    private static SaveSubscription UseCase(INotificationStore store, SessionContext? ctx = null)
        => new(new FakeSession(ctx ?? ResidentCtx), store);

    [Fact]
    public async Task Resident_creates_new_subscription_returns_Saved_IsNew_true()
    {
        var store = new FakeNotificationStore();
        var result = await UseCase(store).ExecuteAsync(
            "https://push.example.com/abc", "p256key", "authkey", "test@example.com");
        var saved = Assert.IsType<SaveSubscriptionResult.Saved>(result);
        Assert.True(saved.IsNew);
        Assert.Equal(new HouseholdRef("HH-SUB-1"), saved.Subscription.HouseholdRef);
        Assert.Equal("test@example.com", saved.Subscription.FallbackEmail);
    }

    [Fact]
    public async Task Resident_re_saves_subscription_returns_Saved_IsNew_false()
    {
        var store = new FakeNotificationStore();
        await UseCase(store).ExecuteAsync("https://push.example.com/abc", "p256key", "authkey", null);
        var result = await UseCase(store).ExecuteAsync("https://push.example.com/new", "k2", "a2", null);
        var saved = Assert.IsType<SaveSubscriptionResult.Saved>(result);
        Assert.False(saved.IsNew);
    }

    [Fact]
    public async Task Non_resident_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx)
            .ExecuteAsync("https://push.example.com/abc", "k", "a", null);
        Assert.IsType<SaveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var result = await UseCase(new FakeNotificationStore(), null)
            .ExecuteAsync("https://push.example.com/abc", "k", "a", null);
        Assert.IsType<SaveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_without_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx)
            .ExecuteAsync("https://push.example.com/abc", "k", "a", null);
        Assert.IsType<SaveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var result = await UseCase(new FailingNotificationStore())
            .ExecuteAsync("https://push.example.com/abc", "k", "a", null);
        Assert.IsType<SaveSubscriptionResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure (SaveSubscription doesn't exist yet)**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~SaveSubscriptionTests" --no-build 2>&1 | head -20
```

Expected: Build error — `The type or namespace name 'SaveSubscription' could not be found`.

- [ ] **Step 3: Implement `SaveSubscription`**

```csharp
// src/Harmonia.Application/Notifications/SaveSubscription.cs
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.Application.Notifications;

public sealed class SaveSubscription(ISession session, INotificationStore store)
{
    public async Task<SaveSubscriptionResult> ExecuteAsync(
        string endpoint, string p256dhKey, string authKey,
        string? email, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true })
            return new SaveSubscriptionResult.Refused();
        if (ctx.HouseholdRef is null)
            return new SaveSubscriptionResult.Refused();

        var now = DateTimeOffset.UtcNow;
        var sub = new PushSubscription(
            HouseholdRef:  ctx.HouseholdRef.Value,
            Endpoint:      endpoint,
            P256dhKey:     p256dhKey,
            AuthKey:       authKey,
            FallbackEmail: email,
            CreatedAt:     now,
            UpdatedAt:     now);

        return await store.SaveSubscriptionAsync(sub, ct);
    }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~SaveSubscriptionTests"
```

Expected: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/Harmonia.Application/Notifications/SaveSubscription.cs \
        tests/Harmonia.UnitTests/Application/SaveSubscriptionTests.cs
git commit -m "feat: add SaveSubscription use case"
```

---

## Task 5: RemoveSubscription use case + tests

**Test-first: yes — resident → Removed; resident not-found → NotFound; non-resident → Refused; null HouseholdRef → Refused**

**Files:**
- Create: `src/Harmonia.Application/Notifications/RemoveSubscription.cs`
- Create: `tests/Harmonia.UnitTests/Application/RemoveSubscriptionTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
// tests/Harmonia.UnitTests/Application/RemoveSubscriptionTests.cs
using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class RemoveSubscriptionTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-REM-1"));

    private static RemoveSubscription UseCase(INotificationStore store, SessionContext? ctx = null)
        => new(new FakeSession(ctx ?? ResidentCtx), store);

    [Fact]
    public async Task Resident_removes_existing_subscription_returns_Removed()
    {
        var store = new FakeNotificationStore();
        await new SaveSubscription(new FakeSession(ResidentCtx), store)
            .ExecuteAsync("https://push.example.com/x", "k", "a", null);

        var result = await UseCase(store).ExecuteAsync();

        Assert.IsType<RemoveSubscriptionResult.Removed>(result);
    }

    [Fact]
    public async Task Resident_removes_nonexistent_returns_NotFound()
    {
        var result = await UseCase(new FakeNotificationStore()).ExecuteAsync();
        Assert.IsType<RemoveSubscriptionResult.NotFound>(result);
    }

    [Fact]
    public async Task Non_resident_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx).ExecuteAsync();
        Assert.IsType<RemoveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var result = await UseCase(new FakeNotificationStore(), null).ExecuteAsync();
        Assert.IsType<RemoveSubscriptionResult.Refused>(result);
    }

    [Fact]
    public async Task Resident_without_HouseholdRef_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: null);
        var result = await UseCase(new FakeNotificationStore(), ctx).ExecuteAsync();
        Assert.IsType<RemoveSubscriptionResult.Refused>(result);
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~RemoveSubscriptionTests" --no-build 2>&1 | head -10
```

Expected: Build error — `RemoveSubscription` not found.

- [ ] **Step 3: Implement `RemoveSubscription`**

```csharp
// src/Harmonia.Application/Notifications/RemoveSubscription.cs
using Harmonia.Domain;

namespace Harmonia.Application.Notifications;

public sealed class RemoveSubscription(ISession session, INotificationStore store)
{
    public async Task<RemoveSubscriptionResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsResident: true })
            return new RemoveSubscriptionResult.Refused();
        if (ctx.HouseholdRef is null)
            return new RemoveSubscriptionResult.Refused();

        return await store.RemoveSubscriptionAsync(ctx.HouseholdRef.Value, ct);
    }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~RemoveSubscriptionTests"
```

Expected: 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/Harmonia.Application/Notifications/RemoveSubscription.cs \
        tests/Harmonia.UnitTests/Application/RemoveSubscriptionTests.cs
git commit -m "feat: add RemoveSubscription use case"
```

---

## Task 6: SendAnnouncement use case + tests

**Test-first: yes — admin → Accepted; non-admin → Refused; dispatcher failure → Failed**

**Files:**
- Create: `src/Harmonia.Application/Notifications/SendAnnouncement.cs`
- Create: `tests/Harmonia.UnitTests/Application/SendAnnouncementTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
// tests/Harmonia.UnitTests/Application/SendAnnouncementTests.cs
using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class SendAnnouncementTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    private static SendAnnouncement UseCase(INotificationDispatcher dispatcher, SessionContext? ctx = null)
        => new(new FakeSession(ctx ?? AdminCtx), dispatcher);

    [Fact]
    public async Task Admin_broadcasts_returns_Accepted()
    {
        var dispatcher = new FakeNotificationDispatcher();
        var result = await UseCase(dispatcher).ExecuteAsync("Hello", "Board message");
        Assert.IsType<SendAnnouncementResult.Accepted>(result);
        Assert.Single(dispatcher.BroadcastCalls);
        Assert.Equal("Hello", dispatcher.BroadcastCalls[0].Title);
    }

    [Fact]
    public async Task Non_admin_returns_Refused()
    {
        var ctx = new SessionContext(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-1"));
        var result = await UseCase(new FakeNotificationDispatcher(), ctx)
            .ExecuteAsync("Hello", "Body");
        Assert.IsType<SendAnnouncementResult.Refused>(result);
    }

    [Fact]
    public async Task Null_session_returns_Refused()
    {
        var result = await UseCase(new FakeNotificationDispatcher(), null)
            .ExecuteAsync("Hello", "Body");
        Assert.IsType<SendAnnouncementResult.Refused>(result);
    }

    [Fact]
    public async Task Dispatcher_failure_returns_Failed()
    {
        var result = await UseCase(new FailingNotificationDispatcher())
            .ExecuteAsync("Hello", "Body");
        Assert.IsType<SendAnnouncementResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~SendAnnouncementTests" --no-build 2>&1 | head -10
```

Expected: Build error — `SendAnnouncement` not found.

- [ ] **Step 3: Implement `SendAnnouncement`**

```csharp
// src/Harmonia.Application/Notifications/SendAnnouncement.cs
namespace Harmonia.Application.Notifications;

public sealed class SendAnnouncement(ISession session, INotificationDispatcher dispatcher)
{
    public async Task<SendAnnouncementResult> ExecuteAsync(
        string title, string body, CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new SendAnnouncementResult.Refused();

        try
        {
            await dispatcher.BroadcastAsync(title, body, ct);
            return new SendAnnouncementResult.Accepted();
        }
        catch (Exception)
        {
            return new SendAnnouncementResult.Failed();
        }
    }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~SendAnnouncementTests"
```

Expected: 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/Harmonia.Application/Notifications/SendAnnouncement.cs \
        tests/Harmonia.UnitTests/Application/SendAnnouncementTests.cs
git commit -m "feat: add SendAnnouncement use case"
```

---

## Task 7: GetNotificationHistory use case + tests

**Test-first: yes — resident → Ok; admin with HouseholdRef → Ok; admin no HouseholdRef → Refused; no session → Refused; store failure → Failed**

**Files:**
- Create: `src/Harmonia.Application/Notifications/GetNotificationHistory.cs`
- Create: `tests/Harmonia.UnitTests/Application/GetNotificationHistoryTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
// tests/Harmonia.UnitTests/Application/GetNotificationHistoryTests.cs
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
        var result = await UseCase(new FakeNotificationStore(), null).ExecuteAsync();
        Assert.IsType<GetNotificationHistoryResult.Refused>(result);
    }

    [Fact]
    public async Task Store_failure_returns_Failed()
    {
        var result = await UseCase(new FailingNotificationStore()).ExecuteAsync();
        Assert.IsType<GetNotificationHistoryResult.Failed>(result);
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~GetNotificationHistoryTests" --no-build 2>&1 | head -10
```

Expected: Build error — `GetNotificationHistory` not found.

- [ ] **Step 3: Implement `GetNotificationHistory`**

```csharp
// src/Harmonia.Application/Notifications/GetNotificationHistory.cs
using Harmonia.Domain;

namespace Harmonia.Application.Notifications;

public sealed class GetNotificationHistory(ISession session, INotificationStore store)
{
    public async Task<GetNotificationHistoryResult> ExecuteAsync(CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not ({ IsResident: true } or { IsAdmin: true }))
            return new GetNotificationHistoryResult.Refused();
        if (ctx.HouseholdRef is null)
            return new GetNotificationHistoryResult.Refused();

        try
        {
            var records = await store.GetHistoryAsync(ctx.HouseholdRef.Value, ct);
            return new GetNotificationHistoryResult.Ok(records);
        }
        catch (Exception)
        {
            return new GetNotificationHistoryResult.Failed();
        }
    }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~GetNotificationHistoryTests"
```

Expected: 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/Harmonia.Application/Notifications/GetNotificationHistory.cs \
        tests/Harmonia.UnitTests/Application/GetNotificationHistoryTests.cs
git commit -m "feat: add GetNotificationHistory use case"
```

---

## Task 8: RecordCharge + RecordPayment trigger integration

**Test-first: yes — Created → dispatcher called with ChargePosted/PaymentRecorded; Duplicate → dispatcher NOT called; Failed → dispatcher NOT called**

**Files:**
- Modify: `src/Harmonia.Application/MaintenanceFees/RecordCharge.cs`
- Modify: `src/Harmonia.Application/Payments/RecordPayment.cs`
- Modify: `tests/Harmonia.UnitTests/Application/RecordChargeTests.cs`
- Modify: `tests/Harmonia.UnitTests/Application/RecordPaymentTests.cs`
- Create: `tests/Harmonia.UnitTests/Application/RecordChargeNotificationTests.cs`
- Create: `tests/Harmonia.UnitTests/Application/RecordPaymentNotificationTests.cs`

- [ ] **Step 1: Write failing notification tests for RecordCharge**

```csharp
// tests/Harmonia.UnitTests/Application/RecordChargeNotificationTests.cs
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Notifications;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class RecordChargeNotificationTests
{
    private static readonly HouseholdRef Target = new("HH-NOTIFY-1");
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Created_charge_dispatches_ChargePosted()
    {
        var store      = new FakeMaintenanceFeeStore();
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordCharge(new FakeSession(AdminCtx), store, dispatcher);

        await useCase.ExecuteAsync(Target, 100m, "Fee", "2026-07", "key-notify-1");

        Assert.Single(dispatcher.DispatchCalls);
        Assert.Equal(NotificationKind.ChargePosted, dispatcher.DispatchCalls[0].Kind);
        Assert.Equal(Target, dispatcher.DispatchCalls[0].HouseholdRef);
    }

    [Fact]
    public async Task Duplicate_charge_does_not_dispatch()
    {
        var store      = new FakeMaintenanceFeeStore();
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordCharge(new FakeSession(AdminCtx), store, dispatcher);

        await useCase.ExecuteAsync(Target, 100m, "Fee", "2026-07", "key-dup");
        dispatcher.DispatchCalls.Clear();  // reset after first call

        await useCase.ExecuteAsync(Target, 100m, "Fee", "2026-07", "key-dup");

        Assert.Empty(dispatcher.DispatchCalls);
    }

    [Fact]
    public async Task Store_failure_does_not_dispatch()
    {
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordCharge(new FakeSession(AdminCtx), new FailingMaintenanceFeeStore(), dispatcher);

        await useCase.ExecuteAsync(Target, 100m, "Fee", "2026-07", "key-fail");

        Assert.Empty(dispatcher.DispatchCalls);
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure (RecordCharge takes 2 params, not 3)**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~RecordChargeNotificationTests" --no-build 2>&1 | head -10
```

Expected: Build error — `RecordCharge` takes 2 args.

- [ ] **Step 3: Modify `RecordCharge` to add `INotificationDispatcher`**

Replace the contents of `src/Harmonia.Application/MaintenanceFees/RecordCharge.cs`:

```csharp
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Application.MaintenanceFees;

/// <summary>
/// Use case: an admin records a maintenance fee charge for a household.
/// Target household comes from the route parameter — it is the action target, not the actor's
/// identity (documented R2 exception on admin POST). The actor's identity is verified via
/// IsAdmin from the session; a non-admin or missing session is refused immediately.
/// </summary>
public sealed class RecordCharge(ISession session, IMaintenanceFeeStore store, INotificationDispatcher dispatcher)
{
    public async Task<RecordChargeResult> ExecuteAsync(
        HouseholdRef targetHousehold,
        decimal amountEur,
        string description,
        string period,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordChargeResult.Refused();

        var charge = new MaintenanceFeeCharge(
            Id: Guid.NewGuid(),
            HouseholdRef: targetHousehold,
            AmountEur: amountEur,
            Description: description,
            Period: period,
            ChargedAt: DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        var result = await store.RecordChargeAsync(charge, ct);
        if (result is RecordChargeResult.Created created)
            _ = dispatcher.DispatchAsync(NotificationKind.ChargePosted, created.Charge.HouseholdRef, ct);
        return result;
    }
}
```

- [ ] **Step 4: Update `RecordChargeTests.cs` — the `UseCase` helper now needs a dispatcher**

Open `tests/Harmonia.UnitTests/Application/RecordChargeTests.cs`.
Change the `UseCase` helper from:

```csharp
private static RecordCharge UseCase(IMaintenanceFeeStore store, SessionContext? ctx = null)
    => new(new FakeSession(ctx ?? AdminCtx), store);
```

to:

```csharp
private static RecordCharge UseCase(IMaintenanceFeeStore store, SessionContext? ctx = null)
    => new(new FakeSession(ctx ?? AdminCtx), store, new FakeNotificationDispatcher());
```

Also add the using at the top if missing: `using Harmonia.Application.Notifications;`

- [ ] **Step 5: Run all RecordCharge tests — expect all pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~RecordCharge"
```

Expected: all existing + 3 new notification tests pass.

- [ ] **Step 6: Write failing notification tests for RecordPayment**

```csharp
// tests/Harmonia.UnitTests/Application/RecordPaymentNotificationTests.cs
using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Application.Payments;
using Harmonia.Domain;

namespace Harmonia.UnitTests.Application;

public class RecordPaymentNotificationTests
{
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    [Fact]
    public async Task Created_payment_dispatches_PaymentRecorded()
    {
        var store      = new FakePaymentStore();
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordPayment(new FakeSession(AdminCtx), store, dispatcher);

        await useCase.ExecuteAsync("HH-PAY-N1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-notify-1");

        Assert.Single(dispatcher.DispatchCalls);
        Assert.Equal(NotificationKind.PaymentRecorded, dispatcher.DispatchCalls[0].Kind);
        Assert.Equal(new HouseholdRef("HH-PAY-N1"), dispatcher.DispatchCalls[0].HouseholdRef);
    }

    [Fact]
    public async Task Duplicate_payment_does_not_dispatch()
    {
        var store      = new FakePaymentStore();
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordPayment(new FakeSession(AdminCtx), store, dispatcher);

        await useCase.ExecuteAsync("HH-PAY-N2", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-dup");
        dispatcher.DispatchCalls.Clear();

        await useCase.ExecuteAsync("HH-PAY-N2", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-dup");

        Assert.Empty(dispatcher.DispatchCalls);
    }

    [Fact]
    public async Task Store_failure_does_not_dispatch()
    {
        var dispatcher = new FakeNotificationDispatcher();
        var useCase    = new RecordPayment(new FakeSession(AdminCtx), new FailingPaymentStore(), dispatcher);

        await useCase.ExecuteAsync("HH-PAY-N3", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-fail");

        Assert.Empty(dispatcher.DispatchCalls);
    }
}
```

- [ ] **Step 7: Run tests — expect compile failure (RecordPayment takes 2 params)**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~RecordPaymentNotificationTests" --no-build 2>&1 | head -10
```

- [ ] **Step 8: Modify `RecordPayment` to add `INotificationDispatcher`**

Replace contents of `src/Harmonia.Application/Payments/RecordPayment.cs`:

```csharp
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Payments;

namespace Harmonia.Application.Payments;

public sealed class RecordPayment(ISession session, IPaymentStore store, INotificationDispatcher dispatcher)
{
    public async Task<RecordPaymentResult> ExecuteAsync(
        string householdRef,
        decimal amountEur,
        string period,
        DateOnly dateReceived,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var ctx = session.Resolve();
        if (ctx is not { IsAdmin: true })
            return new RecordPaymentResult.Refused();

        var payment = new MaintenanceFeePayment(
            Id:             Guid.NewGuid(),
            HouseholdRef:   new HouseholdRef(householdRef),
            AmountEur:      amountEur,
            Period:         period,
            DateReceived:   dateReceived,
            RecordedAt:     DateTimeOffset.UtcNow,
            IdempotencyKey: idempotencyKey);

        var result = await store.RecordPaymentAsync(payment, ct);
        if (result is RecordPaymentResult.Created created)
            _ = dispatcher.DispatchAsync(NotificationKind.PaymentRecorded, created.Payment.HouseholdRef, ct);
        return result;
    }
}
```

- [ ] **Step 9: Update `RecordPaymentTests.cs` — the `Build` helper needs a dispatcher**

Open `tests/Harmonia.UnitTests/Application/RecordPaymentTests.cs`. Change:

```csharp
private static (RecordPayment UseCase, FakePaymentStore Store) Build(SessionContext? ctx)
{
    var store = new FakePaymentStore();
    return (new RecordPayment(new FakeSession(ctx), store), store);
}
```

to:

```csharp
private static (RecordPayment UseCase, FakePaymentStore Store) Build(SessionContext? ctx)
{
    var store = new FakePaymentStore();
    return (new RecordPayment(new FakeSession(ctx), store, new FakeNotificationDispatcher()), store);
}
```

Also update the `Store_failure_returns_Failed` test which creates `RecordPayment` directly:

```csharp
[Fact]
public async Task Store_failure_returns_Failed()
{
    var ctx = new SessionContext(IsResident: false, IsAdmin: true, HouseholdRef: null);
    var useCase = new RecordPayment(new FakeSession(ctx), new FailingPaymentStore(), new FakeNotificationDispatcher());

    var result = await useCase.ExecuteAsync(
        "HH-1", 500m, "2026-07", new DateOnly(2026, 7, 10), "pay-001");

    Assert.IsType<RecordPaymentResult.Failed>(result);
}
```

Add the using: `using Harmonia.Application.Notifications;`

- [ ] **Step 10: Run all RecordPayment tests**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~RecordPayment"
```

Expected: all pass.

- [ ] **Step 11: Run the full unit test suite to confirm no regressions**

```
dotnet test tests/Harmonia.UnitTests/
```

Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/Harmonia.Application/MaintenanceFees/RecordCharge.cs \
        src/Harmonia.Application/Payments/RecordPayment.cs \
        tests/Harmonia.UnitTests/Application/RecordChargeTests.cs \
        tests/Harmonia.UnitTests/Application/RecordPaymentTests.cs \
        tests/Harmonia.UnitTests/Application/RecordChargeNotificationTests.cs \
        tests/Harmonia.UnitTests/Application/RecordPaymentNotificationTests.cs
git commit -m "feat: wire INotificationDispatcher into RecordCharge and RecordPayment"
```

---

## Task 9: IReservationStore extension + SqlReservationStore implementation

**Test-first: yes (Rel) — GetDayBookingHoldersAsync returns DISTINCT HouseholdRefs for a given day**

**Files:**
- Modify: `src/Harmonia.Application/Ports.cs`
- Modify: `src/Harmonia.Api/Adapters/SqlReservationStore.cs`
- Modify: `tests/Harmonia.UnitTests/Fakes.cs` — update `RecordingStore`
- Create: new test method in `tests/Harmonia.IntegrationTests/SqlReservationStoreTests.cs` (or a new file)

- [ ] **Step 1: Write the failing integration test**

Open `tests/Harmonia.IntegrationTests/SqlReservationStoreTests.cs`. Add a new test method at the bottom of the `SqlReservationStoreTests` class:

```csharp
[Fact]
public async Task GetDayBookingHolders_returns_distinct_households_for_given_day()
{
    // This test will fail until GetDayBookingHoldersAsync is added to IReservationStore.
    var store    = new SqlReservationStore(fixture.ConnectionString);
    var day      = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)).AddDays(new Random().Next(100, 999));
    var hh1      = new HouseholdRef($"HH-BBQ-{Guid.NewGuid():N}");
    var hh2      = new HouseholdRef($"HH-BBQ-{Guid.NewGuid():N}");

    await store.ClaimSlotAsync(day, "DAY", hh1);

    var holders = await store.GetDayBookingHoldersAsync(day);

    Assert.Contains(hh1, holders);
    Assert.DoesNotContain(hh2, holders);
}
```

- [ ] **Step 2: Run the integration test — expect compile failure**

```
dotnet test tests/Harmonia.IntegrationTests/ --filter "GetDayBookingHolders" --no-build 2>&1 | head -10
```

Expected: Build error — `GetDayBookingHoldersAsync` not found.

- [ ] **Step 3: Add `GetDayBookingHoldersAsync` to `IReservationStore` interface**

In `src/Harmonia.Application/Ports.cs`, add to the `IReservationStore` interface:

```csharp
// Returns one HouseholdRef per distinct household with a booking on the given day.
Task<IReadOnlyList<HouseholdRef>> GetDayBookingHoldersAsync(DateOnly day, CancellationToken ct = default);
```

The full updated file contents:

```csharp
using Harmonia.Domain;
using Harmonia.Domain.Reservations;

namespace Harmonia.Application.Reservations;

public interface IReservationStore
{
    Task<IReadOnlyDictionary<string, HouseholdRef>> GetDayHoldersAsync(
        DateOnly day, CancellationToken ct = default);

    Task<ClaimResult> ClaimSlotAsync(
        DateOnly day, string slotKey, HouseholdRef householdRef, CancellationToken ct = default);

    // Returns one HouseholdRef per distinct household with a booking on the given day.
    Task<IReadOnlyList<HouseholdRef>> GetDayBookingHoldersAsync(DateOnly day, CancellationToken ct = default);
}

public interface ISlotGrid
{
    IReadOnlyList<string> ForDay(DateOnly day);
}
```

- [ ] **Step 4: Implement in `SqlReservationStore`**

Add this method to `src/Harmonia.Api/Adapters/SqlReservationStore.cs` (before the closing `}`):

```csharp
public async Task<IReadOnlyList<HouseholdRef>> GetDayBookingHoldersAsync(
    DateOnly day, CancellationToken ct = default)
{
    await using var conn = new SqlConnection(_connectionString);
    await conn.OpenAsync(ct);
    await using var cmd = conn.CreateCommand();
    cmd.CommandText =
        "SELECT DISTINCT HouseholdRef FROM dbo.Reservations WHERE DayDate = @Day;";
    cmd.Parameters.Add(DayParameter(day));

    var holders = new List<HouseholdRef>();
    await using var reader = await cmd.ExecuteReaderAsync(ct);
    while (await reader.ReadAsync(ct))
        holders.Add(new HouseholdRef(reader.GetString(0)));
    return holders;
}
```

- [ ] **Step 5: Update `RecordingStore` in Fakes.cs to implement the new interface method**

In `tests/Harmonia.UnitTests/Fakes.cs`, add to `RecordingStore`:

```csharp
public Task<IReadOnlyList<HouseholdRef>> GetDayBookingHoldersAsync(
    DateOnly day, CancellationToken ct = default)
{
    var holders = Holders.Values.Distinct().ToList();
    return Task.FromResult<IReadOnlyList<HouseholdRef>>(holders);
}
```

- [ ] **Step 6: Build all projects**

```
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 7: Run integration test (requires `HARMONIA_SQL_CONNSTR`)**

```
dotnet test tests/Harmonia.IntegrationTests/ --filter "GetDayBookingHolders"
```

Expected: 1 test passed.

- [ ] **Step 8: Run full unit test suite to confirm no regressions**

```
dotnet test tests/Harmonia.UnitTests/
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/Harmonia.Application/Ports.cs \
        src/Harmonia.Api/Adapters/SqlReservationStore.cs \
        tests/Harmonia.UnitTests/Fakes.cs \
        tests/Harmonia.IntegrationTests/SqlReservationStoreTests.cs
git commit -m "feat: add GetDayBookingHoldersAsync to IReservationStore for BBQ reminder"
```

---

## Task 10: SQL schema additions + config keys

**Test-first: no — DDL verification is covered by the integration tests in Task 11**

**Files:**
- Modify: `db/schema.sql`
- Modify: `src/Harmonia.Api/appsettings.json`

- [ ] **Step 1: Add tables to `db/schema.sql`**

Append to the end of `db/schema.sql`:

```sql

-- Push subscription store (one row per household; UPSERT semantics).
-- Endpoint, P256dhKey, AuthKey, FallbackEmail are personal data (GDPR/R3) — never logged.
IF OBJECT_ID(N'dbo.PushSubscriptions', N'U') IS NULL
CREATE TABLE dbo.PushSubscriptions
(
    HouseholdRef  nvarchar(128)     NOT NULL,
    Endpoint      nvarchar(2048)    NOT NULL,
    P256dhKey     nvarchar(128)     NOT NULL,
    AuthKey       nvarchar(128)     NOT NULL,
    FallbackEmail nvarchar(320)     NULL,
    CreatedAt     datetimeoffset(3) NOT NULL,
    UpdatedAt     datetimeoffset(3) NOT NULL,
    CONSTRAINT PK_PushSubscriptions PRIMARY KEY (HouseholdRef)
);

-- Notification history (last 30 days queried; no purge job in v1).
IF OBJECT_ID(N'dbo.NotificationHistory', N'U') IS NULL
CREATE TABLE dbo.NotificationHistory
(
    Id           uniqueidentifier  NOT NULL,
    HouseholdRef nvarchar(128)     NOT NULL,
    Title        nvarchar(256)     NOT NULL,
    SentAt       datetimeoffset(3) NOT NULL,
    Channel      nvarchar(16)      NOT NULL,
    CONSTRAINT PK_NotificationHistory PRIMARY KEY (Id),
    INDEX IX_NotificationHistory_HouseholdRef_SentAt (HouseholdRef, SentAt DESC)
);
```

- [ ] **Step 2: Add empty config keys to `appsettings.json`**

Replace the `ConnectionStrings` section and add Vapid/Acs sections:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "AzureAdB2C": {
    "Instance": "",
    "Domain": "",
    "TenantId": "",
    "ClientId": "",
    "SignUpSignInPolicyId": ""
  },
  "SlotGrid": {
    "SlotKeys": ["DAY"]
  },
  "Session": {
    "IsResident": true,
    "HouseholdRef": "HH-DEV-1"
  },
  "ConnectionStrings": {
    "Reservations": "",
    "MaintenanceFees": "",
    "Expenses": "",
    "Payments": "",
    "Notifications": ""
  },
  "Vapid": {
    "Subject": "",
    "PublicKey": "",
    "PrivateKey": ""
  },
  "Acs": {
    "ConnectionString": "",
    "SenderAddress": ""
  }
}
```

Note: actual values for local development go in `appsettings.Development.local.json` (git-ignored — never committed).

- [ ] **Step 3: Commit**

```bash
git add db/schema.sql src/Harmonia.Api/appsettings.json
git commit -m "feat: add PushSubscriptions and NotificationHistory tables to schema"
```

---

## Task 11: SqlNotificationStore + integration tests

**Test-first: yes (Rel) — SaveSubscription MERGE (IsNew true/false), RemoveSubscription (Removed/NotFound), AppendHistory + GetHistory (30-day filter)**

**Files:**
- Create: `src/Harmonia.Api/Adapters/SqlNotificationStore.cs`
- Create: `tests/Harmonia.IntegrationTests/SqlNotificationStoreTests.cs`

- [ ] **Step 1: Write failing integration tests**

```csharp
// tests/Harmonia.IntegrationTests/SqlNotificationStoreTests.cs
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.IntegrationTests;

[Collection("Database")]
[Trait("Category", "Rel")]
public class SqlNotificationStoreTests(SqlServerFixture fixture)
{
    private SqlNotificationStore Store => new(fixture.ConnectionString);

    [Fact]
    public async Task Save_first_time_returns_Saved_IsNew_true()
    {
        var store = Store;
        var hh    = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");
        var sub   = MakeSub(hh);

        var result = await store.SaveSubscriptionAsync(sub);

        var saved = Assert.IsType<SaveSubscriptionResult.Saved>(result);
        Assert.True(saved.IsNew);
        Assert.Equal(hh, saved.Subscription.HouseholdRef);
    }

    [Fact]
    public async Task Save_second_time_returns_Saved_IsNew_false_and_updates_endpoint()
    {
        var store = Store;
        var hh    = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");
        await store.SaveSubscriptionAsync(MakeSub(hh, "https://push.example.com/v1"));

        var result = await store.SaveSubscriptionAsync(MakeSub(hh, "https://push.example.com/v2"));

        var saved = Assert.IsType<SaveSubscriptionResult.Saved>(result);
        Assert.False(saved.IsNew);
        Assert.Equal("https://push.example.com/v2", saved.Subscription.Endpoint);
    }

    [Fact]
    public async Task Remove_existing_returns_Removed()
    {
        var store = Store;
        var hh    = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");
        await store.SaveSubscriptionAsync(MakeSub(hh));

        var result = await store.RemoveSubscriptionAsync(hh);

        Assert.IsType<RemoveSubscriptionResult.Removed>(result);
    }

    [Fact]
    public async Task Remove_nonexistent_returns_NotFound()
    {
        var hh     = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");
        var result = await Store.RemoveSubscriptionAsync(hh);
        Assert.IsType<RemoveSubscriptionResult.NotFound>(result);
    }

    [Fact]
    public async Task GetHistory_returns_last_30_days_only()
    {
        var store = Store;
        var hh    = new HouseholdRef($"HH-NS-{Guid.NewGuid():N}");

        var recent = new NotificationRecord(Guid.NewGuid(), hh, "Recent", DateTimeOffset.UtcNow, "push");
        var old    = new NotificationRecord(Guid.NewGuid(), hh, "Old", DateTimeOffset.UtcNow.AddDays(-31), "push");

        await store.AppendHistoryAsync(recent);
        await store.AppendHistoryAsync(old);

        var records = await store.GetHistoryAsync(hh);

        Assert.Single(records);
        Assert.Equal("Recent", records[0].Title);
    }

    private static PushSubscription MakeSub(HouseholdRef hh, string endpoint = "https://push.example.com/test")
        => new(hh, endpoint, "p256key", "authkey", null, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);
}
```

- [ ] **Step 2: Run — expect compile failure (SqlNotificationStore doesn't exist)**

```
dotnet test tests/Harmonia.IntegrationTests/ --filter "FullyQualifiedName~SqlNotificationStoreTests" --no-build 2>&1 | head -10
```

- [ ] **Step 3: Implement `SqlNotificationStore`**

```csharp
// src/Harmonia.Api/Adapters/SqlNotificationStore.cs
using System.Data;
using Microsoft.Data.SqlClient;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.Api.Reservations.Adapters;

/// <summary>
/// SQL adapter for push subscriptions and notification history.
/// Subscription columns (Endpoint, P256dhKey, AuthKey, FallbackEmail) are personal data (R3) —
/// never passed to ILogger calls.
/// </summary>
public sealed class SqlNotificationStore(string connectionString) : INotificationStore
{
    public async Task<SaveSubscriptionResult> SaveSubscriptionAsync(
        PushSubscription sub, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                DECLARE @result TABLE (act nvarchar(10));
                MERGE dbo.PushSubscriptions AS t
                USING (VALUES (
                    @HouseholdRef, @Endpoint, @P256dhKey, @AuthKey, @FallbackEmail, @Now
                )) AS s (HouseholdRef, Endpoint, P256dhKey, AuthKey, FallbackEmail, UpdatedAt)
                ON t.HouseholdRef = s.HouseholdRef
                WHEN MATCHED THEN
                    UPDATE SET Endpoint      = s.Endpoint,
                               P256dhKey     = s.P256dhKey,
                               AuthKey       = s.AuthKey,
                               FallbackEmail = s.FallbackEmail,
                               UpdatedAt     = s.UpdatedAt
                WHEN NOT MATCHED THEN
                    INSERT (HouseholdRef, Endpoint, P256dhKey, AuthKey, FallbackEmail, CreatedAt, UpdatedAt)
                    VALUES (s.HouseholdRef, s.Endpoint, s.P256dhKey, s.AuthKey,
                            s.FallbackEmail, s.UpdatedAt, s.UpdatedAt)
                OUTPUT $action INTO @result;
                SELECT act FROM @result;
                """;
            cmd.Parameters.AddWithValue("@HouseholdRef", sub.HouseholdRef.Value);
            cmd.Parameters.AddWithValue("@Endpoint", sub.Endpoint);
            cmd.Parameters.AddWithValue("@P256dhKey", sub.P256dhKey);
            cmd.Parameters.AddWithValue("@AuthKey", sub.AuthKey);
            cmd.Parameters.Add(new SqlParameter("@FallbackEmail", SqlDbType.NVarChar, 320)
                { Value = (object?)sub.FallbackEmail ?? DBNull.Value });
            cmd.Parameters.Add(new SqlParameter("@Now", SqlDbType.DateTimeOffset) { Value = DateTimeOffset.UtcNow });

            var action = (string?)await cmd.ExecuteScalarAsync(ct);
            var isNew  = action == "INSERT";

            var stored = isNew ? sub with { CreatedAt = sub.UpdatedAt } : sub;
            return new SaveSubscriptionResult.Saved(stored, isNew);
        }
        catch (Exception)
        {
            return new SaveSubscriptionResult.Failed();
        }
    }

    public async Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM dbo.PushSubscriptions WHERE HouseholdRef = @HouseholdRef;";
            cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return rows > 0
                ? new RemoveSubscriptionResult.Removed()
                : new RemoveSubscriptionResult.NotFound();
        }
        catch (Exception)
        {
            return new RemoveSubscriptionResult.Failed();
        }
    }

    public async Task<PushSubscription?> GetSubscriptionAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, Endpoint, P256dhKey, AuthKey, FallbackEmail, CreatedAt, UpdatedAt " +
            "FROM dbo.PushSubscriptions WHERE HouseholdRef = @HouseholdRef;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return ReadSubscription(reader);
    }

    public async Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT HouseholdRef, Endpoint, P256dhKey, AuthKey, FallbackEmail, CreatedAt, UpdatedAt " +
            "FROM dbo.PushSubscriptions;";
        var list = new List<PushSubscription>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(ReadSubscription(reader));
        return list;
    }

    public async Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "INSERT INTO dbo.NotificationHistory (Id, HouseholdRef, Title, SentAt, Channel) " +
            "VALUES (@Id, @HouseholdRef, @Title, @SentAt, @Channel);";
        cmd.Parameters.AddWithValue("@Id", record.Id);
        cmd.Parameters.AddWithValue("@HouseholdRef", record.HouseholdRef.Value);
        cmd.Parameters.AddWithValue("@Title", record.Title);
        cmd.Parameters.Add(new SqlParameter("@SentAt", SqlDbType.DateTimeOffset) { Value = record.SentAt });
        cmd.Parameters.AddWithValue("@Channel", record.Channel);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(
        HouseholdRef householdRef, CancellationToken ct = default)
    {
        // R3: householdRef.Value is not passed to any ILogger call in this method.
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT Id, HouseholdRef, Title, SentAt, Channel " +
            "FROM dbo.NotificationHistory " +
            "WHERE HouseholdRef = @HouseholdRef " +
            "  AND SentAt >= DATEADD(day, -30, SYSUTCDATETIME()) " +
            "ORDER BY SentAt DESC;";
        cmd.Parameters.AddWithValue("@HouseholdRef", householdRef.Value);
        var list = new List<NotificationRecord>();
        await using var reader = (SqlDataReader)await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(new NotificationRecord(
                Id:           reader.GetGuid(0),
                HouseholdRef: new HouseholdRef(reader.GetString(1)),
                Title:        reader.GetString(2),
                SentAt:       reader.GetDateTimeOffset(3),
                Channel:      reader.GetString(4)));
        }
        return list;
    }

    private static PushSubscription ReadSubscription(SqlDataReader r) =>
        new(HouseholdRef:  new HouseholdRef(r.GetString(0)),
            Endpoint:      r.GetString(1),
            P256dhKey:     r.GetString(2),
            AuthKey:       r.GetString(3),
            FallbackEmail: r.IsDBNull(4) ? null : r.GetString(4),
            CreatedAt:     r.GetDateTimeOffset(5),
            UpdatedAt:     r.GetDateTimeOffset(6));
}
```

- [ ] **Step 4: Build**

```
dotnet build src/Harmonia.Api/Harmonia.Api.csproj
```

Expected: Build succeeded.

- [ ] **Step 5: Run integration tests**

```
dotnet test tests/Harmonia.IntegrationTests/ --filter "FullyQualifiedName~SqlNotificationStoreTests"
```

Expected: 5 tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/Harmonia.Api/Adapters/SqlNotificationStore.cs \
        tests/Harmonia.IntegrationTests/SqlNotificationStoreTests.cs
git commit -m "feat: add SqlNotificationStore with MERGE upsert + 30-day history query"
```

---

## Task 12: NotificationEndpoints + endpoint unit tests

**Test-first: yes — 201/200/403/500 for subscribe; 204/404/403/500 for delete; 202/403/500 for announce; 200/403/500 for history**

**Files:**
- Create: `src/Harmonia.Api/Notifications/NotificationEndpoints.cs`
- Create: `tests/Harmonia.UnitTests/Api/NotificationEndpointsTests.cs`

- [ ] **Step 1: Write failing endpoint unit tests**

```csharp
// tests/Harmonia.UnitTests/Api/NotificationEndpointsTests.cs
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Harmonia.Api.Notifications;
using Harmonia.Application;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.UnitTests.Api;

public class NotificationEndpointsTests
{
    private static readonly SessionContext ResidentCtx =
        new(IsResident: true, IsAdmin: false, HouseholdRef: new HouseholdRef("HH-EP-1"));
    private static readonly SessionContext AdminCtx =
        new(IsResident: false, IsAdmin: true, HouseholdRef: null);

    // ── POST /notifications/subscribe ──────────────────────────────────────

    [Fact]
    public async Task Subscribe_new_returns_201()
    {
        var store   = new FakeNotificationStore();
        var useCase = new SaveSubscription(new FakeSession(ResidentCtx), store);
        var body    = new SaveSubscriptionRequest("https://push.example.com/x", "k", "a");

        var result = await NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body, email: null, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status201Created, status.StatusCode);
    }

    [Fact]
    public async Task Subscribe_update_returns_200()
    {
        var store   = new FakeNotificationStore();
        var useCase = new SaveSubscription(new FakeSession(ResidentCtx), store);
        var body    = new SaveSubscriptionRequest("https://push.example.com/x", "k", "a");

        // First call — creates (IsNew=true); second call — updates (IsNew=false)
        await NotificationEndpoints.SaveSubscriptionEndpoint(useCase, body, null, NullLogger.Instance, default);
        var result = await NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body, null, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task Subscribe_non_resident_returns_403()
    {
        var useCase = new SaveSubscription(new FakeSession(null), new FakeNotificationStore());
        var body    = new SaveSubscriptionRequest("https://push.example.com/x", "k", "a");

        var result = await NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body, null, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Subscribe_store_failure_returns_500()
    {
        var useCase = new SaveSubscription(new FakeSession(ResidentCtx), new FailingNotificationStore());
        var body    = new SaveSubscriptionRequest("https://push.example.com/x", "k", "a");

        var result = await NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body, null, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }

    // ── DELETE /notifications/subscribe ────────────────────────────────────

    [Fact]
    public async Task Unsubscribe_existing_returns_204()
    {
        var store   = new FakeNotificationStore();
        var saveUC  = new SaveSubscription(new FakeSession(ResidentCtx), store);
        await saveUC.ExecuteAsync("https://push.example.com/x", "k", "a", null);
        var removeUC = new RemoveSubscription(new FakeSession(ResidentCtx), store);

        var result = await NotificationEndpoints.RemoveSubscriptionEndpoint(
            removeUC, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status204NoContent, status.StatusCode);
    }

    [Fact]
    public async Task Unsubscribe_nonexistent_returns_404()
    {
        var useCase = new RemoveSubscription(new FakeSession(ResidentCtx), new FakeNotificationStore());

        var result = await NotificationEndpoints.RemoveSubscriptionEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, status.StatusCode);
    }

    [Fact]
    public async Task Unsubscribe_non_resident_returns_403()
    {
        var useCase = new RemoveSubscription(new FakeSession(null), new FakeNotificationStore());

        var result = await NotificationEndpoints.RemoveSubscriptionEndpoint(
            useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    // ── POST /notifications/announce ───────────────────────────────────────

    [Fact]
    public async Task Announce_admin_returns_202()
    {
        var useCase = new SendAnnouncement(new FakeSession(AdminCtx), new FakeNotificationDispatcher());
        var body    = new AnnouncementRequest("Board update", "We have news.");

        var result = await NotificationEndpoints.AnnounceEndpoint(
            useCase, body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status202Accepted, status.StatusCode);
    }

    [Fact]
    public async Task Announce_non_admin_returns_403()
    {
        var useCase = new SendAnnouncement(new FakeSession(null), new FakeNotificationDispatcher());
        var body    = new AnnouncementRequest("Hello", "Body");

        var result = await NotificationEndpoints.AnnounceEndpoint(
            useCase, body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task Announce_dispatcher_failure_returns_500()
    {
        var useCase = new SendAnnouncement(new FakeSession(AdminCtx), new FailingNotificationDispatcher());
        var body    = new AnnouncementRequest("Hello", "Body");

        var result = await NotificationEndpoints.AnnounceEndpoint(
            useCase, body, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }

    // ── GET /notifications ─────────────────────────────────────────────────

    [Fact]
    public async Task GetHistory_resident_returns_200()
    {
        var store   = new FakeNotificationStore();
        var useCase = new GetNotificationHistory(new FakeSession(ResidentCtx), store);

        var result = await NotificationEndpoints.GetHistoryEndpoint(useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status200OK, status.StatusCode);
    }

    [Fact]
    public async Task GetHistory_no_session_returns_403()
    {
        var useCase = new GetNotificationHistory(new FakeSession(null), new FakeNotificationStore());

        var result = await NotificationEndpoints.GetHistoryEndpoint(useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task GetHistory_store_failure_returns_500()
    {
        var useCase = new GetNotificationHistory(
            new FakeSession(ResidentCtx), new FailingNotificationStore());

        var result = await NotificationEndpoints.GetHistoryEndpoint(useCase, NullLogger.Instance, default);

        var status = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, status.StatusCode);
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~NotificationEndpointsTests" --no-build 2>&1 | head -10
```

Expected: Build error — `NotificationEndpoints` not found.

- [ ] **Step 3: Implement `NotificationEndpoints`**

```csharp
// src/Harmonia.Api/Notifications/NotificationEndpoints.cs
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Notifications;
using Harmonia.Domain.Notifications;

namespace Harmonia.Api.Notifications;

public sealed record SaveSubscriptionRequest(string Endpoint, string P256dhKey, string AuthKey);
public sealed record AnnouncementRequest(string Title, string Body);
public sealed record SubscriptionDto(string HouseholdRef, DateTimeOffset UpdatedAt);
public sealed record NotificationRecordDto(Guid Id, string Title, DateTimeOffset SentAt, string Channel);

public static class NotificationEndpoints
{
    // email is extracted from Entra claims by the caller (Program.cs handler) — never from body (R2/R3).
    public static async Task<IResult> SaveSubscriptionEndpoint(
        SaveSubscription useCase, SaveSubscriptionRequest body,
        string? email, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(body.Endpoint, body.P256dhKey, body.AuthKey, email, ct);
        switch (result)
        {
            case SaveSubscriptionResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case SaveSubscriptionResult.Saved saved:
                return TypedResults.Json(
                    new SubscriptionDto(saved.Subscription.HouseholdRef.Value, saved.Subscription.UpdatedAt),
                    statusCode: saved.IsNew ? StatusCodes.Status201Created : StatusCodes.Status200OK);
            case SaveSubscriptionResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> RemoveSubscriptionEndpoint(
        RemoveSubscription useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        switch (result)
        {
            case RemoveSubscriptionResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case RemoveSubscriptionResult.Removed:
                return TypedResults.NoContent();
            case RemoveSubscriptionResult.NotFound:
                return TypedResults.NotFound();
            case RemoveSubscriptionResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> AnnounceEndpoint(
        SendAnnouncement useCase, AnnouncementRequest body, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(body.Title, body.Body, ct);
        switch (result)
        {
            case SendAnnouncementResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case SendAnnouncementResult.Accepted:
                return TypedResults.StatusCode(StatusCodes.Status202Accepted);
            case SendAnnouncementResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public static async Task<IResult> GetHistoryEndpoint(
        GetNotificationHistory useCase, ILogger logger, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(ct);
        switch (result)
        {
            case GetNotificationHistoryResult.Refused:
                return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
            case GetNotificationHistoryResult.Ok ok:
                var dtos = ok.Records.Select(r =>
                    new NotificationRecordDto(r.Id, r.Title, r.SentAt, r.Channel)).ToList();
                return TypedResults.Json(dtos, statusCode: StatusCodes.Status200OK);
            case GetNotificationHistoryResult.Failed:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
            default:
                return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        }
    }
}
```

- [ ] **Step 4: Run endpoint tests — expect all pass**

```
dotnet test tests/Harmonia.UnitTests/ --filter "FullyQualifiedName~NotificationEndpointsTests"
```

Expected: 13 tests passed.

- [ ] **Step 5: Run full unit test suite**

```
dotnet test tests/Harmonia.UnitTests/
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/Harmonia.Api/Notifications/NotificationEndpoints.cs \
        tests/Harmonia.UnitTests/Api/NotificationEndpointsTests.cs
git commit -m "feat: add NotificationEndpoints (POST/DELETE subscribe, POST announce, GET history)"
```

---

## Task 13: VapidPushDispatcher + BbqReminderService

**Test-first: no — VapidPushDispatcher wraps external services; BbqReminderService is tested via integration through the dispatcher. Manual/smoke testing is the verification here.**

**Files:**
- Create: `src/Harmonia.Api/Adapters/VapidPushDispatcher.cs`
- Create: `src/Harmonia.Api/Notifications/BbqReminderService.cs`
- Modify: `src/Harmonia.Api/Harmonia.Api.csproj` — add NuGet packages

- [ ] **Step 1: Add NuGet packages**

```
dotnet add src/Harmonia.Api/Harmonia.Api.csproj package WebPush
dotnet add src/Harmonia.Api/Harmonia.Api.csproj package Azure.Communication.Email
```

Verify the `.csproj` now contains:
```xml
<PackageReference Include="Azure.Communication.Email" Version="..." />
<PackageReference Include="WebPush" Version="..." />
```

- [ ] **Step 2: Implement `VapidPushDispatcher`**

```csharp
// src/Harmonia.Api/Adapters/VapidPushDispatcher.cs
using System.Net;
using System.Text.Json;
using Azure;
using Azure.Communication.Email;
using Microsoft.Extensions.Logging;
using WebPush;
using Harmonia.Application.Notifications;
using Harmonia.Domain;
using Harmonia.Domain.Notifications;

namespace Harmonia.Api.Reservations.Adapters;

public sealed record VapidConfig(string Subject, string PublicKey, string PrivateKey);
public sealed record AcsEmailConfig(string ConnectionString, string SenderAddress);

public sealed class VapidPushDispatcher(
    INotificationStore store,
    VapidConfig vapidConfig,
    AcsEmailConfig acsConfig,
    ILogger<VapidPushDispatcher> logger) : INotificationDispatcher
{
    public async Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct)
    {
        var title   = TitleFor(kind);
        var body    = BodyFor(kind);
        var sub     = await store.GetSubscriptionAsync(householdRef, ct);
        string channel;

        if (sub is not null)
        {
            channel = await TrySendPushAsync(sub, title, body, ct) ? "push" : "skipped";
            if (channel == "skipped" && sub.FallbackEmail is not null)
                channel = await TrySendEmailAsync(sub.FallbackEmail, title, body, ct) ? "email" : "skipped";
        }
        else
        {
            channel = "skipped";
        }

        await store.AppendHistoryAsync(
            new NotificationRecord(Guid.NewGuid(), householdRef, title, DateTimeOffset.UtcNow, channel), ct);
    }

    public async Task BroadcastAsync(string title, string body, CancellationToken ct)
    {
        var subs = await store.ListAllSubscriptionsAsync(ct);
        foreach (var sub in subs)
        {
            var channel = await TrySendPushAsync(sub, title, body, ct) ? "push" : "skipped";
            if (channel == "skipped" && sub.FallbackEmail is not null)
                channel = await TrySendEmailAsync(sub.FallbackEmail, title, body, ct) ? "email" : "skipped";

            await store.AppendHistoryAsync(
                new NotificationRecord(Guid.NewGuid(), sub.HouseholdRef, title, DateTimeOffset.UtcNow, channel), ct);
        }
    }

    private async Task<bool> TrySendPushAsync(
        PushSubscription sub, string title, string body, CancellationToken ct)
    {
        // Generic payload — no amounts, no HouseholdRef (R3)
        var payload = JsonSerializer.Serialize(new { title, body });
        try
        {
            var client  = new WebPushClient();
            client.SetVapidDetails(vapidConfig.Subject, vapidConfig.PublicKey, vapidConfig.PrivateKey);
            var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256dhKey, sub.AuthKey);
            await client.SendNotificationAsync(pushSub, payload, cancellationToken: ct);
            return true;
        }
        catch (WebPushException ex) when (ex.StatusCode == HttpStatusCode.Gone)
        {
            // Subscription revoked by browser — silently remove
            await store.RemoveSubscriptionAsync(sub.HouseholdRef, ct);
            return false;
        }
        catch (Exception)
        {
            logger.LogWarning("Push delivery failed (details omitted per R3)");
            return false;
        }
    }

    private async Task<bool> TrySendEmailAsync(
        string email, string title, string body, CancellationToken ct)
    {
        try
        {
            var client  = new EmailClient(acsConfig.ConnectionString);
            var message = new EmailMessage(
                senderAddress: acsConfig.SenderAddress,
                content:       new EmailContent(title) { PlainText = body },
                recipients:    new EmailRecipients([new EmailAddress(email)]));
            // WaitUntil.Started = fire-and-forget: we don't wait for delivery receipt (R3)
            await client.SendAsync(WaitUntil.Started, message, ct);
            return true;
        }
        catch (Exception)
        {
            logger.LogWarning("Email delivery failed (details omitted per R3)");
            return false;
        }
    }

    private static string TitleFor(NotificationKind kind) => kind switch
    {
        NotificationKind.ChargePosted    => "New maintenance fee charge",
        NotificationKind.PaymentRecorded => "Payment recorded",
        NotificationKind.BbqReminder     => "BBQ booking reminder",
        NotificationKind.Announcement    => "Announcement from the board",
        _                                => "Harmonia notification"
    };

    private static string BodyFor(NotificationKind kind) => kind switch
    {
        NotificationKind.ChargePosted    => "A new maintenance fee charge has been posted to your apartment.",
        NotificationKind.PaymentRecorded => "A payment has been recorded for your apartment.",
        NotificationKind.BbqReminder     => "Reminder: you have a BBQ booking tomorrow.",
        NotificationKind.Announcement    => "The board has a message for you. Log in to Harmonia to view it.",
        _                                => "You have a new notification."
    };
}
```

- [ ] **Step 3: Implement `BbqReminderService`**

```csharp
// src/Harmonia.Api/Notifications/BbqReminderService.cs
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Harmonia.Application.Notifications;
using Harmonia.Application.Reservations;

namespace Harmonia.Api.Notifications;

public sealed class BbqReminderService(
    INotificationDispatcher dispatcher,
    IReservationStore reservationStore,
    ILogger<BbqReminderService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now  = DateTimeOffset.UtcNow;
            var next = now.Date.AddDays(1).AddHours(7); // 07:00 UTC next day
            if (next <= now.UtcDateTime) next = next.AddDays(1);
            await Task.Delay(next - now.UtcDateTime, stoppingToken);
            if (stoppingToken.IsCancellationRequested) break;
            await SendTomorrowRemindersAsync(stoppingToken);
        }
    }

    private async Task SendTomorrowRemindersAsync(CancellationToken ct)
    {
        try
        {
            var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
            var holders  = await reservationStore.GetDayBookingHoldersAsync(tomorrow, ct);
            foreach (var householdRef in holders)
                await dispatcher.DispatchAsync(NotificationKind.BbqReminder, householdRef, ct);
        }
        catch (Exception)
        {
            logger.LogWarning("BBQ reminder run failed");
        }
    }
}
```

- [ ] **Step 4: Build**

```
dotnet build src/Harmonia.Api/Harmonia.Api.csproj
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/Harmonia.Api/Adapters/VapidPushDispatcher.cs \
        src/Harmonia.Api/Notifications/BbqReminderService.cs \
        src/Harmonia.Api/Harmonia.Api.csproj
git commit -m "feat: add VapidPushDispatcher + BbqReminderService"
```

---

## Task 14: Program.cs wiring + config validation

**Test-first: no — wiring is verified by running the app. Config validation crashes early on missing keys.**

**Files:**
- Modify: `src/Harmonia.Api/Program.cs`

- [ ] **Step 1: Add notification wiring to `Program.cs`**

Add the following new usings at the top of `Program.cs`:

```csharp
using Harmonia.Api.Notifications;
using Harmonia.Application.Notifications;
```

Also add (already should be there but add if missing):

```csharp
using Harmonia.Api.Reservations.Adapters;
```

After the existing `payConnString` guard block (around line 62), add:

```csharp
// ── Notifications ─────────────────────────────────────────────────────────
var notifConnString = builder.Configuration.GetConnectionString("Notifications");
if (string.IsNullOrWhiteSpace(notifConnString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Notifications is not configured. Supply it via environment " +
        "(ConnectionStrings__Notifications) or a git-ignored local config file.");
}
builder.Services.AddSingleton<INotificationStore>(new SqlNotificationStore(notifConnString));

var vapidSubject = builder.Configuration["Vapid:Subject"];
var vapidPublic  = builder.Configuration["Vapid:PublicKey"];
var vapidPrivate = builder.Configuration["Vapid:PrivateKey"];
if (string.IsNullOrWhiteSpace(vapidSubject) || string.IsNullOrWhiteSpace(vapidPublic) || string.IsNullOrWhiteSpace(vapidPrivate))
{
    throw new InvalidOperationException(
        "Vapid:Subject, Vapid:PublicKey, and Vapid:PrivateKey must all be configured. " +
        "Generate VAPID keys (e.g. npx web-push generate-vapid-keys) and add to git-ignored local config.");
}
var vapidConfig = new VapidConfig(vapidSubject, vapidPublic, vapidPrivate);

var acsConnStr = builder.Configuration["Acs:ConnectionString"];
var acsSender  = builder.Configuration["Acs:SenderAddress"];
if (string.IsNullOrWhiteSpace(acsConnStr) || string.IsNullOrWhiteSpace(acsSender))
{
    throw new InvalidOperationException(
        "Acs:ConnectionString and Acs:SenderAddress must be configured. " +
        "Set them in a git-ignored local config file or as environment variables.");
}
var acsConfig = new AcsEmailConfig(acsConnStr, acsSender);

builder.Services.AddSingleton<INotificationDispatcher>(sp =>
    new VapidPushDispatcher(
        sp.GetRequiredService<INotificationStore>(),
        vapidConfig,
        acsConfig,
        sp.GetRequiredService<ILogger<VapidPushDispatcher>>()));
builder.Services.AddHostedService<BbqReminderService>();
```

Add use-case registrations after the existing `builder.Services.AddScoped<GetBalance>()` line:

```csharp
builder.Services.AddScoped<SaveSubscription>();
builder.Services.AddScoped<RemoveSubscription>();
builder.Services.AddScoped<SendAnnouncement>();
builder.Services.AddScoped<GetNotificationHistory>();
```

Add route mappings after the existing `app.MapGet("/balance", ...)` block:

```csharp
app.MapPost("/notifications/subscribe",
    (SaveSubscription useCase, SaveSubscriptionRequest body,
     HttpContext httpContext, ILoggerFactory loggers, CancellationToken ct) =>
        NotificationEndpoints.SaveSubscriptionEndpoint(
            useCase, body,
            httpContext.User?.FindFirst("email")?.Value,  // Entra claim, never from body (R2)
            loggers.CreateLogger("Notifications"), ct));

app.MapDelete("/notifications/subscribe",
    (RemoveSubscription useCase, ILoggerFactory loggers, CancellationToken ct) =>
        NotificationEndpoints.RemoveSubscriptionEndpoint(
            useCase, loggers.CreateLogger("Notifications"), ct));

app.MapPost("/notifications/announce",
    (SendAnnouncement useCase, AnnouncementRequest body,
     ILoggerFactory loggers, CancellationToken ct) =>
        NotificationEndpoints.AnnounceEndpoint(
            useCase, body, loggers.CreateLogger("Notifications"), ct));

app.MapGet("/notifications",
    (GetNotificationHistory useCase, ILoggerFactory loggers, CancellationToken ct) =>
        NotificationEndpoints.GetHistoryEndpoint(
            useCase, loggers.CreateLogger("Notifications"), ct));
```

- [ ] **Step 2: Build the full solution**

```
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Run all unit tests**

```
dotnet test tests/Harmonia.UnitTests/
```

Expected: all pass.

- [ ] **Step 4: Run all integration tests (requires `HARMONIA_SQL_CONNSTR`)**

```
dotnet test tests/Harmonia.IntegrationTests/
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/Harmonia.Api/Program.cs
git commit -m "feat: wire notification endpoints, dispatcher, and BbqReminderService into Program.cs"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| POST /notifications/subscribe → 201/200/403/500 | Tasks 4, 12 |
| DELETE /notifications/subscribe → 204/404/403/500 | Tasks 5, 12 |
| POST /notifications/announce → 202/403/500 | Tasks 6, 12 |
| GET /notifications → 200/403/500 (last 30 days) | Tasks 7, 12 |
| Charge trigger → notify affected apartment | Task 8 |
| Payment trigger → notify affected apartment | Task 8 |
| BBQ reminder daily BackgroundService | Tasks 9, 13 |
| VAPID Web Push delivery | Task 13 |
| ACS email fallback | Task 13 |
| PushSubscriptions SQL table | Task 10, 11 |
| NotificationHistory SQL table | Task 10, 11 |
| R2: HouseholdRef from session only | Tasks 4, 5, 7 |
| R3: No HouseholdRef in logs | Tasks 11, 13 |
| ACS fire-and-forget (WaitUntil.Started) | Task 13 |
| FallbackEmail from Entra at subscribe time | Tasks 4, 14 |
| VAPID + ACS keys in config only, never committed | Tasks 10, 14 |
| FakeNotificationStore + Dispatcher in Fakes.cs | Task 3 |
| Rel integration tests for SqlNotificationStore | Task 11 |

All requirements covered. ✓

**Placeholder scan:** No "TBD", "TODO", "implement later" found. ✓

**Type consistency:** `PushSubscription`, `NotificationRecord`, `SaveSubscriptionResult.Saved(PushSubscription, bool)`, `FakeNotificationDispatcher.DispatchCalls` used consistently across all tasks. ✓
