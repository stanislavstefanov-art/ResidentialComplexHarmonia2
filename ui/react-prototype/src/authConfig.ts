import { BrowserCacheLocation, PublicClientApplication } from '@azure/msal-browser';

const CLIENT_ID = 'd878bdc3-eb45-4dfb-96ad-3cb0ace68ebf';
const AUTHORITY = 'https://residenceharmonia.ciamlogin.com/28bd994b-6208-43ef-8a44-4ef2efccd991';

// Requires "Expose an API" + scope named "api_access" in the Entra portal first.
export const API_SCOPE = `api://${CLIENT_ID}/api_access`;

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: CLIENT_ID,
    authority: AUTHORITY,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    knownAuthorities: ['residenceharmonia.ciamlogin.com'],
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
    storeAuthStateInCookie: false,
  },
});

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};
