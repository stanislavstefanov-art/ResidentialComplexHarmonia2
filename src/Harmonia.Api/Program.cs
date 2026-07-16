using Harmonia.Api.Directory;
using Harmonia.Api.Expenses;
using Harmonia.Api.FinancialSummary;
using Harmonia.Api.Notifications;
using Harmonia.Api.Payments;
using Harmonia.Application.Notifications;
using Harmonia.Application.Payments;
using Harmonia.Api.Identity;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Api.Reservations;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Application.Expenses;
using Harmonia.Application.FinancialSummary;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Reservations;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;
using ISession = Harmonia.Application.ISession;

var builder = WebApplication.CreateBuilder(args);

// Load git-ignored local overrides (connection strings for local dev; never committed).
builder.Configuration.AddJsonFile("appsettings.Development.local.json", optional: true);

// The store connection comes from config/env only — never committed (CLAUDE.md).
var connectionString = builder.Configuration.GetConnectionString("Reservations");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Reservations is not configured. Supply it via environment " +
        "(ConnectionStrings__Reservations) or a git-ignored local config file.");
}

builder.Services.AddSingleton<IReservationStore>(new SqlReservationStore(connectionString));
builder.Services.AddSingleton<ISlotGrid>(new ConfigSlotGrid(
    builder.Configuration.GetSection("SlotGrid:SlotKeys").Get<string[]>() ?? ["DAY"]));

var feeConnString = builder.Configuration.GetConnectionString("MaintenanceFees");
if (string.IsNullOrWhiteSpace(feeConnString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:MaintenanceFees is not configured. Supply it via environment " +
        "(ConnectionStrings__MaintenanceFees) or a git-ignored local config file.");
}
builder.Services.AddSingleton<IMaintenanceFeeStore>(new SqlMaintenanceFeeStore(feeConnString));

var expConnString = builder.Configuration.GetConnectionString("Expenses");
if (string.IsNullOrWhiteSpace(expConnString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Expenses is not configured. Supply it via environment " +
        "(ConnectionStrings__Expenses) or a git-ignored local config file.");
}
builder.Services.AddSingleton<IExpenseStore>(new SqlExpenseStore(expConnString));

var payConnString = builder.Configuration.GetConnectionString("Payments");
if (string.IsNullOrWhiteSpace(payConnString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Payments is not configured. Supply it via environment " +
        "(ConnectionStrings__Payments) or a git-ignored local config file.");
}
builder.Services.AddSingleton<IPaymentStore>(new SqlPaymentStore(payConnString));

// ── Notifications ─────────────────────────────────────────────────────────
var notifConnString = builder.Configuration.GetConnectionString("Notifications");
if (string.IsNullOrWhiteSpace(notifConnString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Notifications is not configured. Supply it via environment " +
        "(ConnectionStrings__Notifications) or a git-ignored local config file.");
}
builder.Services.AddSingleton<INotificationStore>(new SqlNotificationStore(notifConnString));

var dirConnString = builder.Configuration.GetConnectionString("Directory");
if (string.IsNullOrWhiteSpace(dirConnString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Directory is not configured. Supply it via environment " +
        "(ConnectionStrings__Directory) or a git-ignored local config file.");
}
builder.Services.AddSingleton<IDirectoryStore>(new SqlDirectoryStore(dirConnString));

var vapidSubject = builder.Configuration["Vapid:Subject"];
var vapidPublic  = builder.Configuration["Vapid:PublicKey"];
var vapidPrivate = builder.Configuration["Vapid:PrivateKey"];
if (string.IsNullOrWhiteSpace(vapidSubject) || string.IsNullOrWhiteSpace(vapidPublic) || string.IsNullOrWhiteSpace(vapidPrivate))
{
    throw new InvalidOperationException(
        "Vapid:Subject, Vapid:PublicKey, and Vapid:PrivateKey must all be configured " +
        "(env vars: Vapid__Subject, Vapid__PublicKey, Vapid__PrivateKey). " +
        "Generate VAPID keys (e.g. npx web-push generate-vapid-keys) and add to git-ignored local config.");
}
var vapidConfig = new VapidConfig(vapidSubject, vapidPublic, vapidPrivate);

