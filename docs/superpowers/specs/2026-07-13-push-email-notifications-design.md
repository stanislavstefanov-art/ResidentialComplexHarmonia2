# Push + Email Notifications — Design Spec

**Date:** 2026-07-13  
**Branch:** feat/push-email-notifications  
**Status:** approved (autonomous spec.approved gate)

---

## Overview

Adds in-browser Web Push (VAPID) and Azure Communication Services (ACS) email delivery for
maintenance fee charge events, payment events, and BBQ booking reminders. Residents manage
their own push subscription. Admins send broadcast announcements. An `INotificationDispatcher`
Application-layer port decouples use cases from delivery details.

---

## Architecture

Three-layer — same as all existing features.

```
Harmonia.Domain/Notifications/
  PushSubscription.cs         ← subscription value object
  NotificationRecord.cs       ← history record

Harmonia.Application/Notifications/
  Ports.cs                    ← INotificationStore, INotificationDispatcher, result unions
  SaveSubscription.cs         ← use case
  RemoveSubscription.cs       ← use case
  SendAnnouncement.cs         ← use case (admin)
  GetNotificationHistory.cs   ← use case (resident + admin)

Harmonia.Api/Notifications/
  NotificationEndpoints.cs    ← 4 endpoints
  BbqReminderService.cs       ← BackgroundService (daily timer)

Harmonia.Api/Adapters/
  SqlNotificationStore.cs     ← INotificationStore SQL impl
  VapidPushDispatcher.cs      ← INotificationDispatcher (VAPID push + ACS email fallback)
```

**Modified files:**
- `Harmonia.Application/MaintenanceFees/RecordCharge.cs` — add `INotificationDispatcher` ctor param; call `DispatchAsync` after charge stored
- `Harmonia.Application/Payments/RecordPayment.cs` — same, call after payment stored
- `Harmonia.Api/Program.cs` — wire notification store, dispatcher, background service, config guards
- `db/schema.sql` — two new tables
- `src/Harmonia.Api/appsettings.json` — Vapid + ACS keys (empty placeholders)

---

## Domain types

### `PushSubscription`

```csharp
namespace Harmonia.Domain.Notifications;

public sealed record PushSubscription(
    HouseholdRef   HouseholdRef,
    string         Endpoint,
    string         P256dhKey,
    string         AuthKey,
    string?        FallbackEmail,   // derived from Entra claims at subscribe time; null if unavailable
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
```

`FallbackEmail` is stored alongside the subscription so the dispatcher can fall back to ACS
when no push is active. It is deleted with the subscription row (`DELETE /notifications/subscribe`).
This satisfies "never stored separately" — the email lives only while the subscription exists.

### `NotificationRecord`

```csharp
namespace Harmonia.Domain.Notifications;

public sealed record NotificationRecord(
    Guid           Id,
    HouseholdRef   HouseholdRef,
    string         Title,
    DateTimeOffset SentAt,
    string         Channel);   // "push" | "email" | "skipped"
```

`Channel = "skipped"` when the household has no push subscription and no stored email.

---

## Application ports (`Harmonia.Application/Notifications/Ports.cs`)

```csharp
namespace Harmonia.Application.Notifications;

// ── Subscription results ──────────────────────────────────────────────────
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

// ── Announcement result ───────────────────────────────────────────────────
public abstract record SendAnnouncementResult
{
    private SendAnnouncementResult() { }
    public sealed record Refused           : SendAnnouncementResult;
    public sealed record Accepted          : SendAnnouncementResult;   // 202; fire-and-forget
    public sealed record Failed            : SendAnnouncementResult;
}

// ── History result ────────────────────────────────────────────────────────
public abstract record GetNotificationHistoryResult
{
    private GetNotificationHistoryResult() { }
    public sealed record Refused                                              : GetNotificationHistoryResult;
    public sealed record Ok(IReadOnlyList<NotificationRecord> Records)       : GetNotificationHistoryResult;
    public sealed record Failed                                               : GetNotificationHistoryResult;
}

// ── Store port ────────────────────────────────────────────────────────────
public interface INotificationStore
{
    // subscriptions
    Task<SaveSubscriptionResult> SaveSubscriptionAsync(PushSubscription sub, CancellationToken ct = default);
    Task<RemoveSubscriptionResult> RemoveSubscriptionAsync(HouseholdRef householdRef, CancellationToken ct = default);
    Task<PushSubscription?> GetSubscriptionAsync(HouseholdRef householdRef, CancellationToken ct = default);
    Task<IReadOnlyList<PushSubscription>> ListAllSubscriptionsAsync(CancellationToken ct = default);

    // history
    Task AppendHistoryAsync(NotificationRecord record, CancellationToken ct = default);
    Task<IReadOnlyList<NotificationRecord>> GetHistoryAsync(HouseholdRef householdRef, CancellationToken ct = default);
}

// ── Dispatcher port ───────────────────────────────────────────────────────
public enum NotificationKind { ChargePosted, PaymentRecorded, BbqReminder, Announcement }

public interface INotificationDispatcher
{
    // Single-household dispatch (charge/payment triggers, BBQ reminder per household)
    Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct = default);

    // Broadcast to all households with subscriptions (announce)
    Task BroadcastAsync(string title, string body, CancellationToken ct = default);
}
```

