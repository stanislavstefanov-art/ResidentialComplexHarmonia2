import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeBg from '@angular/common/locales/bg';
import { ProgressSpinner } from 'primeng/progressspinner';
import { MeService } from './me.service';
import { RoleService } from './role.service';
import { ResidentPendingComponent } from './resident-pending/resident-pending.component';
import { LanguageService } from './language.service';
import { IosSafariInstallBannerComponent } from './ios-safari-install-banner/ios-safari-install-banner.component';

registerLocaleData(localeBg);

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ProgressSpinner, ResidentPendingComponent, IosSafariInstallBannerComponent],
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
    <app-ios-safari-install-banner />
  `,
})
export class App implements OnInit, OnDestroy {
  private readonly _destroying$ = new Subject<void>();
  meStatus = signal<'loading' | 'pending' | 'ok'>('loading');

  constructor(
    private readonly authService: MsalService,
    private readonly broadcastService: MsalBroadcastService,
    private readonly meService: MeService,
    private readonly langService: LanguageService,
    private readonly roleService: RoleService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.langService.init();

    this.authService.handleRedirectObservable().subscribe();

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
            next: (res) => {
              if (res.status === 'pending') { this.meStatus.set('pending'); return; }
              this.meStatus.set('ok');
              if (this.roleService.isAdmin) {
                this.router.navigate(['/directory']);
              } else if (!localStorage.getItem('harmonia-welcomed')) {
                localStorage.setItem('harmonia-welcomed', '1');
                this.router.navigate(['/contact-edit']);
              } else {
                this.router.navigate(['/notifications']);
              }
            },
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
