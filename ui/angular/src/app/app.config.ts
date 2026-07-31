import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, LOCALE_ID, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, HttpClient } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
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
          authRequest: { scopes: ['openid', 'profile', 'email'] },
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
    { provide: LOCALE_ID, useValue: 'bg' },
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: false },
      },
    }),
    provideTranslateService({
      loader: {
        provide: TranslateLoader,
        useFactory: (http: HttpClient) => new TranslateHttpLoader(http, '/assets/i18n/', '.json'),
        deps: [HttpClient],
      },
      defaultLanguage: 'bg',
    }),
  ],
};