---

## Use cases

### `SaveSubscription`

```csharp
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

        var sub = new PushSubscription(
            HouseholdRef: ctx.HouseholdRef.Value,
            Endpoint:     endpoint,
            P256dhKey:    p256dhKey,
            AuthKey:      authKey,
            FallbackEmail: email,
            CreatedAt:    DateTimeOffset.UtcNow,
            UpdatedAt:    DateTimeOffset.UtcNow);

        return await store.SaveSubscriptionAsync(sub, ct);
    }
}
```

`email` is supplied by the endpoint from the Entra session claims (not from the request body — see endpoint below).

### `RemoveSubscription`

```csharp
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

### `SendAnnouncement`

```csharp
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
            // Awaited synchronously — v1 resident count is small enough that fan-out completes quickly.
            // If scale grows, replace with a background queue and return Accepted before completion.
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

### `GetNotificationHistory`

```csharp
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

---

## Notification trigger integration

`RecordCharge` gains an `INotificationDispatcher` constructor parameter:

```csharp
public sealed class RecordCharge(ISession session, IMaintenanceFeeStore store, INotificationDispatcher dispatcher)
{
    public async Task<RecordChargeResult> ExecuteAsync(..., CancellationToken ct = default)
    {
        // ... existing guard + store call ...
        var result = await store.RecordChargeAsync(charge, ct);
        if (result is RecordChargeResult.Created created)
            _ = dispatcher.DispatchAsync(NotificationKind.ChargePosted, created.Charge.HouseholdRef, ct);
        return result;
    }
}
```

`RecordPayment` gains the same:

```csharp
if (result is RecordPaymentResult.Created created)
    _ = dispatcher.DispatchAsync(NotificationKind.PaymentRecorded, created.Payment.HouseholdRef, ct);
```

`Duplicate` results do **not** re-dispatch (idempotent re-submission should not re-notify).

---

## API endpoints

### `POST /notifications/subscribe` — 201 / 200 / 403 / 500

Request body:
```csharp
public sealed record SaveSubscriptionRequest(
    string Endpoint,
    string P256dhKey,
    string AuthKey);
```

The endpoint extracts the resident's email from Entra claims (if available) and passes it to the use case — **not** from the request body (R2/R3):

```csharp
public static async Task<IResult> SaveSubscriptionEndpoint(
    SaveSubscription useCase, SaveSubscriptionRequest body,
    IHttpContextAccessor httpContextAccessor, ILogger logger, CancellationToken ct)
{
    // email derived from Entra at send time — never from body
    var email = httpContextAccessor.HttpContext?.User?.FindFirstValue("email");
    var result = await useCase.ExecuteAsync(body.Endpoint, body.P256dhKey, body.AuthKey, email, ct);
    switch (result)
    {
        case SaveSubscriptionResult.Refused: return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
        case SaveSubscriptionResult.Saved saved:
            return TypedResults.Json(new SubscriptionDto(saved.Subscription.HouseholdRef.Value, saved.Subscription.UpdatedAt),
                statusCode: saved.IsNew
                    ? StatusCodes.Status201Created
                    : StatusCodes.Status200OK);
        case SaveSubscriptionResult.Failed: return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
        default: return TypedResults.StatusCode(StatusCodes.Status500InternalServerError);
    }
}
```

The endpoint uses `saved.IsNew` to select 201 vs 200 status code.

### `DELETE /notifications/subscribe` — 204 / 404 / 403 / 500

```csharp
case RemoveSubscriptionResult.Refused: return TypedResults.StatusCode(403);
case RemoveSubscriptionResult.Removed: return TypedResults.NoContent();
case RemoveSubscriptionResult.NotFound: return TypedResults.NotFound();
case RemoveSubscriptionResult.Failed: return TypedResults.StatusCode(500);
```

### `POST /notifications/announce` — 202 / 403 / 500

Request body: `record AnnouncementRequest(string Title, string Body)`.  
Response 202: no body.

### `GET /notifications` — 200 / 403 / 500

Response: `IReadOnlyList<NotificationRecordDto>` where:
```csharp
public sealed record NotificationRecordDto(
    Guid   Id,
    string Title,
    DateTimeOffset SentAt,
    string Channel);
