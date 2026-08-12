param keyVaultName string

// C1: The one free (F0) Document Intelligence slot this subscription allows is
// already used by the RecipesApp project — Azure permits only one F0 FormRecognizer
// account per subscription. Rather than pay for an S0 tier, Harmonia reuses that
// existing free account cross-resource-group. Trade-off: Harmonia's invoice scan
// depends on that resource continuing to exist in the RecipesApp resource group.
param docIntAccountName string = 'recipesapp-ss-0101-docint'
param docIntResourceGroup string = 'RecipesApp'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource docIntelligence 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: docIntAccountName
  scope: resourceGroup(docIntResourceGroup)
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
