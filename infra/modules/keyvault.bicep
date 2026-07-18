@minLength(2)
param namePrefix string
param location string
@secure()
param sqlAdminPassword string
param serverFqdn string
param databaseName string
param identityPrincipalId string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    softDeleteRetentionInDays: 7
  }
}

var connectionStringValue = 'Server=tcp:${serverFqdn},1433;Initial Catalog=${databaseName};Persist Security Info=False;User ID=harmonia-admin;Password=${sqlAdminPassword};Encrypt=True;'

resource connStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ConnectionStrings--Default'
  properties: {
    value: connectionStringValue
  }
}

var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identityPrincipalId, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output connectionStringSecretUri string = connStringSecret.properties.secretUri
