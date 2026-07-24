using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Harmonia.UnitTests.Api;

/// <summary>
/// Verifies the pending-caller middleware gate using a real in-memory ASP.NET Core
/// pipeline (WebApplicationFactory). Tests run in Development mode with stub config
/// so no external DB, VAPID, or ACS service is contacted.
/// </summary>
public class PendingMiddlewareTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public PendingMiddlewareTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Pending_session_gets_403_on_non_me_endpoint()
    {
        var client = Client("DevPending");

        var response = await client.GetAsync("/healthz");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Pending_session_can_reach_GET_me()
    {
        var client = Client("DevPending");

        var response = await client.GetAsync("/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("pending", body);
    }

    [Fact]
    public async Task Resident_session_is_not_blocked_by_middleware()
    {
        var client = Client("Dev");

        var response = await client.GetAsync("/healthz");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Resident_session_reaches_me_with_ok_status()
    {
        var client = Client("Dev");

        var response = await client.GetAsync("/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"ok\"", body);
    }

    private HttpClient Client(string sessionMode)
        => _factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            // UseSetting is applied before Program.cs reads builder.Configuration,
            // so it satisfies startup validation without a real SQL/VAPID/ACS backend.
            builder.UseSetting("ConnectionStrings:Default",   "Server=.;Database=stub;TrustServerCertificate=true;");
            builder.UseSetting("Vapid:Subject",               "mailto:test@harmonia.test");
            builder.UseSetting("Vapid:PublicKey",             "BPublicKeyStubForTestingOnly");
            builder.UseSetting("Vapid:PrivateKey",            "PrivateKeyStubForTestingOnly");
            builder.UseSetting("Acs:ConnectionString",        "endpoint=https://stub.communication.azure.com/;accesskey=c3R1Yg==");
            builder.UseSetting("Acs:SenderAddress",           "noreply@harmonia.test");
            builder.UseSetting("Session:Mode",                sessionMode);
        }).CreateClient();
}
