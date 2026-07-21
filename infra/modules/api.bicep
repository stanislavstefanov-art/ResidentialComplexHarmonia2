@minLength(2)
param namePrefix string
// North Europe — westeurope AKS capacity exhausted (AKSCapacityHeavyUsage). NE co-locates with SQL and is EU/GDPR compliant (R3).
param location string = 'northeurope'
param identityId string
param acrLoginServer string
param containerImageTag string
param keyVaultUri string
param angularSwaUrl string
param reactSwaUrl string
param useBootstrapImage bool = false

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {}
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${namePrefix}-api'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
      secrets: [
        {
          name: 'conn-default'
          keyVaultUrl: '${keyVaultUri}secrets/ConnectionStrings--Default'
          identity: identityId
        }
        {
          name: 'vapid-subject'
          keyVaultUrl: '${keyVaultUri}secrets/Vapid--Subject'
          identity: identityId
        }
        {
          name: 'vapid-public-key'
          keyVaultUrl: '${keyVaultUri}secrets/Vapid--PublicKey'
          identity: identityId
        }
        {
          name: 'vapid-private-key'
          keyVaultUrl: '${keyVaultUri}secrets/Vapid--PrivateKey'
          identity: identityId
        }
        {
          name: 'acs-conn-string'
          keyVaultUrl: '${keyVaultUri}secrets/Acs--ConnectionString'
          identity: identityId
        }
        {
          name: 'acs-sender'
          keyVaultUrl: '${keyVaultUri}secrets/Acs--SenderAddress'
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: '${namePrefix}-api'
          image: useBootstrapImage ? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' : '${acrLoginServer}/${namePrefix}-api:${containerImageTag}'
          env: [
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Development'
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:8080'
            }
            {
              name: 'Cors__AllowedOrigins__0'
              value: angularSwaUrl
            }
            {
              name: 'Cors__AllowedOrigins__1'
              value: reactSwaUrl
            }
            {
              name: 'ConnectionStrings__Default'
              secretRef: 'conn-default'
            }
            {
              name: 'Vapid__Subject'
              secretRef: 'vapid-subject'
            }
            {
              name: 'Vapid__PublicKey'
              secretRef: 'vapid-public-key'
            }
            {
              name: 'Vapid__PrivateKey'
              secretRef: 'vapid-private-key'
            }
            {
              name: 'Acs__ConnectionString'
              secretRef: 'acs-conn-string'
            }
            {
              name: 'Acs__SenderAddress'
              secretRef: 'acs-sender'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
      }
    }
  }
}

output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