```

HouseholdRef is **not** in the DTO (it is the authenticated resident's own household — no need to echo it back).

---

## SQL Schema additions

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
    FallbackEmail nvarchar(320)     NULL,     -- from Entra at subscribe time; null if unavailable
    CreatedAt     datetimeoffset(3) NOT NULL,
    UpdatedAt     datetimeoffset(3) NOT NULL,
    CONSTRAINT PK_PushSubscriptions PRIMARY KEY (HouseholdRef)
);

-- Notification history (last 30 days queried; no purge job in v1 — SQL index covers recency).
IF OBJECT_ID(N'dbo.NotificationHistory', N'U') IS NULL
CREATE TABLE dbo.NotificationHistory
(
    Id           uniqueidentifier  NOT NULL,
    HouseholdRef nvarchar(128)     NOT NULL,
    Title        nvarchar(256)     NOT NULL,
    SentAt       datetimeoffset(3) NOT NULL,
    Channel      nvarchar(16)      NOT NULL,  -- 'push' | 'email' | 'skipped'
    CONSTRAINT PK_NotificationHistory PRIMARY KEY (Id),
    INDEX IX_NotificationHistory_HouseholdRef_SentAt (HouseholdRef, SentAt DESC)
);
```

---

## Infrastructure adapters

### `SqlNotificationStore`

- `SaveSubscriptionAsync`: `MERGE dbo.PushSubscriptions USING (...) WHEN MATCHED THEN UPDATE ... WHEN NOT MATCHED THEN INSERT ...`. Returns `Saved(sub, IsNew: <bool from merge output>)`.
- `RemoveSubscriptionAsync`: `DELETE WHERE HouseholdRef = @hh`. Returns `Removed` or `NotFound` (check `@@ROWCOUNT`).
- `GetSubscriptionAsync`: `SELECT ... WHERE HouseholdRef = @hh`.
- `ListAllSubscriptionsAsync`: `SELECT * FROM dbo.PushSubscriptions`.
- `AppendHistoryAsync`: `INSERT INTO dbo.NotificationHistory ...`.
- `GetHistoryAsync`: `SELECT ... WHERE HouseholdRef = @hh AND SentAt >= DATEADD(day, -30, SYSUTCDATETIME()) ORDER BY SentAt DESC`.

Note: `GetHistoryAsync` does NOT pass HouseholdRef to ILogger (R3).  
Namespace: `Harmonia.Api.Reservations.Adapters` (matches all other store adapters).

### `VapidPushDispatcher`

NuGet: `WebPush` (MIT, lightweight VAPID implementation).