var acsConnStr = builder.Configuration["Acs:ConnectionString"];
var acsSender  = builder.Configuration["Acs:SenderAddress"];
if (string.IsNullOrWhiteSpace(acsConnStr) || string.IsNullOrWhiteSpace(acsSender))
{
    throw new InvalidOperationException(
        "Acs:ConnectionString and Acs:SenderAddress must be configured " +
        "(env vars: Acs__ConnectionString, Acs__SenderAddress). " +
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

if (builder.Environment.IsDevelopment())
{
    // Dev stubs unchanged — config-driven household ref and admin flag.
    if (builder.Configuration.GetValue("Session:IsAdmin", false))
        builder.Services.AddSingleton<ISession>(new DevAdminSession(builder.Environment));
    else
        builder.Services.AddSingleton<ISession>(new DevSession(
            builder.Configuration.GetValue("Session:IsResident", true),
            builder.Configuration.GetValue("Session:HouseholdRef", "HH-DEV-1")!));
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAdB2C"));
    builder.Services.AddAuthorization();
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ISession, EntraSession>();
}

builder.Services.AddScoped<GetDayAvailability>();
builder.Services.AddScoped<ReserveSlot>();
builder.Services.AddScoped<RecordCharge>();
builder.Services.AddScoped<ListCharges>();
builder.Services.AddScoped<ListAllCharges>();
builder.Services.AddScoped<RecordExpense>();
builder.Services.AddScoped<ListExpenses>();
builder.Services.AddScoped<GetFinancialSummary>();
builder.Services.AddScoped<RecordPayment>();
builder.Services.AddScoped<ListAllPayments>();
builder.Services.AddScoped<ListMyPayments>();
builder.Services.AddScoped<GetBalance>();
builder.Services.AddScoped<SaveSubscription>();
builder.Services.AddScoped<RemoveSubscription>();
builder.Services.AddScoped<SendAnnouncement>();
builder.Services.AddScoped<GetNotificationHistory>();
builder.Services.AddScoped<GetDirectory>();
builder.Services.AddScoped<UpdateMyContact>();
builder.Services.AddScoped<UpdateContact>();
builder.Services.AddScoped<UpdateNotes>();
builder.Services.AddScoped<EraseMyContact>();
builder.Services.AddScoped<EraseContact>();
builder.Services.AddScoped<MarkDeparted>();
builder.Services.AddScoped<PurgeExpiredContacts>();

var app = builder.Build();

// MUST precede all app.MapGet / app.MapPost calls — middleware pipeline is order-sensitive.
if (!app.Environment.IsDevelopment())
{
    app.UseAuthentication();
    app.UseAuthorization();
}

app.MapGet(
    "/days/{day}/slots",
    (GetDayAvailability useCase, DateOnly day, ILoggerFactory loggers, CancellationToken ct)
        => ReservationEndpoints.GetDaySlots(useCase, day, loggers.CreateLogger("Reservations"), ct));

app.MapPost(
    "/days/{day}/slots/{slotKey}/claim",
    (ReserveSlot useCase, DateOnly day, string slotKey, ILoggerFactory loggers, CancellationToken ct)
        => ReservationEndpoints.ClaimSlot(useCase, day, slotKey, loggers.CreateLogger("Reservations"), ct));

app.MapPost(
    "/maintenance-fees/charges/{householdRef}",
    (RecordCharge useCase, string householdRef, RecordChargeRequest body,
     ILoggerFactory loggers, CancellationToken ct)
        => MaintenanceFeeEndpoints.RecordChargeEndpoint(
            useCase, householdRef, body, loggers.CreateLogger("MaintenanceFees"), ct));

app.MapGet(
    "/maintenance-fees/charges",
    (ListCharges useCase, ILoggerFactory loggers, CancellationToken ct)
        => MaintenanceFeeEndpoints.ListChargesEndpoint(
            useCase, loggers.CreateLogger("MaintenanceFees"), ct));

app.MapGet(
    "/maintenance-fees/charges/all",
    (ListAllCharges useCase, ILoggerFactory loggers, CancellationToken ct)
        => MaintenanceFeeEndpoints.ListAllChargesEndpoint(
            useCase, loggers.CreateLogger("MaintenanceFees"), ct));

app.MapPost(
    "/expenses",
    (RecordExpense useCase, RecordExpenseRequest body, ILoggerFactory loggers, CancellationToken ct)
        => ExpenseEndpoints.RecordExpenseEndpoint(
            useCase, body, loggers.CreateLogger("Expenses"), ct));

app.MapGet(
    "/expenses",
    (ListExpenses useCase, ILoggerFactory loggers, CancellationToken ct)
        => ExpenseEndpoints.ListExpensesEndpoint(
            useCase, loggers.CreateLogger("Expenses"), ct));

app.MapGet(
    "/financial-summary",
    (GetFinancialSummary useCase, string period, ILoggerFactory loggers, CancellationToken ct)
        => FinancialSummaryEndpoints.GetSummaryEndpoint(
            useCase, period, loggers.CreateLogger("FinancialSummary"), ct));

app.MapPost(
    "/payments",
    (RecordPayment useCase, RecordPaymentRequest body, ILoggerFactory loggers, CancellationToken ct)
        => PaymentEndpoints.RecordPaymentEndpoint(
            useCase, body, loggers.CreateLogger("Payments"), ct));

app.MapGet(
    "/payments/all",
    (ListAllPayments useCase, ILoggerFactory loggers, CancellationToken ct)
        => PaymentEndpoints.ListAllPaymentsEndpoint(
            useCase, loggers.CreateLogger("Payments"), ct));

app.MapGet(
    "/payments",
    (ListMyPayments useCase, ILoggerFactory loggers, CancellationToken ct)
        => PaymentEndpoints.ListMyPaymentsEndpoint(
            useCase, loggers.CreateLogger("Payments"), ct));

app.MapGet(
    "/balance",
    (GetBalance useCase, string? period, ILoggerFactory loggers, CancellationToken ct)
        => PaymentEndpoints.GetBalanceEndpoint(
            useCase, period, loggers.CreateLogger("Payments"), ct));

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

app.MapGet(
    "/directory",
    (GetDirectory uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.GetDirectoryEndpoint(
            uc, loggers.CreateLogger("Directory"), ct));

app.MapPut(
    "/directory/contact",
    (UpdateMyContact uc, UpdateContactRequest body, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.UpdateMyContactEndpoint(
            uc, body, loggers.CreateLogger("Directory"), ct));

app.MapPut(
    "/directory/{householdRef}/contact",
    (UpdateContact uc, string householdRef, UpdateContactRequest body,
     ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.UpdateContactEndpoint(
            uc, householdRef, body, loggers.CreateLogger("Directory"), ct));

app.MapPut(
    "/directory/{householdRef}/notes",
    (UpdateNotes uc, string householdRef, UpdateNotesRequest body,
     ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.UpdateNotesEndpoint(
            uc, householdRef, body, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/contact",
    (EraseMyContact uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseMyContactEndpoint(
            uc, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapDelete(
    "/directory/{householdRef}/contact",
    (EraseContact uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseContactEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapDelete(
    "/directory/{householdRef}/departed",
    (MarkDeparted uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.MarkDepartedEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapDelete(
    "/directory/purge-expired",
    (PurgeExpiredContacts uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.Run();
