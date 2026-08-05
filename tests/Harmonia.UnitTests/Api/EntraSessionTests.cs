using System.Security.Claims;
using Harmonia.Api.Identity;
using Harmonia.Application;
using Harmonia.Application.PendingSignIn;
using Harmonia.Domain;
using Microsoft.AspNetCore.Http;

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

    // ── helpers ────────────────────────────────────────────────────────────────

    private static EntraSession MakeSession(
        ClaimsPrincipal? user,
        string? householdRef,
        FakePendingSignInStore? store = null)
    {
        HttpContext? ctx = user is null ? null : new DefaultHttpContext { User = user };
        IHttpContextAccessor  accessor    = new StubAccessor(ctx);
        IPendingSignInStore   pendingStore = store ?? new FakePendingSignInStore();
        IHouseholdByOidLookup lookup      = new FakeHouseholdByOidLookup(householdRef);
        return new EntraSession(accessor, pendingStore, lookup);
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
