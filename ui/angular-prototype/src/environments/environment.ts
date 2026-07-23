export const environment = {
  apiUrl: 'http://localhost:5000',
  msal: {
    clientId: 'd878bdc3-eb45-4dfb-96ad-3cb0ace68ebf',
    authority: 'https://residenceharmonia.ciamlogin.com/28bd994b-6208-43ef-8a44-4ef2efccd991',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
    // Requires "Expose an API" + scope named "api_access" in the Entra portal first.
    apiScope: 'api://d878bdc3-eb45-4dfb-96ad-3cb0ace68ebf/api_access',
  },
};
