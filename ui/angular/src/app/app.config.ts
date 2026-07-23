import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
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
    { provide: LOCALE_ID, useValue: 'bg' },
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: false },
      },
      translation: {
        firstDayOfWeek: 1,
        dayNames: ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'],
        dayNamesShort: ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб'],
        dayNamesMin: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        monthNames: ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
        monthNamesShort: ['Яну', 'Фев', 'Мар', 'Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек'],
        today: 'Днес',
        clear: 'Изчисти',
        weekHeader: 'Сед',
        dateFormat: 'dd.mm.yy',
        accept: 'Да',
        reject: 'Не',
        choose: 'Избери',
        upload: 'Качи',
        cancel: 'Отказ',
        fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        aria: {
          trueLabel: 'Вярно',
          falseLabel: 'Невярно',
          nullLabel: 'Не е избрано',
          star: '1 звезда',
          stars: '{0} звезди',
          selectAll: 'Избери всички',
          unselectAll: 'Премахни всички',
          close: 'Затвори',
          previous: 'Предишен',
          next: 'Следващ',
          navigation: 'Навигация',
          scrollTop: 'Нагоре',
          moveTop: 'Премести най-горе',
          moveUp: 'Премести нагоре',
          moveDown: 'Премести надолу',
          moveBottom: 'Премести най-долу',
          moveToTarget: 'Премести към целта',
          moveToSource: 'Премести към източника',
          moveAllToTarget: 'Премести всички към целта',
          moveAllToSource: 'Премести всички към източника',
          pageLabel: 'Страница {page}',
          firstPageLabel: 'Първа страница',
          lastPageLabel: 'Последна страница',
          nextPageLabel: 'Следваща страница',
          previousPageLabel: 'Предишна страница',
          rowsPerPageLabel: 'Редове на страница',
          jumpToPageDropdownLabel: 'Отиди на страница',
          jumpToPageInputLabel: 'Отиди на страница',
          selectRow: 'Избери ред',
          unselectRow: 'Премахни ред',
          expandRow: 'Разшири ред',
          collapseRow: 'Свий ред',
          showFilterMenu: 'Покажи филтри',
          hideFilterMenu: 'Скрий филтри',
          filterOperator: 'Оператор на филтър',
          filterConstraint: 'Ограничение на филтър',
          editRow: 'Редактирай ред',
          saveEdit: 'Запази',
          cancelEdit: 'Отказ',
          listView: 'Изглед на списък',
          gridView: 'Мрежов изглед',
          slide: 'Слайд',
          slideNumber: 'Слайд {slideNumber}',
          zoomImage: 'Увеличи изображение',
          zoomIn: 'Увеличи',
          zoomOut: 'Намали',
          rotateRight: 'Завърти надясно',
          rotateLeft: 'Завърти наляво',
        },
      },
    }),
  ],
};
