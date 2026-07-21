@minLength(2)
param namePrefix string
// North Europe — useFreeLimit only works in NE for this subscription (WE returns InternalServerError). Both NE and WE are EU/GDPR compliant (R3).
param location string = 'northeurope'
@secure()
param sqlAdminPassword string

resource sqlServer 'Microsoft.Sql/servers@2023-02-01-preview' = {
  name: '${namePrefix}-sql'
  location: location
  properties: {
    administratorLogin: 'harmonia-admin'
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-02-01-preview' = {
  parent: sqlServer
  name: '${namePrefix}-db'
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
    requestedBackupStorageRedundancy: 'Local'
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-02-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
