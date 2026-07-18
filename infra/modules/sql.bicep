@minLength(2)
param namePrefix string
param location string
@secure()
param sqlAdminPassword string

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${namePrefix}-sql'
  location: location
  properties: {
    administratorLogin: 'harmonia-admin'
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
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
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
