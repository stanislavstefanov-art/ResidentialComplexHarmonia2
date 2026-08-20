using System.Security.Claims;
using Harmonia.Api.Identity;
using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace Harmonia.UnitTests.Api;

public class EntraSessionTests
{
    // ── null / unauthenticated ─────────────────────────────────────────────────

    [Fact]
    public void Null_http_context_returns_null()
    {
        var session = MakeSession(user: null, householdRef: null);
        Assert.Null(session.Resolve());
    }

    [Fact]
    public void Unauthenticated_user_returns_null()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity()); // IsAuthenticated = false
        var session = MakeSession(user: user, householdRef: null);
        Assert.Null(session.Resolve());
    }

    [Fact]
    public void Authenticated_user_without_oid_claim_returns_null()
    {
        var user = Authenticated(/* no oid claim */);
        var session = MakeSession(user: user, householdRef: null);
        Assert.Null(session.Resolve());
    }

    // ── admin path (from JWT, no DB lookup) ───────────────────────────────────

    [Fact]
    public void Admin_role_returns_IsAdmin_without_DB_lookup()
    {
        var store = new FakePendingSignInStore();
        var user = Authenticated(("oid", "admin-oid-1"), (ClaimTypes.Role, "admin"));
        var session = MakeSession(user: user, householdRef: null, store: store);

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.True(ctx.IsAdmin);
        Assert.False(ctx.IsResident);
        Assert.False(ctx.IsPending);
        Assert.Equal("admin-oid-1", ctx.EntraObjectId);
        Assert.Null(ctx.HouseholdRef);
        Assert.Empty(store.UpsertCalls);
    }

    [Fact]
    public void Admin_with_no_household_link_never_writes_the_flag()
    {
        // householdRef: null -> FakeHouseholdByOidLookup.FindAsync returns null,
        // so there is no row to mirror the flag onto.
        var lookup = new FakeHouseholdByOidLookup(null);
        var user = Authenticated(("oid", "admin-oid-2"), (ClaimTypes.Role, "admin"));
        var session = MakeSession(user, householdRef: null, lookup: lookup);

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.True(ctx.IsAdmin);
        Assert.Empty(lookup.SetAdminFlagCalls);
    }

    // ── resident path (OID found in DB) ───────────────────────────────────────

    [Fact]
    public void Known_OID_returns_IsResident_with_household_from_DB()
    {
        var store = new FakePendingSignInStore();
        var user = Authenticated(("oid", "resident-oid-1"));
        var session = MakeSession(user: user, householdRef: "HH-42", store: store);

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.True(ctx.IsResident);
        Assert.False(ctx.IsAdmin);
        Assert.False(ctx.IsPending);
        Assert.Equal("resident-oid-1", ctx.EntraObjectId);
        Assert.Equal("HH-42", ctx.HouseholdRef?.Value);
        Assert.Empty(store.UpsertCalls);
    }

    // ── pending path (OID not in DB) ──────────────────────────────────────────

    [Fact]
    public void Unknown_OID_upserts_pending_and_returns_IsPending()
    {
        var store = new FakePendingSignInStore();
        var user = Authenticated(
            ("oid", "new-oid-1"),
            ("email", "user@example.com"),
            (ClaimTypes.Name, "Test User"));
        var session = MakeSession(user: user, householdRef: null, store: store);

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.True(ctx.IsPending);
        Assert.False(ctx.IsResident);
        Assert.False(ctx.IsAdmin);
        Assert.Equal("new-oid-1", ctx.EntraObjectId);
        Assert.Null(ctx.HouseholdRef);
        Assert.Single(store.UpsertCalls);
        Assert.Equal("new-oid-1",        store.UpsertCalls[0].Oid);
        Assert.Equal("user@example.com", store.UpsertCalls[0].Email);
        Assert.Equal("Test User",        store.UpsertCalls[0].DisplayName);
    }

    [Fact]
    public void Resolve_is_cached_per_instance()
    {
        var store = new FakePendingSignInStore();
        var user = Authenticated(("oid", "cache-oid-1"));
        var session = MakeSession(user: user, householdRef: null, store: store);

        var first  = session.Resolve();
        var second = session.Resolve();

        Assert.Same(first, second);
        Assert.Single(store.UpsertCalls);
    }

    // ── SessionContext record ──────────────────────────────────────────────────

    [Fact]
    public void SessionContext_exposes_EntraObjectId_and_IsPending()
    {
        var ctx = new SessionContext(
            IsResident: true, IsAdmin: false,
            HouseholdRef: new HouseholdRef("HH-1"),
            EntraObjectId: "oid-123",
            IsPending: false);

        Assert.Equal("oid-123", ctx.EntraObjectId);
        Assert.False(ctx.IsPending);
    }

    // ── admin flag mirroring ──────────────────────────────────────────────────

    [Fact]
    public void Admin_token_writes_the_flag_when_the_stored_link_disagrees()
    {
        var lookup = new FakeHouseholdByOidLookup("HH-1", isAdmin: false);
        var user = Authenticated(("oid", "admin-oid"), (ClaimTypes.Role, "admin"));
        var session = MakeSession(user, householdRef: "HH-1", lookup: lookup);

        session.Resolve();

        Assert.Equal(("admin-oid", true), Assert.Single(lookup.SetAdminFlagCalls));
    }

    [Fact]
    public void Admin_token_does_not_write_the_flag_when_it_already_agrees()
    {
        // The write must be on change only — this path runs on every single request.
        var lookup = new FakeHouseholdByOidLookup("HH-1", isAdmin: true);
        var user = Authenticated(("oid", "admin-oid"), (ClaimTypes.Role, "admin"));
        var session = MakeSession(user, householdRef: "HH-1", lookup: lookup);

        session.Resolve();

        Assert.Empty(lookup.SetAdminFlagCalls);
    }

    [Fact]
    public void Revoked_admin_has_the_stored_flag_cleared()
    {
        var lookup = new FakeHouseholdByOidLookup("HH-1", isAdmin: true);
        var user = Authenticated(("oid", "ex-admin-oid")); // no admin role any more
        var session = MakeSession(user, householdRef: "HH-1", lookup: lookup);

        session.Resolve();

        Assert.Equal(("ex-admin-oid", false), Assert.Single(lookup.SetAdminFlagCalls));
    }

    [Fact]
    public void Plain_resident_never_writes_the_flag()
    {
        var lookup = new FakeHouseholdByOidLookup("HH-1", isAdmin: false);
        var user = Authenticated(("oid", "resident-oid"));
        var session = MakeSession(user, householdRef: "HH-1", lookup: lookup);

        session.Resolve();

        Assert.Empty(lookup.SetAdminFlagCalls);
    }

    [Fact]
    public void A_failed_mirror_write_does_not_break_authentication()
    {
        // A transient SQL failure while mirroring the flag must not turn a valid
        // admin request into an unhandled exception — the flag just stays stale
        // until the next request.
        var lookup = new ThrowingSetAdminFlagLookup("HH-1", isAdmin: false);
        var user = Authenticated(("oid", "admin-oid"), (ClaimTypes.Role, "admin"));
        var session = MakeSession(user, householdRef: "HH-1", lookup: lookup);

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.True(ctx.IsAdmin);
    }

    // ── new-sign-up signalling ────────────────────────────────────────────────

    [Fact]
    public void A_genuinely_new_pending_signup_enqueues_one_signal()
    {
        var store = new FakePendingSignInStore { NextUpsertResult = PendingUpsertResult.Inserted };
        var queue = new FakeNewPendingSignInQueue();
        var user = Authenticated(("oid", "new-oid"), ("email", "a@b.c"));
        var session = MakeSession(user, householdRef: null, store: store, queue: queue);

        session.Resolve();

        Assert.Single(queue.Enqueued);
    }

    [Fact]
    public void A_repeat_request_from_an_already_pending_user_enqueues_nothing()
    {
        // The regression that matters: UpsertAsync runs on EVERY request from an
        // unlinked caller, so notifying on the call itself would storm every admin.
        var store = new FakePendingSignInStore { NextUpsertResult = PendingUpsertResult.AlreadyPending };
        var queue = new FakeNewPendingSignInQueue();
        var user = Authenticated(("oid", "known-oid"), ("email", "a@b.c"));
        var session = MakeSession(user, householdRef: null, store: store, queue: queue);

        session.Resolve();

        Assert.Empty(queue.Enqueued);
    }

    [Fact]
    public void A_linked_resident_enqueues_nothing()
    {
        var queue = new FakeNewPendingSignInQueue();
        var user = Authenticated(("oid", "resident-oid"));
        var session = MakeSession(user, householdRef: "HH-7", queue: queue);

        session.Resolve();

        Assert.Empty(queue.Enqueued);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private static EntraSession MakeSession(
        ClaimsPrincipal? user,
        string? householdRef,
        FakePendingSignInStore? store = null,
        IHouseholdByOidLookup? lookup = null,
        FakeNewPendingSignInQueue? queue = null)
    {
        HttpContext? ctx = user is null ? null : new DefaultHttpContext { User = user };
        IHttpContextAccessor   accessor     = new StubAccessor(ctx);
        IPendingSignInStore    pendingStore = store ?? new FakePendingSignInStore();
        IHouseholdByOidLookup  oidLookup    = lookup ?? new FakeHouseholdByOidLookup(householdRef);
        INewPendingSignInQueue signalQueue  = queue ?? new FakeNewPendingSignInQueue();
        return new EntraSession(accessor, pendingStore, oidLookup, NullLogger<EntraSession>.Instance, signalQueue);
    }

    /// Reports a stale flag like FakeHouseholdByOidLookup, but SetAdminFlagAsync
    /// always throws — used to prove a mirror-write failure never breaks Resolve().
    private sealed class ThrowingSetAdminFlagLookup(string? householdRef, bool isAdmin) : IHouseholdByOidLookup
    {
        public Task<HouseholdLink?> FindAsync(string oid, CancellationToken ct = default)
            => Task.FromResult(householdRef is null ? null : new HouseholdLink(householdRef, "Owner", isAdmin));

        public Task SetAdminFlagAsync(string oid, bool isAdmin, CancellationToken ct = default)
            => throw new InvalidOperationException("Simulated store failure");
    }

    private static ClaimsPrincipal Authenticated(params (string Type, string Value)[] claims)
    {
        var identity = new ClaimsIdentity(
            claims.Select(c => new Claim(c.Type, c.Value)),
            authenticationType: "TestBearer");
        return new ClaimsPrincipal(identity);
    }

    private sealed class StubAccessor(HttpContext? ctx) : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get => ctx; set { } }
    }
}
