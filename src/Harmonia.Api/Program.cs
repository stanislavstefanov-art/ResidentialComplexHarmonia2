using Harmonia.Api.MaintenanceFees;
using Harmonia.Api.Reservations;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application;
using Harmonia.Application.MaintenanceFees;
using Harmonia.Application.Reservations;
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
// Fail safe, never open (SEC-CHK-17): the dev identity stand-in must not exist
// outside Development — a real ISession adapter closes gap-log #1 first.
if (!builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException(
        "DevSession is a dev-only identity stand-in (context/cold/gap-log.md); " +
        "refusing to start outside Development until a real ISession adapter exists.");
}

if (builder.Configuration.GetValue("Session:IsAdmin", false))
{
    builder.Services.AddSingleton<ISession>(
        new DevAdminSession(builder.Environment));
}
else
{
    builder.Services.AddSingleton<ISession>(new DevSession(
        builder.Configuration.GetValue("Session:IsResident", true),
        builder.Configuration.GetValue("Session:HouseholdRef", "HH-DEV-1")!));
}
builder.Services.AddScoped<GetDayAvailability>();
builder.Services.AddScoped<ReserveSlot>();
builder.Services.AddScoped<RecordCharge>();
builder.Services.AddScoped<ListCharges>();

var app = builder.Build();

app.MapGet(
    "/days/{day}/slots",
    (GetDayAvailability useCase, DateOnly day, ILoggerFactory loggers, CancellationToken ct)
        => ReservationEndpoints.GetDaySlots(useCase, day, loggers.CreateLogger("Reservations"), ct));

app.MapPost(
    "/days/{day}/slots/{slotKey}/claim",
    (ReserveSlot useCase, DateOnly day, string slotKey, ILoggerFactory loggers, CancellationToken ct)
        => ReservationEndpoints.ClaimSlot(useCase, day, slotKey, loggers.CreateLogger("Reservations"), ct));

app.MapPost(
    "/admin/charges/{householdRef}",
    (RecordCharge useCase, string householdRef, RecordChargeRequest body,
     ILoggerFactory loggers, CancellationToken ct)
        => MaintenanceFeeEndpoints.RecordChargeEndpoint(
            useCase, householdRef, body, loggers.CreateLogger("MaintenanceFees"), ct));

app.MapGet(
    "/households/{householdRef}/charges",
    (ListCharges useCase, string householdRef, ILoggerFactory loggers, CancellationToken ct)
        => MaintenanceFeeEndpoints.ListChargesEndpoint(
            useCase, householdRef, loggers.CreateLogger("MaintenanceFees"), ct));

app.Run();
