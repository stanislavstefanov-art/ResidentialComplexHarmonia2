using Harmonia.Api.Reservations;
using Harmonia.Api.Reservations.Adapters;
using Harmonia.Application.Reservations;
using ISession = Harmonia.Application.Reservations.ISession;

var builder = WebApplication.CreateBuilder(args);

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
// Fail safe, never open (SEC-CHK-17): the dev identity stand-in must not exist
// outside Development — a real ISession adapter closes gap-log #1 first.
if (!builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException(
        "DevSession is a dev-only identity stand-in (context/cold/gap-log.md); " +
        "refusing to start outside Development until a real ISession adapter exists.");
}

builder.Services.AddSingleton<ISession>(new DevSession(
    builder.Configuration.GetValue("Session:IsResident", true),
    builder.Configuration.GetValue("Session:HouseholdRef", "HH-DEV-1")!));
builder.Services.AddScoped<GetDayAvailability>();
builder.Services.AddScoped<ReserveSlot>();

var app = builder.Build();

app.MapGet(
    "/days/{day}/slots",
    (GetDayAvailability useCase, DateOnly day, ILoggerFactory loggers, CancellationToken ct)
        => ReservationEndpoints.GetDaySlots(useCase, day, loggers.CreateLogger("Reservations"), ct));

app.MapPost(
    "/days/{day}/slots/{slotKey}/claim",
    (ReserveSlot useCase, DateOnly day, string slotKey, ILoggerFactory loggers, CancellationToken ct)
        => ReservationEndpoints.ClaimSlot(useCase, day, slotKey, loggers.CreateLogger("Reservations"), ct));

app.Run();
