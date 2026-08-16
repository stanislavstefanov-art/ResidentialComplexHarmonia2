using Microsoft.Extensions.DependencyInjection;
using Harmonia.Api.Adapters;
using Harmonia.Api.Admin;
using Harmonia.Api.Households;
using Harmonia.Application.Households;
using Harmonia.Api.Counterparties;
using Harmonia.Application.Counterparties;
using Harmonia.Api.Directory;
using Harmonia.Api.Expenses;
using Harmonia.Api.Financial;
using Harmonia.Api.FinancialSummary;
using Harmonia.Api.Me;
using Harmonia.Api.Notifications;
using Harmonia.Api.Payments;
using Harmonia.Application.Notifications;
using Harmonia.Application.Payments;
using Harmonia.Application.PendingSignIn;
using Harmonia.Api.Identity;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Api.Reservations;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application;
using Harmonia.Application.Directory;
using Harmonia.Application.Expenses;
using Harmonia.Application.Financial;
using Harmonia.Application.FinancialSummary;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Reservations;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Identity.Web;
using ISession = Harmonia.Application.ISession;

var builder = WebApplication.CreateBuilder(args);

// Load git-ignored local overrides (connection strings for local dev; never committed).
builder.Configuration.AddJsonFile("appsettings.Development.local.json", optional: true);

// The store connection comes from config/env only — never committed (CLAUDE.md).
var defaultConn = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException(
        "ConnectionStrings:Default is not configured. Supply it via environment " +
        "(ConnectionStrings__Default) or a git-ignored local config file.");

builder.Services.AddSingleton<IReservationStore>(new SqlReservationStore(defaultConn));
builder.Services.AddSingleton<ISlotGrid>(new ConfigSlotGrid(
    builder.Configuration.GetSection("SlotGrid:SlotKeys").Get<string[]>() ?? ["DAY"]));
builder.Services.AddSingleton<IMaintenanceFeeStore>(new SqlMaintenanceFeeStore(defaultConn));
builder.Services.AddSingleton<IExpenseStore>(new SqlExpenseStore(defaultConn));
builder.Services.AddSingleton<IIncomeStore>(new SqlIncomeStore(defaultConn));
builder.Services.AddSingleton<IPaymentStore>(new SqlPaymentStore(defaultConn));
builder.Services.AddSingleton<INotificationStore>(new SqlNotificationStore(defaultConn));
builder.Services.AddSingleton<IDirectoryStore>(new SqlDirectoryStore(defaultConn));
builder.Services.AddSingleton<IHouseholdStore>(new SqlHouseholdStore(defaultConn));
builder.Services.AddSingleton<ICounterpartyStore>(new SqlCounterpartyStore(defaultConn));
builder.Services.AddSingleton<IPendingSignInStore>(new SqlPendingSignInStore(defaultConn));
builder.Services.AddSingleton<IHouseholdByOidLookup>(new SqlHouseholdByOidLookup(defaultConn));

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
var acsAvailable = !string.IsNullOrWhiteSpace(acsConnStr) && !string.IsNullOrWhiteSpace(acsSender);

if (!acsAvailable && !builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException(
        "Acs:ConnectionString and Acs:SenderAddress must be configured " +
        "(env vars: Acs__ConnectionString, Acs__SenderAddress). " +
        "Set them in a git-ignored local config file or as environment variables.");
}

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));

if (acsAvailable)
{
    var acsConfig = new AcsEmailConfig(acsConnStr!, acsSender!);
    builder.Services.AddSingleton<INotificationDispatcher>(sp =>
        new VapidPushDispatcher(
            sp.GetRequiredService<INotificationStore>(),
            vapidConfig,
            acsConfig,
            sp.GetRequiredService<ILogger<VapidPushDispatcher>>()));
}
else
{
    // Development only — logs instead of sending real push/email notifications.
    builder.Services.AddSingleton<INotificationDispatcher, NoOpNotificationDispatcher>();
}
builder.Services.AddHostedService<BbqReminderService>();

if (builder.Environment.IsDevelopment())
{
    switch (builder.Configuration.GetValue("Session:Mode", "Dev"))
    {
        case "DevAdmin":
            builder.Services.AddSingleton<ISession>(new DevAdminSession(builder.Environment));
            break;
        case "DevPending":
            builder.Services.AddSingleton<ISession>(new DevPendingSession(builder.Environment));
            break;
        case "Entra":
            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
            builder.Services.AddAuthorization(options =>
                options.FallbackPolicy = new AuthorizationPolicyBuilder()
                    .RequireAuthenticatedUser()
                    .Build());
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddScoped<ISession, EntraSession>();
            break;
        default: // "Dev" — resident with config-driven household ref
            builder.Services.AddSingleton<ISession>(new DevSession(
                builder.Configuration.GetValue("Session:IsResident", true),
                builder.Configuration.GetValue("Session:HouseholdRef", "АП. 1")!));
            break;
    }
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
    builder.Services.AddAuthorization(options =>
        options.FallbackPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build());
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ISession, EntraSession>();
}

