import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeBg from '@angular/common/locales/bg';

registerLocaleData(localeBg);

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  // MsalRedirectComponent is rendered in a hidden iframe for redirect flows;
  // the guard redirects back here once authentication completes.
  template: `<router-outlet />`,
})
export class App implements OnInit, OnDestroy {
  private readonly _destroying$ = new Subject<void>();

  constructor(
    private readonly authService: MsalService,
    private readonly broadcastService: MsalBroadcastService
  ) {}

  ngOnInit(): void {
    // Must be called in every component that uses redirects so MSAL can
    // process the authorization response on the redirect return.
    this.authService.handleRedirectObservable().subscribe();

    // Once all in-progress interactions complete, ensure an active account is
    // set so acquireTokenSilent knows which account to use.
    this.broadcastService.inProgress$
      .pipe(
        filter((status) => status === InteractionStatus.None),
        takeUntil(this._destroying$)
      )
      .subscribe(() => {
        const accounts = this.authService.instance.getAllAccounts();
        if (accounts.length > 0 && !this.authService.instance.getActiveAccount()) {
          this.authService.instance.setActiveAccount(accounts[0]);
        }
      });
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}
