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

    /// <summary>
    /// Returns all pending-activation rows, ordered by FirstSeenAt ascending.
    /// R3: the returned records contain personal data (OID, email, displayName) — never log them.
    /// </summary>
    Task<IReadOnlyList<PendingSignIn>> ListAsync(CancellationToken ct = default);

    /// <summary>
    /// Atomically inserts into dbo.HouseholdLinks and deletes from dbo.PendingSignIns
    /// in a single SQL transaction. Returns the outcome discriminant.
    /// R3: oid and householdRef are personal data — never log their values.
    /// </summary>
    Task<ActivateResult> ActivateAsync(string oid, string householdRef, string role, CancellationToken ct = default);

    /// <summary>Deletes rows where FirstSeenAt is older than <paramref name="olderThan"/>. Returns row count.</summary>
    Task<int> PurgeExpiredAsync(DateTimeOffset olderThan, CancellationToken ct = default);

    /// <summary>
    /// Directly links an OID to a household without requiring a pending row (admin self-link).
    /// R3: oid and householdRef are personal data — never log their values.
    /// </summary>
    Task<DirectLinkResult> DirectLinkAsync(string oid, string householdRef, string role, CancellationToken ct = default);
}

public enum ActivateResult { Ok, NotFound, AlreadyActivated }
public enum DirectLinkResult { Ok, AlreadyLinked }

/// <summary>Household link resolved from an Entra OID.</summary>
public sealed record HouseholdLink(string HouseholdRef, string Role);

/// <summary>
/// Looks up the HouseholdRef and Role for an activated member by their Entra OID.
/// Returns null when no linked row exists (caller is pending).
/// R3: oid is personal data — never log its value.
/// </summary>
public interface IHouseholdByOidLookup
{
    Task<HouseholdLink?> FindAsync(string oid, CancellationToken ct = default);
}
