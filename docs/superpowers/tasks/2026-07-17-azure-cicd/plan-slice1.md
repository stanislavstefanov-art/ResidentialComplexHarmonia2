# Harmonia API Containerisation — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production Dockerfile, a `/healthz` liveness endpoint, and CORS middleware to `Harmonia.Api` so it is ready for Azure Container Apps deployment.

**Architecture:** Multi-stage Dockerfile at the repo root (sdk:8.0 → aspnet:8.0, port 8080); CORS origins read from `Cors:AllowedOrigins` config array (empty in prod until SWA URLs are known in Slice 3, localhost values in Development); `/healthz` returns `200 OK` with no body.

**Tech Stack:** .NET 8 Minimal API, Docker / Podman, ASP.NET Core CORS middleware

---

## File Map

| File | Action |
|---|---|
| `Dockerfile` | Create — multi-stage build at repo root |
| `src/Harmonia.Api/Program.cs` | Modify — CORS service + `app.UseCors()` + `/healthz` route |
| `src/Harmonia.Api/appsettings.json` | Modify — add `"Cors": { "AllowedOrigins": [] }` |
| `src/Harmonia.Api/appsettings.Development.json` | Modify — add localhost origins |

---

### Task 1: Dockerfile

**Files:**
- Create: `Dockerfile` (repo root)

Test-first: no — Docker image builds cannot be unit-tested; verification is `docker build` output.

- [ ] **Step 1: Create `Dockerfile` at the repo root**

```dockerfile
# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files first so the restore layer only re-runs when .csproj files change.
COPY Harmonia.sln ./
COPY src/Harmonia.Domain/Harmonia.Domain.csproj            src/Harmonia.Domain/
COPY src/Harmonia.Application/Harmonia.Application.csproj  src/Harmonia.Application/
COPY src/Harmonia.Api/Harmonia.Api.csproj                  src/Harmonia.Api/

RUN dotnet restore src/Harmonia.Api/Harmonia.Api.csproj

COPY . .

RUN dotnet publish src/Harmonia.Api/Harmonia.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

# Run as the built-in non-root user supplied by .NET 8 base images.
USER $APP_UID

ENTRYPOINT ["dotnet", "Harmonia.Api.dll"]
```

- [ ] **Step 2: Verify the image builds**

Run from the repo root (Docker or Podman both work):

```bash
docker build -t harmonia-api:local .
```

Expected output ends with:
```
Successfully built <sha>
Successfully tagged harmonia-api:local
```

If using Podman:
```bash
podman build -t harmonia-api:local .
```

The build fails if: NuGet restore fails (network issue), any project file is missing from the COPY layer, or `dotnet publish` emits a compilation error. Fix the error before continuing.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat(deploy): add multi-stage Dockerfile for Harmonia.Api"
```

---

### Task 2: `/healthz` liveness endpoint

**Files:**
- Modify: `src/Harmonia.Api/Program.cs` (line ~319, before `app.Run()`)

Test-first: no — the route is a one-liner returning `Results.Ok()`; verified by running the API and calling the endpoint with curl.

- [ ] **Step 1: Add the `/healthz` route to `Program.cs`**

Open `src/Harmonia.Api/Program.cs`. Find the last `app.MapDelete` block (the `purge-expired` route at the bottom) and the final `app.Run()`. Insert the health route between them:

```csharp
app.MapDelete(
    "/directory/purge-expired",
    (PurgeExpiredContacts uc, ILoggerFactory loggers, CancellationToken ct) =>
        DirectoryEndpoints.PurgeExpiredContactsEndpoint(
            uc, loggers.CreateLogger("Directory"), ct))
   .RequireAuthorization();

app.MapGet("/healthz", () => Results.Ok());

