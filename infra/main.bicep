@minLength(2)
param namePrefix string = 'harmonia'
param location string = 'westeurope'
param containerImageTag string = 'latest'
@secure()
param sqlAdminPassword string
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

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    namePrefix: namePrefix
    location: location
    identityPrincipalId: identity.outputs.identityPrincipalId
  }
}

module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    namePrefix: namePrefix
    location: location
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
  }
}

module frontend 'modules/frontend.bicep' = {
  name: 'frontend'
  params: {
    namePrefix: namePrefix
    location: location
  }
}

module api 'modules/api.bicep' = {
  name: 'api'
  params: {
    namePrefix: namePrefix
    location: location
    identityId: identity.outputs.identityId
    acrLoginServer: acr.outputs.loginServer
    containerImageTag: containerImageTag
    keyVaultUri: keyvault.outputs.keyVaultUri
    angularSwaUrl: frontend.outputs.angularSwaUrl
    reactSwaUrl: frontend.outputs.reactSwaUrl
  }
}

output acrLoginServer string = acr.outputs.loginServer
output containerAppFqdn string = api.outputs.containerAppFqdn
output angularSwaUrl string = frontend.outputs.angularSwaUrl
output reactSwaUrl string = frontend.outputs.reactSwaUrl
output managedIdentityClientId string = identity.outputs.identityClientId
output keyVaultName string = keyvault.outputs.keyVaultName