```csharp
public sealed class VapidPushDispatcher(
    INotificationStore store,
    VapidConfig config,
    AcsEmailConfig acsConfig,
    ILogger<VapidPushDispatcher> logger) : INotificationDispatcher
{
    public async Task DispatchAsync(NotificationKind kind, HouseholdRef householdRef, CancellationToken ct)
    {
        var title = TitleFor(kind);
        var body  = BodyFor(kind);
        var sub   = await store.GetSubscriptionAsync(householdRef, ct);
        string channel;

        if (sub is not null)
        {
            channel = await TrySendPushAsync(sub, title, body, ct) ? "push" : "skipped";
            if (channel == "skipped" && sub.FallbackEmail is not null)
                channel = await TrySendEmailAsync(sub.FallbackEmail, title, body, ct) ? "email" : "skipped";
        }
        else
        {
            channel = "skipped";  // no subscription, no stored email
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

    private async Task<bool> TrySendPushAsync(PushSubscription sub, string title, string body, CancellationToken ct)
    {
        // Generic payload — no amounts, no HouseholdRef
        var payload = JsonSerializer.Serialize(new { title, body });
        try
        {
            var webPushClient = new WebPushClient();
            webPushClient.SetVapidDetails(config.Subject, config.PublicKey, config.PrivateKey);
            var pushSub = new PushSubscription(sub.Endpoint, sub.P256dhKey, sub.AuthKey);
            await webPushClient.SendNotificationAsync(pushSub, payload, ct);
            return true;
        }
        catch (WebPushException ex) when (ex.StatusCode == HttpStatusCode.Gone)
        {
            // Browser revoked subscription — remove it silently
            await store.RemoveSubscriptionAsync(sub.HouseholdRef, ct);
            return false;
        }
        catch (Exception)
        {
            logger.LogWarning("Push delivery failed (details omitted, R3)");
            return false;
        }
    }

    private async Task<bool> TrySendEmailAsync(string email, string title, string body, CancellationToken ct)
    {
        try
        {
            var client = new EmailClient(acsConfig.ConnectionString);
            var message = new EmailMessage(
                senderAddress: acsConfig.SenderAddress,
                content: new EmailContent(title) { PlainText = body },
                recipients: new EmailRecipients([new EmailAddress(email)]));
            await client.SendAsync(WaitUntil.Started, message, ct);
            return true;
        }
        catch (Exception)
        {
            logger.LogWarning("Email delivery failed (details omitted, R3)");
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

Configuration types (not committed — env vars only):

```csharp
public sealed record VapidConfig(string Subject, string PublicKey, string PrivateKey);
public sealed record AcsEmailConfig(string ConnectionString, string SenderAddress);
```

### `IReservationStore` addition

The BBQ reminder needs to query tomorrow's booking holders. Add one method to the existing
`Harmonia.Application.Ports.IReservationStore` interface:

```csharp
// Returns one HouseholdRef per distinct household with a booking on the given day.
Task<IReadOnlyList<HouseholdRef>> GetDayBookingHoldersAsync(DateOnly day, CancellationToken ct = default);
```

Implement in `SqlReservationStore`:

```sql
SELECT DISTINCT HouseholdRef
FROM   dbo.Reservations
WHERE  DayDate = @day
```

### `BbqReminderService`

```csharp
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
            var next = now.Date.AddDays(1).AddHours(7);  // 07:00 UTC next day
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

---

## Program.cs additions

```csharp
// VAPID config
var vapidSubject   = builder.Configuration["Vapid:Subject"]    ?? throw new InvalidOperationException("Vapid:Subject not configured");
var vapidPublicKey = builder.Configuration["Vapid:PublicKey"]  ?? throw new InvalidOperationException("Vapid:PublicKey not configured");
var vapidPrivKey   = builder.Configuration["Vapid:PrivateKey"] ?? throw new InvalidOperationException("Vapid:PrivateKey not configured");
var vapidConfig    = new VapidConfig(vapidSubject, vapidPublicKey, vapidPrivKey);

// ACS email config
var acsConnStr    = builder.Configuration["Acs:ConnectionString"] ?? throw new InvalidOperationException("Acs:ConnectionString not configured");
var acsSender     = builder.Configuration["Acs:SenderAddress"]    ?? throw new InvalidOperationException("Acs:SenderAddress not configured");
var acsConfig     = new AcsEmailConfig(acsConnStr, acsSender);

// Notification connection string
var notifConnString = builder.Configuration.GetConnectionString("Notifications")
    ?? throw new InvalidOperationException("ConnectionStrings:Notifications not configured ...");

builder.Services.AddSingleton<INotificationStore>(new SqlNotificationStore(notifConnString));
builder.Services.AddSingleton<INotificationDispatcher>(sp =>
    new VapidPushDispatcher(
        sp.GetRequiredService<INotificationStore>(),
        vapidConfig, acsConfig,
        sp.GetRequiredService<ILogger<VapidPushDispatcher>>()));
builder.Services.AddHostedService<BbqReminderService>();

builder.Services.AddScoped<SaveSubscription>();
builder.Services.AddScoped<RemoveSubscription>();
builder.Services.AddScoped<SendAnnouncement>();
builder.Services.AddScoped<GetNotificationHistory>();

// Route mappings
app.MapPost("/notifications/subscribe",    NotificationEndpoints.SaveSubscriptionEndpoint);
app.MapDelete("/notifications/subscribe",  NotificationEndpoints.RemoveSubscriptionEndpoint);
app.MapPost("/notifications/announce",     NotificationEndpoints.AnnounceEndpoint);
app.MapGet("/notifications",               NotificationEndpoints.GetHistoryEndpoint);
```