builder.Services.AddScoped<GetCallerStatus>();
builder.Services.AddScoped<GetDayAvailability>();
builder.Services.AddScoped<ReserveSlot>();
builder.Services.AddScoped<RecordCharge>();
builder.Services.AddScoped<ListCharges>();
builder.Services.AddScoped<ListAllCharges>();
builder.Services.AddScoped<RecordExpense>();
builder.Services.AddScoped<ListExpenses>();
builder.Services.AddScoped<RecordIncome>();
builder.Services.AddScoped<GetAnnualReport>();

// Invoice scanner (Azure Document Intelligence — F0 free tier, 500 pages/month)
var diEndpoint = builder.Configuration["DocumentIntelligence:Endpoint"];
var diKey      = builder.Configuration["DocumentIntelligence:Key"];
if (!string.IsNullOrWhiteSpace(diEndpoint) && !string.IsNullOrWhiteSpace(diKey))
    builder.Services.AddSingleton<IInvoiceScanner>(new AzureInvoiceScanner(diEndpoint, diKey));
// If not configured, the scan endpoint returns 503 (IInvoiceScanner? resolves to null)

builder.Services.AddAntiforgery();
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
builder.Services.AddScoped<GetMyContact>();
builder.Services.AddScoped<UpdateMyContact>();
builder.Services.AddScoped<UpdateContact>();
builder.Services.AddScoped<UpdateNotes>();
builder.Services.AddScoped<EraseMyContact>();
builder.Services.AddScoped<EraseContact>();
builder.Services.AddScoped<MarkDeparted>();
builder.Services.AddScoped<RemoveResident>();
builder.Services.AddScoped<PurgeExpiredContacts>();
builder.Services.AddScoped<LinkMyHousehold>();
builder.Services.AddScoped<ListPendingSignIns>();
builder.Services.AddScoped<ActivatePendingSignIn>();
builder.Services.AddScoped<PurgeExpiredPendingSignIns>();
builder.Services.AddScoped<GetHouseholds>();
builder.Services.AddScoped<UpsertHousehold>();
builder.Services.AddScoped<DeleteHousehold>();
builder.Services.AddScoped<ListCounterparties>();
builder.Services.AddScoped<CreateCounterparty>();
builder.Services.AddScoped<GetCounterparty>();
builder.Services.AddScoped<UpdateCounterparty>();
builder.Services.AddScoped<DeleteCounterparty>();

var app = builder.Build();

// CORS must precede auth so OPTIONS preflight requests are not blocked by the auth middleware.
app.UseCors();

if (!app.Environment.IsDevelopment())
{
    app.UseAuthentication();
    app.UseAuthorization();
}

// Pending caller gate: authenticated-but-unlinked callers may only reach GET /me.
app.Use(async (context, next) =>
{
    var session = context.RequestServices.GetRequiredService<ISession>();
    if (session.Resolve()?.IsPending == true && context.Request.Path.Value != "/me")
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }
    await next(context);
});

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

// VAPID public key is safe to expose — browsers need it to create push subscriptions.
app.MapGet("/notifications/vapid-public-key",
    () => Results.Ok(new { publicKey = vapidPublic }))
    .AllowAnonymous();

