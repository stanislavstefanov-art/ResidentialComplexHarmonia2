# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files first so the restore layer only re-runs when .csproj files change.
COPY Harmonia.sln ./
COPY Directory.Build.props ./
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
