using Harmonia.Api.Expenses;
using Harmonia.Api.FinancialSummary;
using Harmonia.Api.Payments;
using Harmonia.Application.Payments;
using Harmonia.Api.Identity;
using Harmonia.Api.MaintenanceFees;
using Harmonia.Api.Reservations;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application;
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

app.Run();
