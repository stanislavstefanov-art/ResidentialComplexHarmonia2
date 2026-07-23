import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import {
  BrowserCacheLocation,
  InteractionType,
  PublicClientApplication,
} from '@azure/msal-browser';
import {
  MsalBroadcastService,
  MsalGuard,
  MsalInterceptor,
  MsalModule,
  MsalService,
} from '@azure/msal-angular';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: environment.msal.clientId,
    authority: environment.msal.authority,
    redirectUri: environment.msal.redirectUri,
    postLogoutRedirectUri: environment.msal.postLogoutRedirectUri,
    knownAuthorities: ['residenceharmonia.ciamlogin.com'],
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    // withInterceptorsFromDi() allows class-based interceptors (MsalInterceptor).
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true,
    },
    importProvidersFrom(
      MsalModule.forRoot(
        msalInstance,
        {
          interactionType: InteractionType.Redirect,
          authRequest: {
            scopes: ['openid', 'profile', 'email'],
          },
        },
        {
          interactionType: InteractionType.Redirect,
          protectedResourceMap: new Map([
            [environment.apiUrl, [environment.msal.apiScope]],
          ]),
        }
      )
    ),
    MsalService,
    MsalGuard,
    MsalBroadcastService,
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: false },
      },
    }),
  ],
};
