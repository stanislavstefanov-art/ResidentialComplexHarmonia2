@minLength(2)
param namePrefix string
param location string
@secure()
param sqlAdminPassword string
param serverFqdn string
param databaseName string
param identityPrincipalId string
@secure()
param vapidSubject string
@secure()
param vapidPublicKey string
@secure()
param vapidPrivateKey string
@secure()
param entraInstance string
@secure()
param entraClientId string
@secure()
param entraDomain string
@secure()
param entraSignUpSignInPolicyId string
@secure()
param entraTenantId string

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

resource vapidSubjectSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'Vapid--Subject'
  properties: { value: vapidSubject }
}

resource vapidPublicKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'Vapid--PublicKey'
  properties: { value: vapidPublicKey }
}

resource vapidPrivateKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'Vapid--PrivateKey'
  properties: { value: vapidPrivateKey }
}

resource entraInstanceSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--Instance'
  properties: { value: entraInstance }
}

resource entraClientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--ClientId'
  properties: { value: entraClientId }
}

resource entraDomainSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--Domain'
  properties: { value: entraDomain }
}

resource entraPolicySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--SignUpSignInPolicyId'
  properties: { value: entraSignUpSignInPolicyId }
}

resource entraTenantIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureAdB2C--TenantId'
  properties: { value: entraTenantId }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output connectionStringSecretUri string = connStringSecret.properties.secretUri
