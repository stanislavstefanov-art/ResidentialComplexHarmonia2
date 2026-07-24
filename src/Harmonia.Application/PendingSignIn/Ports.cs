namespace Harmonia.Application.PendingSignIn;

/// <summary>
/// Upserts a pending-activation row for an authenticated but unlinked caller.
/// R3: oid, email, displayName are personal data — never log their values.
/// </summary>
public interface IPendingSignInStore
{
    /// <summary>
    /// Inserts a row if the OID is new; does nothing if it already exists.
    /// FirstSeenAt is set on first INSERT and never updated on repeat calls.
    /// </summary>
    Task UpsertAsync(string oid, string email, string displayName, CancellationToken ct = default);

    /// <summary>Returns all pending-activation rows, ordered by FirstSeenAt ascending.</summary>
    Task<IReadOnlyList<PendingSignIn>> ListAsync(CancellationToken ct = default);

    /// <summary>
    /// Atomically inserts into dbo.HouseholdLinks and deletes from dbo.PendingSignIns
    /// in a single SQL transaction. Returns the outcome discriminant.
    /// R3: oid and householdRef are personal data — never log their values.
    /// </summary>
    Task<ActivateResult> ActivateAsync(string oid, string householdRef, CancellationToken ct = default);

    /// <summary>Deletes rows where FirstSeenAt is older than <paramref name="olderThan"/>. Returns row count.</summary>
    Task<int> PurgeExpiredAsync(DateTime olderThan, CancellationToken ct = default);
}

public enum ActivateResult { Ok, NotFound, AlreadyActivated }

/// <summary>
/// Looks up the HouseholdRef for an activated member by their Entra OID.
/// Returns null when no linked row exists (caller is pending).
/// R3: oid is personal data — never log its value.
/// </summary>
public interface IHouseholdByOidLookup
{
    Task<string?> FindHouseholdRefAsync(string oid, CancellationToken ct = default);
}
