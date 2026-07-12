using Harmonia.Domain;
using Harmonia.Domain.MaintenanceFees;

namespace Harmonia.Application.MaintenanceFees;

/// <summary>Outcome of recording a maintenance fee charge.</summary>
public abstract record RecordChargeResult
{
    private RecordChargeResult() { }

    /// <summary>Caller is not an admin — no charge is recorded.</summary>
    public sealed record Refused : RecordChargeResult;

    /// <summary>Charge recorded for the first time; use 201 Created.</summary>
    public sealed record Created(MaintenanceFeeCharge Charge) : RecordChargeResult;

    /// <summary>Duplicate submission with same IdempotencyKey; use 200 OK.</summary>
    public sealed record Duplicate(MaintenanceFeeCharge Charge) : RecordChargeResult;

    /// <summary>Unexpected store error; use 500 Internal Server Error.</summary>
    public sealed record Failed : RecordChargeResult;
}

/// <summary>Outcome of listing charges for a household.</summary>
public abstract record ListChargesResult
{
    private ListChargesResult() { }

    /// <summary>Caller lacks permission to read this household's charges.</summary>
    public sealed record Refused : ListChargesResult;

    public sealed record Ok(IReadOnlyList<MaintenanceFeeCharge> Charges) : ListChargesResult;

    /// <summary>Unexpected store error; use 500 Internal Server Error.</summary>
    public sealed record Failed : ListChargesResult;
}

/// <summary>Outcome of listing all charges across every household (admin-only).</summary>
public abstract record ListAllChargesResult
{
    private ListAllChargesResult() { }

    /// <summary>Caller is not an admin.</summary>
    public sealed record Refused : ListAllChargesResult;

    public sealed record Ok(IReadOnlyList<MaintenanceFeeCharge> Charges) : ListAllChargesResult;

    /// <summary>Unexpected store error; use 500 Internal Server Error.</summary>
    public sealed record Failed : ListAllChargesResult;
}

/// <summary>Append-only ledger store port. No update or delete methods by design.</summary>
public interface IMaintenanceFeeStore
{
    /// <summary>
    /// Records a charge. Returns the existing charge if IdempotencyKey already exists
    /// for this household; otherwise persists and returns the new charge.
    /// </summary>
    Task<RecordChargeResult> RecordChargeAsync(
        MaintenanceFeeCharge charge, CancellationToken ct = default);

    /// <summary>Returns all charges for the given household, ordered by ChargedAt descending (newest first).</summary>
    Task<IReadOnlyList<MaintenanceFeeCharge>> ListChargesAsync(
        HouseholdRef householdRef, CancellationToken ct = default);

    /// <summary>Returns all charges across every household, ordered by HouseholdRef ASC then ChargedAt DESC.</summary>
    Task<IReadOnlyList<MaintenanceFeeCharge>> ListAllChargesAsync(CancellationToken ct = default);
}
