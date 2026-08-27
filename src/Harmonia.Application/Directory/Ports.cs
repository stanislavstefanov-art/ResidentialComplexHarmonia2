using Harmonia.Domain;
using Harmonia.Domain.Directory;

namespace Harmonia.Application.Directory;

/// <summary>Outcome of fetching the current resident's own contact record.</summary>
public abstract record GetMyContactResult
{
    private GetMyContactResult() { }
    /// <summary>No valid resident session.</summary>
    public sealed record Refused  : GetMyContactResult;
    /// <summary>Row found — contact details returned.</summary>
    public sealed record Ok(HouseholdContact Contact) : GetMyContactResult;
    /// <summary>No contact row exists yet for this household.</summary>
    public sealed record NotFound : GetMyContactResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed   : GetMyContactResult;
}

/// <summary>Role-differentiated outcome of <see cref="GetDirectory"/>.</summary>
public abstract record GetDirectoryResult
{
    private GetDirectoryResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused                                               : GetDirectoryResult;
    /// <summary>Resident view — name and apartment only, no PII.</summary>
    public sealed record ResidentView(IReadOnlyList<HouseholdContact> Entries) : GetDirectoryResult;
    /// <summary>Board view — full contact details including phone, email, and notes.</summary>
    public sealed record BoardView(IReadOnlyList<HouseholdContact> Entries)    : GetDirectoryResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed                                                : GetDirectoryResult;
}

/// <summary>Outcome of updating a household's contact fields.</summary>
public abstract record UpdateContactResult
{
    private UpdateContactResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused   : UpdateContactResult;
    public sealed record Ok        : UpdateContactResult;
    /// <summary>More than one resident matches this (HouseholdRef, Role) pair — the caller must
    /// disambiguate by a specific resident, which this API surface doesn't yet support (admin-UI
    /// resident picker is a follow-up slice). Refuse rather than guess or fan out.</summary>
    public sealed record Ambiguous : UpdateContactResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed    : UpdateContactResult;
}

/// <summary>Outcome of updating a household's operational notes.</summary>
public abstract record UpdateNotesResult
{
    private UpdateNotesResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused : UpdateNotesResult;
    public sealed record Ok      : UpdateNotesResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed  : UpdateNotesResult;
}

/// <summary>Outcome of a contact-erasure request (GDPR Art. 17).</summary>
public abstract record EraseContactResult
{
    private EraseContactResult() { }
    /// <summary>No valid session or insufficient role.</summary>
    public sealed record Refused   : EraseContactResult;
    /// <summary>Row deleted successfully.</summary>
    public sealed record Ok        : EraseContactResult;
    /// <summary>No matching resident exists for the given lookup key (HouseholdRef+Role, or OID).</summary>
    public sealed record NotFound  : EraseContactResult;
    /// <summary>More than one resident matches this (HouseholdRef, Role) pair. Refuse rather than
    /// guess or delete more than one resident's data.</summary>
    public sealed record Ambiguous : EraseContactResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed    : EraseContactResult;
}

/// <summary>Outcome of marking a household as departed (GDPR Art. 6(1)(f) retention clock start).</summary>
public abstract record MarkDepartedResult
{
    private MarkDepartedResult() { }
    /// <summary>Caller lacks the required role or session.</summary>
    public sealed record Refused   : MarkDepartedResult;
    /// <summary>DepartedAt set (or already set — idempotent).</summary>
    public sealed record Ok        : MarkDepartedResult;
    /// <summary>No row with that HouseholdRef exists.</summary>
    public sealed record NotFound  : MarkDepartedResult;
    /// <summary>More than one resident matches this (HouseholdRef, Role) pair. Refuse rather than
    /// guess or mark more than one resident departed.</summary>
    public sealed record Ambiguous : MarkDepartedResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed    : MarkDepartedResult;
}

/// <summary>Outcome of an admin self-linking to a household.</summary>
public abstract record LinkMyHouseholdResult
{
    private LinkMyHouseholdResult() { }
    public sealed record Refused       : LinkMyHouseholdResult;
    public sealed record Ok            : LinkMyHouseholdResult;
    public sealed record AlreadyLinked : LinkMyHouseholdResult;
    public sealed record Failed        : LinkMyHouseholdResult;
}

/// <summary>Outcome of the annual retention purge sweep.</summary>
public abstract record PurgeExpiredContactsResult
{
    private PurgeExpiredContactsResult() { }
    /// <summary>Caller lacks the required role or session.</summary>
    public sealed record Refused            : PurgeExpiredContactsResult;
    /// <summary>Sweep completed; <see cref="Deleted"/> rows were hard-deleted.</summary>
    public sealed record Ok(int Deleted)    : PurgeExpiredContactsResult;
    /// <summary>Store error; details are in the server log.</summary>
    public sealed record Failed             : PurgeExpiredContactsResult;
}

/// <summary>Outcome of removing a resident (deletes HouseholdContacts + HouseholdLinks).</summary>
public abstract record RemoveResidentResult
{
    private RemoveResidentResult() { }
    public sealed record Refused   : RemoveResidentResult;
    public sealed record Ok        : RemoveResidentResult;
    public sealed record NotFound  : RemoveResidentResult;
    /// <summary>More than one resident matches this (HouseholdRef, Role) pair. Refuse rather than
    /// guess or deactivate more than one account.</summary>
    public sealed record Ambiguous : RemoveResidentResult;
    public sealed record Failed    : RemoveResidentResult;
}

