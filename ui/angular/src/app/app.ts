import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeBg from '@angular/common/locales/bg';
import { ProgressSpinner } from 'primeng/progressspinner';
import { MeService } from './me.service';
import { ResidentPendingComponent } from './resident-pending/resident-pending.component';

registerLocaleData(localeBg);

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ProgressSpinner, ResidentPendingComponent],
  // MsalRedirectComponent is rendered in a hidden iframe for redirect flows;
  // the guard redirects back here once authentication completes.
  template: `
    @if (meStatus() === 'loading') {
      <div style="display:flex;justify-content:center;margin-top:4rem">
        <p-progress-spinner />
      </div>
    } @else if (meStatus() === 'pending') {
      <app-resident-pending (activated)="meStatus.set('ok')" />
    } @else {
      <router-outlet />
    }
  `,
})
export class App implements OnInit, OnDestroy {
  private readonly _destroying$ = new Subject<void>();
  meStatus = signal<'loading' | 'pending' | 'ok'>('loading');

  constructor(
    private readonly authService: MsalService,
    private readonly broadcastService: MsalBroadcastService,
    private readonly meService: MeService
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
        if (accounts.length > 0) {
          this.meService.getStatus().subscribe({
            next: (res) => this.meStatus.set(res.status === 'pending' ? 'pending' : 'ok'),
            error: () => this.meStatus.set('ok'),
          });
        }
      });
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}
