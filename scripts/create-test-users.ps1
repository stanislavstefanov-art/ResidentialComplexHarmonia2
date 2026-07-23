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
    [string]$TempPassword = 'Harmonia2026!'
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

# ── 3. Find the extensions app (holds the attribute property prefix) ──────────
Write-Host "`n→ Locating aad-extensions-app..."
$appsResp = Invoke-Graph GET '/applications?$filter=startsWith(displayName,''aad-extensions-app'')&$select=appId,displayName'

if (-not $appsResp.value -or $appsResp.value.Count -eq 0) {
    Write-Error @"
Could not find 'aad-extensions-app' in tenant $TenantId.

This app is auto-created by Entra when the first custom user attribute is added.
Go to External Identities → Custom user attributes → + Add and create:
  Name: householdRef   Type: String
  Name: role           Type: String
Then re-run this script.
"@
    exit 1
}

$extApp   = $appsResp.value[0]
$extPrefix = 'extension_' + ($extApp.appId -replace '-', '')
Write-Host "  ✓ Found: $($extApp.displayName)"
Write-Host "  ✓ Attribute prefix: $extPrefix"

# ── 4. Verify custom attributes are registered ────────────────────────────────
Write-Host "`n→ Verifying custom user attributes..."
$flowAttrs = Invoke-Graph GET '/identity/userFlowAttributes?$select=displayName'
$registered = $flowAttrs.value | Select-Object -ExpandProperty displayName

$missing = @()
foreach ($attr in @('householdRef', 'role')) {
    if ($registered -contains $attr) {
        Write-Host "  ✓ $attr"
    } else {
        Write-Warning "  ✗ $attr — NOT FOUND in tenant"
        $missing += $attr
    }
}

if ($missing.Count -gt 0) {
    Write-Error @"
Missing custom attributes: $($missing -join ', ')

Create them in the portal before running this script:
  External Identities → Custom user attributes → + Add
  Name: householdRef   Type: String
  Name: role           Type: String
"@
    exit 1
}

# ── 5. Create users ───────────────────────────────────────────────────────────
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

# ── 6. Summary ────────────────────────────────────────────────────────────────
Write-Host @"

✓ Done.

Sign in at http://localhost:4200 or http://localhost:3000 with:

  Resident:  test.resident@$TenantDomain
  Admin:     test.admin@$TenantDomain
  Password:  $TempPassword  (same for both)

The API reads extension_householdRef and extension_role from the JWT.
These are set via the Graph API as ${extPrefix}_* on the user object.
"@