`RecordCharge` and `RecordPayment` now take `INotificationDispatcher` — resolved from DI as `AddScoped` (INotificationDispatcher is singleton but scoped use cases can depend on singleton services).

---

## Configuration keys (never committed)

```json
// appsettings.json placeholders (empty):
{
  "ConnectionStrings": { "Notifications": "" },
  "Vapid": { "Subject": "", "PublicKey": "", "PrivateKey": "" },
  "Acs":   { "ConnectionString": "", "SenderAddress": "" }
}
```

---

## Testing

### Unit tests (fake stores, `tests/Harmonia.UnitTests`)

New fakes: `FakeNotificationStore`, `FakeNotificationDispatcher` (records calls, never throws), `FailingNotificationStore`, `FailingNotificationDispatcher`.

| Use case | Tests |
|----------|-------|
| `SaveSubscription` | resident → Saved; non-resident → Refused; null HouseholdRef → Refused; store failure → Failed |
| `RemoveSubscription` | resident → Removed; resident not-found → NotFound; non-resident → Refused |
| `SendAnnouncement` | admin → Accepted; non-admin → Refused |
| `GetNotificationHistory` | resident with HouseholdRef → Ok; admin no HouseholdRef → Refused; no session → Refused; store failure → Failed |
| `RecordCharge` (modified) | success → dispatcher called; duplicate → dispatcher NOT called; store failure → dispatcher NOT called |
| `RecordPayment` (modified) | same as RecordCharge |
| `NotificationEndpoints` | 201 create / 200 update / 403 / 500 for subscribe; 204/404/403/500 for delete; 202/403/500 for announce; 200/403/500 for history |

### Rel integration tests (`tests/Harmonia.IntegrationTests`, `[Trait("Category","Rel")]`)

| Test | Verifies |
|------|---------|
| `SqlNotificationStore_Save_creates_then_updates` | MERGE upsert: first call → IsNew=true; second call → IsNew=false, UpdatedAt advances |
| `SqlNotificationStore_Remove_returns_NotFound` | DELETE on non-existent HouseholdRef → NotFound |
| `SqlNotificationStore_History_last30days` | AppendHistoryAsync + GetHistoryAsync; old row (31 days) excluded |

No VAPID / ACS integration tests (external services; mock in unit tests).

---

## GDPR / R3 compliance checklist

| Constraint | Where enforced |
|-----------|---------------|
| Subscription endpoint never in log output | `VapidPushDispatcher.TrySendPushAsync` logs only generic warning |
| Notification body: no amounts, no HouseholdRef | `BodyFor()` and `TitleFor()` — fixed generic strings |
| Email derived from Entra claims, never stored as standalone row | Stored in `PushSubscription.FallbackEmail`; deleted with subscription |
| HouseholdRef never in log output | All logging in dispatcher uses generic messages; no HouseholdRef in `ILogger` calls |
| ACS fire-and-forget: no email log, no contact list | `SendAsync(WaitUntil.Started)` — does not wait for receipt; no ACS API to retrieve sent history |

---

## Open decisions (v1 scope)

- **No subscription purge job**: history rows older than 30 days remain in DB; the query window is the only TTL in v1. Add a purge job if storage becomes a concern.
- **BBQ reminder fires once per day at 07:00 UTC**: no per-household time-zone adjustment in v1.
- **No retry on push/email failure**: dispatcher records `channel=skipped` and moves on. Reliability guarantees are operator-level (retry via announce).
- **Announce fan-out is synchronous in the dispatcher** (loops over all subscriptions). Acceptable for small resident counts; switch to background queue if fan-out grows.
- **Email fallback only for households with an active subscription** (FallbackEmail stored therein). Households that never subscribed cannot receive email in v1.
