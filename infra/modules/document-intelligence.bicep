param namePrefix string
param location string
param keyVaultName string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// C1: F0 free tier — 500 pages/month, no charge. One F0 allowed per subscription per region.
resource docIntelligence 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${namePrefix}-di'
  location: location
  kind: 'FormRecognizer'
  sku: {
    name: 'F0'
  }
  properties: {
    customSubDomainName: '${namePrefix}-di'
    publicNetworkAccess: 'Enabled'
  }
}

resource diEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'DocumentIntelligence--Endpoint'
  properties: {
    value: docIntelligence.properties.endpoint
  }
}

resource diKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'DocumentIntelligence--Key'
  properties: {
    value: docIntelligence.listKeys().key1
  }
}
