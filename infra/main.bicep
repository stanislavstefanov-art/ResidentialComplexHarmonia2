@minLength(2)
param namePrefix string = 'harmonia'
param location string = 'westeurope'
param containerImageTag string = 'latest'
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
param useBootstrapImage bool = false

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    namePrefix: namePrefix
    location: location
    githubOrg: githubOrg
    githubRepo: githubRepo
  }
}

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    namePrefix: namePrefix
    location: location
    identityPrincipalId: identity.outputs.identityPrincipalId
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

// location intentionally omitted — api.bicep defaults to northeurope to avoid AKS capacity shortage in westeurope; co-locates with SQL. Both are EU/GDPR compliant (R3).
// dependsOn acs: acs.bicep writes Acs--ConnectionString + Acs--SenderAddress into Key Vault; Container App reads them at revision creation time.
module api 'modules/api.bicep' = {
  name: 'api'
  dependsOn: [acs]
  params: {
    namePrefix: namePrefix
    identityId: identity.outputs.identityId
    acrLoginServer: acr.outputs.loginServer
    containerImageTag: containerImageTag
    keyVaultUri: keyvault.outputs.keyVaultUri
    angularSwaUrl: frontend.outputs.angularSwaUrl
    reactSwaUrl: frontend.outputs.reactSwaUrl
    useBootstrapImage: useBootstrapImage
  }
}

// Contributor on the resource group lets the managed identity update Container Apps in CD.
resource identityContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, namePrefix, 'Contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
    principalId: identity.outputs.identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output acrLoginServer string = acr.outputs.loginServer
output containerAppFqdn string = api.outputs.containerAppFqdn
output angularSwaUrl string = frontend.outputs.angularSwaUrl
output reactSwaUrl string = frontend.outputs.reactSwaUrl
output managedIdentityClientId string = identity.outputs.identityClientId
output keyVaultName string = keyvault.outputs.keyVaultName