app.MapGet(
    "/directory/contact",
    (GetMyContact uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.GetMyContactEndpoint(
            uc, loggers.CreateLogger("Directory"), ct));

app.MapPost(
    "/directory/me/link",
    (LinkMyHousehold uc, LinkMyHouseholdRequest body, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.LinkMyHouseholdEndpoint(
            uc, body, loggers.CreateLogger("Directory"), ct));

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

// householdRef is a query parameter (not a path segment): multi-apartment refs
// legitimately contain '/', which ASP.NET Core leaves undecoded (%2F) in a path
// segment and never matches the stored value. Query values decode correctly.
app.MapPut(
    "/directory/board/contact",
    (UpdateContact uc, string householdRef, UpdateContactRequest body,
     ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.UpdateContactEndpoint(
            uc, householdRef, body, loggers.CreateLogger("Directory"), ct));

app.MapPut(
    "/directory/board/notes",
    (UpdateNotes uc, string householdRef, UpdateNotesRequest body,
     ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.UpdateNotesEndpoint(
            uc, householdRef, body, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/contact",
    (EraseMyContact uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseMyContactEndpoint(
            uc, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/board/contact",
    (EraseContact uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.EraseContactEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/board/departed",
    (MarkDeparted uc, string householdRef, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.MarkDepartedEndpoint(
            uc, householdRef, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/board/resident",
    (RemoveResident uc, string householdRef, string role, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.RemoveResidentEndpoint(
            uc, householdRef, role, loggers.CreateLogger("Directory"), ct));

app.MapDelete(
    "/directory/purge-expired",
    (PurgeExpiredContacts uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, loggers.CreateLogger("Directory"), ct));

app.MapGet(
    "/admin/pending",
    (ListPendingSignIns useCase, ILoggerFactory loggers, CancellationToken ct)
        => AdminPendingEndpoints.ListPendingEndpoint(
            useCase, loggers.CreateLogger("AdminPending"), ct));

app.MapPost(
    "/admin/pending/{oid}/activate",
    (ActivatePendingSignIn useCase, string oid, ActivateRequest body,
     ILoggerFactory loggers, CancellationToken ct)
        => AdminPendingEndpoints.ActivatePendingEndpoint(
            useCase, oid, body, loggers.CreateLogger("AdminPending"), ct));

app.MapDelete(
    "/admin/pending/purge-expired",
    (PurgeExpiredPendingSignIns useCase, ILoggerFactory loggers, CancellationToken ct)
        => AdminPendingEndpoints.PurgeExpiredPendingEndpoint(
            useCase, loggers.CreateLogger("AdminPending"), ct));

app.MapPost(
    "/financial/income",
    (RecordIncome useCase, RecordIncomeRequest body, ILoggerFactory loggers, CancellationToken ct)
        => IncomeEndpoints.RecordIncomeEndpoint(
            useCase, body, loggers.CreateLogger("Financial"), ct));

app.MapGet(
    "/financial/annual-report",
    (GetAnnualReport useCase, int year, string? format, ILoggerFactory loggers, CancellationToken ct)
        => AnnualReportEndpoints.GetAnnualReportEndpoint(
            useCase, year, format, loggers.CreateLogger("Financial"), ct));

app.MapPost(
    "/financial/invoices/scan",
    async (ISession session, IFormFile file,
           ILoggerFactory loggers, HttpContext ctx, CancellationToken ct) =>
    {
        var scanner = ctx.RequestServices.GetService<IInvoiceScanner>();
        if (scanner is null)
            return Results.Problem("Invoice scanning is not configured.", statusCode: 503);
        return await InvoiceScanEndpoints.ScanEndpoint(
            session, scanner, file, loggers.CreateLogger("Financial"), ct);
    }).DisableAntiforgery();

app.MapGet(
    "/me",
    (GetCallerStatus useCase, ILoggerFactory loggers, CancellationToken ct)
        => MeEndpoints.GetMe(useCase, loggers.CreateLogger("Me"), ct));

app.MapGet(
    "/households",
    (GetHouseholds uc, CancellationToken ct) =>
        HouseholdsEndpoints.GetHouseholdsEndpoint(uc, ct));

// householdRef as query param — refs can contain '/' which ASP.NET Core leaves undecoded in path segments.
app.MapPut(
    "/households/item",
    (UpsertHousehold uc, string householdRef, UpsertHouseholdRequest body, CancellationToken ct) =>
        HouseholdsEndpoints.UpsertHouseholdEndpoint(uc, householdRef, body, ct));

app.MapDelete(
    "/households/item",
    (DeleteHousehold uc, string householdRef, CancellationToken ct) =>
        HouseholdsEndpoints.DeleteHouseholdEndpoint(uc, householdRef, ct));

app.MapGet(
    "/counterparties",
    (ListCounterparties uc, CancellationToken ct) =>
        CounterpartyEndpoints.ListCounterpartiesEndpoint(uc, ct));

app.MapPost(
    "/counterparties",
    (CreateCounterparty uc, CounterpartyRequest body, CancellationToken ct) =>
        CounterpartyEndpoints.CreateCounterpartyEndpoint(uc, body, ct));

app.MapGet(
    "/counterparties/{id:guid}",
    (GetCounterparty uc, Guid id, CancellationToken ct) =>
        CounterpartyEndpoints.GetCounterpartyEndpoint(uc, id, ct));

app.MapPut(
    "/counterparties/{id:guid}",
    (UpdateCounterparty uc, Guid id, CounterpartyRequest body, CancellationToken ct) =>
        CounterpartyEndpoints.UpdateCounterpartyEndpoint(uc, id, body, ct));

app.MapDelete(
    "/counterparties/{id:guid}",
    (DeleteCounterparty uc, Guid id, CancellationToken ct) =>
        CounterpartyEndpoints.DeleteCounterpartyEndpoint(uc, id, ct));

app.MapGet("/healthz", () => Results.Ok()).AllowAnonymous();

app.Run();

// Required so WebApplicationFactory<Program> in test projects can reference this type.
public partial class Program { }
