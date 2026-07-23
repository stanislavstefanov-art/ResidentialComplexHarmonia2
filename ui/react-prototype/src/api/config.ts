import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { API_SCOPE, msalInstance } from '../authConfig';

export const API_BASE = process.env.REACT_APP_API_URL ?? 'http://localhost:5000';

async function getBearerToken(): Promise<string | null> {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: [API_SCOPE],
      account: accounts[0],
    });
    return result.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      // Silent token refresh failed — trigger interactive redirect.
      await msalInstance.acquireTokenRedirect({ scopes: [API_SCOPE] });
    }
    return null;
  }
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getBearerToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