app.Run();
```

- [ ] **Step 2: Verify the endpoint responds**

Start the API (requires a working local config — run `.\dev-start.ps1` first to ensure SQL Server is up and `appsettings.Development.local.json` exists):

```bash
dotnet run --project src/Harmonia.Api
```

In a second terminal:

```bash
curl -i http://localhost:5000/healthz
```

Expected:
```
HTTP/1.1 200 OK
Content-Length: 0
Date: ...
```

- [ ] **Step 3: Commit**

```bash
git add src/Harmonia.Api/Program.cs
git commit -m "feat(deploy): add /healthz liveness endpoint"
```

---

### Task 3: CORS middleware

**Files:**
- Modify: `src/Harmonia.Api/Program.cs`
- Modify: `src/Harmonia.Api/appsettings.json`
- Modify: `src/Harmonia.Api/appsettings.Development.json`

Test-first: no — CORS headers are verified by inspecting HTTP response headers with curl.

- [ ] **Step 1: Add `Cors:AllowedOrigins` to `appsettings.json`**

The current `appsettings.json` ends with the `Acs` block. Add the `Cors` section:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "AzureAdB2C": {
    "Instance": "",
    "Domain": "",
    "TenantId": "",
    "ClientId": "",
    "SignUpSignInPolicyId": ""
  },
  "SlotGrid": {
    "SlotKeys": ["DAY"]
  },
  "Session": {
    "IsResident": true,
    "HouseholdRef": "HH-DEV-1"
  },
  "ConnectionStrings": {
    "Reservations": "",
    "MaintenanceFees": "",
    "Expenses": "",
    "Payments": "",
    "Notifications": "",
    "Directory": ""
  },
  "Vapid": {
    "Subject": "",
    "PublicKey": "",
    "PrivateKey": ""
  },
  "Acs": {
    "ConnectionString": "",
    "SenderAddress": ""
  },
  "Cors": {
    "AllowedOrigins": []
  }
}
```

- [ ] **Step 2: Add localhost origins to `appsettings.Development.json`**

Replace the entire file content with:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:4200",
      "http://localhost:3000"
    ]
  }
}
```

- [ ] **Step 3: Add CORS service registration to `Program.cs`**

Open `src/Harmonia.Api/Program.cs`. Find the ACS validation block (around line 107):

```csharp
var acsConfig = new AcsEmailConfig(acsConnStr, acsSender);
```

Immediately after that line, before `builder.Services.AddSingleton<INotificationDispatcher>`, add:

```csharp
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));
```

- [ ] **Step 4: Add `app.UseCors()` to the middleware pipeline in `Program.cs`**

Find the middleware pipeline section (after `var app = builder.Build();`). The current code is:

```csharp
// MUST precede all app.MapGet / app.MapPost calls — middleware pipeline is order-sensitive.
if (!app.Environment.IsDevelopment())
{
    app.UseAuthentication();
    app.UseAuthorization();
}

app.MapGet(
    "/days/{day}/slots",
```

Add `app.UseCors();` after the `if` block and before the first `app.MapGet`:

```csharp
// MUST precede all app.MapGet / app.MapPost calls — middleware pipeline is order-sensitive.
if (!app.Environment.IsDevelopment())
{
    app.UseAuthentication();
    app.UseAuthorization();
}

app.UseCors();

app.MapGet(
    "/days/{day}/slots",
```

- [ ] **Step 5: Verify CORS headers with curl**

Start the API:

```bash
dotnet run --project src/Harmonia.Api
```

**Test 1 — allowed origin (Angular dev server):**

```bash
curl -i -X OPTIONS http://localhost:5000/healthz \
  -H "Origin: http://localhost:4200" \
  -H "Access-Control-Request-Method: GET"
```

Expected response headers include:
```
Access-Control-Allow-Origin: http://localhost:4200
Access-Control-Allow-Methods: GET
```

**Test 2 — blocked origin:**

```bash
curl -i -X OPTIONS http://localhost:5000/healthz \
  -H "Origin: http://evil.example.com" \
  -H "Access-Control-Request-Method: GET"
```

Expected: no `Access-Control-Allow-Origin` header in the response.

- [ ] **Step 6: Commit**

```bash
git add src/Harmonia.Api/Program.cs \
        src/Harmonia.Api/appsettings.json \
        src/Harmonia.Api/appsettings.Development.json
git commit -m "feat(deploy): add CORS middleware with config-driven allowed origins"
```
