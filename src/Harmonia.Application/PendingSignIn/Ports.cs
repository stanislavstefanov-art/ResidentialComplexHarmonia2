namespace Harmonia.Application.PendingSignIn;

/// <summary>
/// Upserts a pending-activation row for an authenticated but unlinked caller.
/// R3: oid, email, displayName are personal data — never log their values.
/// Slice 2 extends this port with ListAsync and ActivateAsync.
/// </summary>
public interface IPendingSignInStore
{
    /// <summary>
    /// Inserts a row if the OID is new; does nothing if it already exists.
    /// FirstSeenAt is set on first INSERT and never updated on repeat calls.
    /// </summary>
    Task UpsertAsync(string oid, string email, string displayName, CancellationToken ct = default);
}

/// <summary>
/// Looks up the HouseholdRef for an activated member by their Entra OID.
/// Returns null when no linked row exists (caller is pending).
/// R3: oid is personal data — never log its value.
/// </summary>
public interface IHouseholdByOidLookup
{
    Task<string?> FindHouseholdRefAsync(string oid, CancellationToken ct = default);
}
