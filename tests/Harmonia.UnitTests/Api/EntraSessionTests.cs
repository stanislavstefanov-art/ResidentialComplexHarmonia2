using System.Security.Claims;
using Harmonia.Api.Identity;
using Microsoft.AspNetCore.Http;

namespace Harmonia.UnitTests.Api;

public class EntraSessionTests
{
    [Fact]
    public void Null_http_context_returns_null()
    {
        var session = new EntraSession(Accessor(null));

        Assert.Null(session.Resolve());
    }

    [Fact]
    public void Unauthenticated_user_returns_null()
    {
        // ClaimsIdentity with no authenticationType = IsAuthenticated false
        var user = new ClaimsPrincipal(new ClaimsIdentity());
        var session = new EntraSession(Accessor(user));

        Assert.Null(session.Resolve());
    }

    [Fact]
    public void extension_role_resident_maps_to_IsResident_with_household()
    {
        var session = new EntraSession(Accessor(Authenticated(
            ("extension_role", "resident"),
            ("extension_householdRef", "HH-42"))));

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.True(ctx.IsResident);
        Assert.False(ctx.IsAdmin);
        Assert.Equal("HH-42", ctx.HouseholdRef?.Value);
    }

    [Fact]
    public void extension_role_admin_maps_to_IsAdmin_with_null_household()
    {
        // Admin accounts carry no extension_householdRef claim (ADR-0003)
        var session = new EntraSession(Accessor(Authenticated(
            ("extension_role", "admin"))));

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.False(ctx.IsResident);
        Assert.True(ctx.IsAdmin);
        Assert.Null(ctx.HouseholdRef);
    }

    [Fact]
    public void Empty_householdRef_claim_maps_to_null_household()
    {
        var session = new EntraSession(Accessor(Authenticated(
            ("extension_role", "resident"),
            ("extension_householdRef", ""))));

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.Null(ctx.HouseholdRef);
    }

    [Fact]
    public void Unrecognised_role_value_sets_no_flags()
    {
        var session = new EntraSession(Accessor(Authenticated(
            ("extension_role", "superuser"))));

        var ctx = session.Resolve();

        Assert.NotNull(ctx);
        Assert.False(ctx.IsResident);
        Assert.False(ctx.IsAdmin);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private static ClaimsPrincipal Authenticated(params (string Type, string Value)[] claims)
    {
        var identity = new ClaimsIdentity(
            claims.Select(c => new Claim(c.Type, c.Value)),
            authenticationType: "TestBearer");   // non-null → IsAuthenticated true
        return new ClaimsPrincipal(identity);
    }

    private static IHttpContextAccessor Accessor(ClaimsPrincipal? user)
    {
        HttpContext? ctx = user is null ? null : new DefaultHttpContext { User = user };
        return new StubAccessor(ctx);
    }

    private sealed class StubAccessor(HttpContext? ctx) : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get => ctx; set { } }
    }
}
