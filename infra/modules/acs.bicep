param namePrefix string
param keyVaultName string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${namePrefix}-email'
  location: 'global'
  properties: {
    dataLocation: 'Europe'
  }
}

resource azureDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
  }
}

resource acsService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${namePrefix}-acs'
  location: 'global'
  properties: {
    dataLocation: 'Europe'
    linkedDomains: [azureDomain.id]
  }
}

resource acsConnStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'Acs--ConnectionString'
  properties: {
    value: acsService.listKeys().primaryConnectionString
  }
}

var senderAddress = 'DoNotReply@${azureDomain.properties.mailFromSenderDomain}'

resource acsSenderSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'Acs--SenderAddress'
  properties: {
    value: senderAddress
  }
}

output senderAddress string = senderAddress
