@minLength(2)
param namePrefix string
param location string

resource angularSwa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${namePrefix}-angular-swa'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

resource reactSwa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${namePrefix}-react-swa'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

output angularSwaUrl string = 'https://${angularSwa.properties.defaultHostname}'
output reactSwaUrl string = 'https://${reactSwa.properties.defaultHostname}'
