using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Harmonia.UnitTests.Api;

// ConfigureAppConfiguration on IWebHostBuilder runs AFTER WebApplication.CreateBuilder has
// already read config, so eager startup guards (VAPID, ACS) throw before the in-memory
// collection can be injected. Setting environment variables in the constructor guarantees
// they are present when Program.Main reads builder.Configuration.
public sealed class HarmoniaProductionFactory : WebApplicationFactory<Program>
{
    private static readonly string[] _keys =
    [
        "ASPNETCORE_ENVIRONMENT", "ConnectionStrings__Default",
        "Vapid__Subject", "Vapid__PublicKey", "Vapid__PrivateKey",
        "Acs__ConnectionString", "Acs__SenderAddress",
        "AzureAdB2C__Instance", "AzureAdB2C__ClientId", "AzureAdB2C__Domain",
        "AzureAdB2C__SignUpSignInPolicyId", "AzureAdB2C__TenantId",
    ];

    private readonly Dictionary<string, string?> _saved;

    public HarmoniaProductionFactory()
    {
        _saved = _keys.ToDictionary(k => k, k => Environment.GetEnvironmentVariable(k));

        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT",            "Production");
        Environment.SetEnvironmentVariable("ConnectionStrings__Default",        "Server=fake;");
        Environment.SetEnvironmentVariable("Vapid__Subject",                    "mailto:test@harmonia.example");
        Environment.SetEnvironmentVariable("Vapid__PublicKey",                  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        Environment.SetEnvironmentVariable("Vapid__PrivateKey",                 "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        Environment.SetEnvironmentVariable("Acs__ConnectionString",             "fake-acs-connection-string");
        Environment.SetEnvironmentVariable("Acs__SenderAddress",                "noreply@harmonia.example");
        Environment.SetEnvironmentVariable("AzureAdB2C__Instance",              "https://fake.b2clogin.com/");
        Environment.SetEnvironmentVariable("AzureAdB2C__ClientId",              "00000000-0000-0000-0000-000000000000");
        Environment.SetEnvironmentVariable("AzureAdB2C__Domain",                "fake.onmicrosoft.com");
        Environment.SetEnvironmentVariable("AzureAdB2C__SignUpSignInPolicyId",  "B2C_1_SignUpSignIn");
        Environment.SetEnvironmentVariable("AzureAdB2C__TenantId",              "00000000-0000-0000-0000-000000000001");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
            services.RemoveAll<IHostedService>());
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
            foreach (var (key, value) in _saved)
                Environment.SetEnvironmentVariable(key, value);
        base.Dispose(disposing);
    }
}

// Disables parallel execution within this collection to prevent the process-wide
// env-var mutation in HarmoniaProductionFactory from poisoning concurrent test classes.
[CollectionDefinition("AuthPolicy", DisableParallelization = true)]
public sealed class AuthPolicyCollection { }

[Collection("AuthPolicy")]
public class AuthorizationPolicyTests : IClassFixture<HarmoniaProductionFactory>
{
    private readonly HttpClient _client;

    public AuthorizationPolicyTests(HarmoniaProductionFactory factory)
    {
        _client = factory.CreateClient(
            new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
    }

    [Fact]
    public async Task Unauthenticated_GET_directory_returns_401()
    {
        var response = await _client.GetAsync("/directory");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Unauthenticated_GET_healthz_returns_200()
    {
        var response = await _client.GetAsync("/healthz");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
