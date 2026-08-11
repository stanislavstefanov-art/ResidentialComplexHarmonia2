@minLength(2)
param namePrefix string
// North Europe — co-locates with SQL and is EU/GDPR compliant (R3).
param location string = 'northeurope'
param identityId string
param keyVaultUri string
param angularSwaUrl string
param reactSwaUrl string

// C1: Free (F1) — no Docker image or ACR required; deploy via zip/dotnet publish.
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${namePrefix}-asp'
  location: location
  sku: {
    name: 'F1'
    tier: 'Free'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: '${namePrefix}-api'
  location: location
  kind: 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    // Tells App Service which managed identity to use when resolving @Microsoft.KeyVault() references.
    keyVaultReferenceIdentity: identityId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      appSettings: [
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'Cors__AllowedOrigins__0'
          value: angularSwaUrl
        }
        {
          name: 'Cors__AllowedOrigins__1'
          value: reactSwaUrl
        }
        {
          name: 'ConnectionStrings__Default'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ConnectionStrings--Default)'
        }
        {
          name: 'Vapid__Subject'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/Vapid--Subject)'
        }
        {
          name: 'Vapid__PublicKey'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/Vapid--PublicKey)'
        }
        {
          name: 'Vapid__PrivateKey'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/Vapid--PrivateKey)'
        }
        {
          name: 'Acs__ConnectionString'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/Acs--ConnectionString)'
        }
        {
          name: 'Acs__SenderAddress'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/Acs--SenderAddress)'
        }
        {
          name: 'AzureAd__Instance'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/AzureAd--Instance)'
        }
        {
          name: 'AzureAd__ClientId'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/AzureAd--ClientId)'
        }
        {
          name: 'AzureAd__TenantId'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/AzureAd--TenantId)'
        }
        {
          name: 'DocumentIntelligence__Endpoint'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/DocumentIntelligence--Endpoint)'
        }
        {
          name: 'DocumentIntelligence__Key'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/DocumentIntelligence--Key)'
        }
      ]
    }
  }
}

output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
