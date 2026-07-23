<#
.SYNOPSIS
    Creates test users in the Harmonia Entra External ID (CIAM) tenant via Graph API.

.DESCRIPTION
    Creates two local-account users with the custom attributes the API reads from JWTs:
      - test.resident  — extension_householdRef="АП. 1", extension_role="resident"
      - test.admin     — extension_role="admin"  (no householdRef, per ADR-0003)

.PREREQUISITES
    1. Azure CLI installed and logged in to the Harmonia tenant:
         az login --tenant 28bd994b-6208-43ef-8a44-4ef2efccd991 --allow-no-subscriptions
    2. The 'householdRef' and 'role' custom user attributes already created in the portal:
         External Identities → Custom user attributes → + Add

.USAGE
    pwsh scripts/create-test-users.ps1
    pwsh scripts/create-test-users.ps1 -TempPassword 'MyPass99!'
#>

param(
    [string]$TempPassword    = 'Harmonia2026!',
    # Optional: pass the prefix directly to skip auto-discovery.
    # Find it in the portal: External Identities → Custom user attributes →
    # click 'householdRef' → copy 'API name', then strip '_householdRef'.
    # Example: -ExtensionPrefix extension_abc123def456abc123def456abc123de
    [string]$ExtensionPrefix = ''
)

$TenantId     = '28bd994b-6208-43ef-8a44-4ef2efccd991'
$TenantDomain = 'residenceharmonia.onmicrosoft.com'

# ── 1. Acquire Graph token via az CLI ─────────────────────────────────────────
Write-Host "`n→ Acquiring Graph API token for tenant $TenantId..."
$tokenJson = az account get-access-token `
    --resource 'https://graph.microsoft.com/' `
    --tenant   $TenantId 2>&1 | ConvertFrom-Json

if (-not $tokenJson.accessToken) {
    Write-Error @"
No token returned. Make sure you are logged in to the correct tenant:

  az login --tenant $TenantId --allow-no-subscriptions

Then re-run this script.
"@
    exit 1
}

$token = $tokenJson.accessToken
Write-Host "  ✓ Token acquired (expires $($tokenJson.expiresOn))"

# ── 2. Graph helper ───────────────────────────────────────────────────────────
function Invoke-Graph {
    param([string]$Method, [string]$Path, [hashtable]$Body = $null)
    $params = @{
        Method  = $Method
        Uri     = "https://graph.microsoft.com/v1.0$Path"
        Headers = @{
            Authorization  = "Bearer $token"
            'Content-Type' = 'application/json'
        }
        ErrorAction = 'Stop'
    }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -EscapeHandling EscapeNonAscii) }
    try {
        Invoke-RestMethod @params
    } catch {
        $detail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        throw ($detail.error.message ?? $_.Exception.Message)
    }
}

# ── 3. Resolve extension property prefix ─────────────────────────────────────
# Strategy 1: caller supplied it via -ExtensionPrefix
# Strategy 2: az ad app list (uses az CLI's own auth, no extra Graph scopes needed)
# Strategy 3: Graph /identity/userFlowAttributes (needs IdentityUserFlow.Read.All)
# Strategy 4: fail with instructions

if ($ExtensionPrefix) {
    Write-Host "`n→ Using supplied extension prefix: $ExtensionPrefix"
    $extPrefix = $ExtensionPrefix
} else {
    Write-Host "`n→ Resolving extension property prefix..."

    # Try az ad app list first — uses az CLI's own directory auth
    # Entra External ID (CIAM) uses 'b2c-extensions-app'; classic AAD uses 'aad-extensions-app'
    $extApps = az ad app list --display-name 'b2c-extensions-app' 2>$null | ConvertFrom-Json
    if (-not ($extApps -and $extApps.Count -gt 0)) {
        $extApps = az ad app list --display-name 'aad-extensions-app' 2>$null | ConvertFrom-Json
    }
    if ($extApps -and $extApps.Count -gt 0) {
        $extPrefix = 'extension_' + ($extApps[0].appId -replace '-', '')
        Write-Host "  ✓ Found via az ad app list: $($extApps[0].displayName)"
        Write-Host "  ✓ Extension prefix: $extPrefix"
    } else {
        # Try Graph /identity/userFlowAttributes (needs IdentityUserFlow.Read.All)
        try {
            $flowAttrs        = Invoke-Graph GET '/identity/userFlowAttributes?$select=id,displayName'
            $householdRefAttr = $flowAttrs.value | Where-Object { $_.displayName -eq 'householdRef' }
            if ($householdRefAttr) {
                $extPrefix = $householdRefAttr.id -replace '_householdRef$', ''
                Write-Host "  ✓ Found via userFlowAttributes"
                Write-Host "  ✓ Extension prefix: $extPrefix"
            }
        } catch {
            $householdRefAttr = $null
        }

        if (-not $extPrefix) {
            Write-Error @"
Could not auto-discover the extension property prefix. Pass it manually:

  1. Azure portal → External Identities → Custom user attributes
  2. Click 'householdRef' → copy the 'API name'  (e.g. extension_abc123_householdRef)
  3. Strip '_householdRef' from the end and run:

     .\create-test-users.ps1 -ExtensionPrefix extension_abc123
"@
            exit 1
        }
    }
}

# ── 4. Create users ───────────────────────────────────────────────────────────
function New-HarmoniaUser {
    param(
        [string]$DisplayName,
        [string]$Username,
        [string]$Role,
        [string]$HouseholdRef = $null
    )

    $upn = "$Username@$TenantDomain"
    Write-Host "`n→ Creating '$DisplayName' ($upn)..."

    $body = [ordered]@{
        accountEnabled    = $true
        displayName       = $DisplayName
        userPrincipalName = $upn
        mailNickname      = $Username
        passwordProfile   = @{
            password                      = $TempPassword
            forceChangePasswordNextSignIn = $false
        }
        "${extPrefix}_role" = $Role
    }

    # householdRef is only set for residents (ADR-0003: admin has no householdRef claim)
    if ($HouseholdRef) {
        $body["${extPrefix}_householdRef"] = $HouseholdRef
    }

    try {
        $user = Invoke-Graph POST '/users' $body
        Write-Host "  ✓ Created  id=$($user.id)"
        return $user
    } catch {
        if ($_ -match 'already exists') {
            Write-Host "  ! User $upn already exists — skipping."
        } else {
            Write-Warning "  ✗ Failed: $_"
        }
    }
}

New-HarmoniaUser `
    -DisplayName  'Test Resident' `
    -Username     'test.resident' `
    -Role         'resident' `
    -HouseholdRef 'АП. 1'

New-HarmoniaUser `
    -DisplayName 'Test Admin' `
    -Username    'test.admin' `
    -Role        'admin'
    # no HouseholdRef for admin — ADR-0003

# ── 5. Summary ────────────────────────────────────────────────────────────────
Write-Host @"

✓ Done.

Sign in at http://localhost:4200 or http://localhost:3000 with:

  Resident:  test.resident@$TenantDomain
  Admin:     test.admin@$TenantDomain
  Password:  $TempPassword  (same for both)

The API reads extension_householdRef and extension_role from the JWT.
These are set via the Graph API as ${extPrefix}_* on the user object.
"@
