export const environment = {
  apiUrl: 'https://residenceharmonia-api.bravesea-14332e7f.northeurope.azurecontainerapps.io',
  msal: {
    clientId: 'd878bdc3-eb45-4dfb-96ad-3cb0ace68ebf',
    authority: 'https://residenceharmonia.ciamlogin.com/28bd994b-6208-43ef-8a44-4ef2efccd991',
    // window.location.origin adapts to the deployed SWA URL automatically.
    // Add the deployed SWA URL to the Entra portal redirect URIs (Authentication blade).
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    apiScope: 'api://d878bdc3-eb45-4dfb-96ad-3cb0ace68ebf/api_access',
  },
};