/// <summary>
/// Directory store port — SQL adapter lives in <c>Harmonia.Api.Reservations.Adapters</c>.
/// R3: <paramref name="phone"/>, <paramref name="email"/>, and any <c>entraObjectId</c>/OID
/// parameter must never appear in log output; implementations must log only exception types
/// and opaque identifiers.
/// </summary>
public interface IDirectoryStore
{
    Task<IReadOnlyList<HouseholdContact>> ListAllAsync(CancellationToken ct = default);

    /// <summary>Returns the contact record for one person by their Entra OID, or
    /// <see langword="null"/> if no row exists (e.g. they've never filled their details in, or
    /// erased them). R3: never log <paramref name="entraObjectId"/>.</summary>
    Task<HouseholdContact?> GetContactByOidAsync(string entraObjectId, CancellationToken ct = default);

    /// <summary>
    /// Upserts display name, phone, email, and opt-out flag for the person identified by
    /// <paramref name="entraObjectId"/>. On first call for that person (no existing row —
    /// including the "erased their contact, now refilling it" case), the new row's
    /// HouseholdRef/Role are resolved from their <c>HouseholdLinks</c> entry. Passing
    /// <see langword="null"/> for any field preserves the existing stored value.
    /// R3: never log <paramref name="entraObjectId"/>, <paramref name="phone"/>, or
    /// <paramref name="email"/>.
    /// </summary>
    Task<UpdateContactResult> UpsertContactByOidAsync(
        string  entraObjectId,
        string? displayName,
        string? phone,
        string? email,
        bool?   isOptedOut,
        CancellationToken ct = default);

    /// <summary>
    /// Hard-deletes the contact record for the person identified by
    /// <paramref name="entraObjectId"/> (GDPR Art. 17). Idempotent: returns
    /// <see cref="EraseContactResult.Ok"/> whether or not a contact row currently exists, as
    /// long as they are (or were) a linked resident. Cascades <c>PushSubscriptions</c> and
    /// <c>NotificationHistory</c> for their household only if no other resident's contact row
    /// remains afterward — those two tables are shared per-household infrastructure, not
    /// per-person, so a co-resident's data must survive this call.
    /// R3: never log <paramref name="entraObjectId"/>.
    /// </summary>
    Task<EraseContactResult> DeleteContactByOidAsync(string entraObjectId, CancellationToken ct = default);

    /// <summary>
    /// Upserts display name, phone, email, and opt-out flag for the one resident matching
    /// <paramref name="householdRef"/> + <paramref name="role"/>, resolved via
    /// <c>HouseholdLinks</c> (not <c>HouseholdContacts</c> row-count, since a resident who
    /// erased their contact still counts as the one match). Returns
    /// <see cref="UpdateContactResult.Ambiguous"/> if more than one resident currently holds
    /// that role in that household. R3: never log <paramref name="householdRef"/>,
    /// <paramref name="phone"/>, or <paramref name="email"/>.
    /// </summary>
    Task<UpdateContactResult> UpsertContactAsync(
        HouseholdRef householdRef,
        string       role,
        string?      displayName,
        string?      phone,
        string?      email,
        bool?        isOptedOut,
        CancellationToken ct = default);

    /// <summary>
    /// Upserts the operational notes for <paramref name="householdRef"/> — genuinely
    /// household-level (not per-person); applies to every resident's row for that household.
    /// Passing <see langword="null"/> clears existing notes.
    /// </summary>
    Task<UpdateNotesResult> UpsertNotesAsync(
        HouseholdRef householdRef,
        string?      notes,
        CancellationToken ct = default);

    /// <summary>
    /// Hard-deletes the contact record for the one resident matching
    /// <paramref name="householdRef"/> + <paramref name="role"/> (GDPR Art. 17, board DSAR),
    /// resolved via <c>HouseholdLinks</c>. Returns <see cref="EraseContactResult.Ambiguous"/> if
    /// more than one resident currently holds that role. Cascade rules match
    /// <see cref="DeleteContactByOidAsync"/>. R3: never log <paramref name="householdRef"/>.
    /// </summary>
    Task<EraseContactResult> DeleteContactAsync(
        HouseholdRef householdRef,
        string       role,
        CancellationToken ct = default);

    /// <summary>
    /// Sets <c>DepartedAt</c> for the one resident matching <paramref name="householdRef"/> +
    /// <paramref name="role"/>, resolved via <c>HouseholdLinks</c>. Idempotent — preserves the
    /// original departure date if already set. Returns
    /// <see cref="MarkDepartedResult.Ambiguous"/> if more than one resident currently holds
    /// that role. R3: never log <paramref name="householdRef"/>.
    /// </summary>
    Task<MarkDepartedResult> MarkDepartedAsync(
        HouseholdRef householdRef,
        string       role,
        CancellationToken ct = default);

    /// <summary>
    /// Hard-deletes all rows where <c>DepartedAt</c> is older than 1 year (GDPR Art. 6(1)(f)
    /// retention cutoff). Returns the count of deleted rows.
    /// </summary>
    Task<PurgeExpiredContactsResult> PurgeExpiredContactsAsync(
        CancellationToken ct = default);

    /// <summary>
    /// Removes the one resident matching <paramref name="householdRef"/> + <paramref name="role"/>
    /// (resident is resolved via <c>HouseholdLinks</c>) completely: deletes their
    /// <c>HouseholdContacts</c> row and their <c>HouseholdLinks</c> row. Returns
    /// <see cref="RemoveResidentResult.Ambiguous"/>
    /// if more than one resident currently holds that role. After this call their Entra account
    /// is unlinked and they re-enter the pending flow on next sign-in.
    /// R3: never log <paramref name="householdRef"/>.
    /// </summary>
    Task<RemoveResidentResult> RemoveResidentAsync(
        HouseholdRef householdRef,
        string       role,
        CancellationToken ct = default);
}
