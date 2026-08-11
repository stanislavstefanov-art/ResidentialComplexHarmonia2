@minLength(2)
param namePrefix string = 'harmonia'
param location string = 'westeurope'
@secure()
param sqlAdminPassword string
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
param entraTenantId string
param githubOrg string = 'stanislavstefanov-art'
param githubRepo string = 'ResidentialComplexHarmonia2'

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    namePrefix: namePrefix
    location: location
    githubOrg: githubOrg
    githubRepo: githubRepo
  }
}

// location intentionally omitted — sql.bicep defaults to northeurope where useFreeLimit works; all other resources stay in westeurope (both are EU/GDPR, R3).
module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    namePrefix: namePrefix
    sqlAdminPassword: sqlAdminPassword
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    namePrefix: namePrefix
    location: location
    identityPrincipalId: identity.outputs.identityPrincipalId
    serverFqdn: sql.outputs.serverFqdn
    databaseName: sql.outputs.databaseName
    sqlAdminPassword: sqlAdminPassword
    vapidSubject: vapidSubject
    vapidPublicKey: vapidPublicKey
    vapidPrivateKey: vapidPrivateKey
    entraInstance: entraInstance
    entraClientId: entraClientId
    entraTenantId: entraTenantId
  }
}

module acs 'modules/acs.bicep' = {
  name: 'acs'
  params: {
    namePrefix: namePrefix
    keyVaultName: keyvault.outputs.keyVaultName
  }
}

module frontend 'modules/frontend.bicep' = {
  name: 'frontend'
  params: {
    namePrefix: namePrefix
    location: location
  }
}

module docIntelligence 'modules/document-intelligence.bicep' = {
  name: 'docIntelligence'
  params: {
    keyVaultName: keyvault.outputs.keyVaultName
  }
}

// location intentionally omitted — api.bicep defaults to northeurope to co-locate with SQL. Both are EU/GDPR compliant (R3).
// dependsOn acs + docIntelligence: both write secrets into Key Vault; App Service reads them via Key Vault references at startup.
module api 'modules/api.bicep' = {
  name: 'api'
  dependsOn: [acs, docIntelligence]
  params: {
    namePrefix: namePrefix
    identityId: identity.outputs.identityId
    keyVaultUri: keyvault.outputs.keyVaultUri
    angularSwaUrl: frontend.outputs.angularSwaUrl
    reactSwaUrl: frontend.outputs.reactSwaUrl
  }
}

// Contributor on the resource group lets the managed identity deploy to App Service in CD.
resource identityContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', '${namePrefix}-api-id'), 'Contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
    principalId: identity.outputs.identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output apiUrl string = api.outputs.webAppUrl
output angularSwaUrl string = frontend.outputs.angularSwaUrl
output reactSwaUrl string = frontend.outputs.reactSwaUrl
output managedIdentityClientId string = identity.outputs.identityClientId
output keyVaultName string = keyvault.outputs.keyVaultName
