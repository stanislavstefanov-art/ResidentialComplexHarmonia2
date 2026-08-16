import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';
import { PendingBadgeComponent } from '../pending-badge/pending-badge.component';
import { RoleService } from '../role.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, LanguageSwitcherComponent, UserMenuComponent, PendingBadgeComponent],
  template: `
    <header class="harmonia-header">
      <span class="harmonia-logo">🏡 {{ 'app.brand' | translate }}</span>
      <span class="harmonia-subtitle">{{ 'app.subtitle' | translate }}</span>
      <div class="flex-spacer"></div>
      <a routerLink="/notifications" routerLinkActive="nav-active" class="nav-link">{{ 'nav.notifications' | translate }}</a>
      <a routerLink="/financial" routerLinkActive="nav-active" class="nav-link">{{ 'nav.finance' | translate }}</a>
      <a routerLink="/reservations" routerLinkActive="nav-active" class="nav-link">{{ 'nav.reservations' | translate }}</a>
      <a routerLink="/directory" routerLinkActive="nav-active" class="nav-link">{{ 'nav.directory' | translate }}</a>
      @if (isAdmin) {
        <span class="admin-menu" (mouseleave)="adminOpen = false">
          <a class="nav-link" (click)="adminOpen = !adminOpen">{{ 'nav.administration' | translate }} ▾<app-pending-badge /></a>
          @if (adminOpen) {
            <div class="admin-dropdown">
              <a routerLink="/counterparties" routerLinkActive="nav-active" class="admin-item" (click)="adminOpen = false">{{ 'nav.counterparties' | translate }}</a>
              <a routerLink="/households" routerLinkActive="nav-active" class="admin-item" (click)="adminOpen = false">{{ 'nav.households' | translate }}</a>
              <a routerLink="/admin-pending" routerLinkActive="nav-active" class="admin-item" (click)="adminOpen = false">{{ 'nav.adminPending' | translate }}<app-pending-badge /></a>
            </div>
          }
        </span>
      }
      <a routerLink="/privacy" routerLinkActive="nav-active" class="nav-link">{{ 'nav.privacy' | translate }}</a>
      @if (isAdmin) {
        <span class="role-toggle">
          <button [class.role-active]="role === 'resident'" (click)="setRole('resident')" class="role-btn">{{ 'app.roleResident' | translate }}</button>
          <button [class.role-active]="role === 'admin'" (click)="setRole('admin')" class="role-btn">{{ 'app.roleAdmin' | translate }}</button>
        </span>
      }
      <app-language-switcher />
      <app-user-menu />
    </header>
  `,
  styles: [`
    .harmonia-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 2rem;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }

    .harmonia-logo   { font-size: 1.25rem; font-weight: 700; letter-spacing: -.5px; }
    .harmonia-subtitle { font-size: 0.875rem; opacity: .8; }
    .flex-spacer     { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; cursor: pointer; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }

    .role-toggle { display: flex; gap: 0; border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; overflow: hidden; }
    .role-btn { background: transparent; color: rgba(255,255,255,0.8); border: none; padding: 0.375rem 1rem; font-size: 0.8125rem; cursor: pointer; }
    .role-btn:hover { background: rgba(255,255,255,0.1); }
    .role-active { background: rgba(255,255,255,0.22) !important; color: white !important; font-weight: 600; }

    .admin-menu { position: relative; }
    .admin-dropdown {
      position: absolute; top: 100%; right: 0; z-index: 20; min-width: 12rem;
      background: var(--p-primary-color); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.25);
      display: flex; flex-direction: column; padding: 0.25rem;
    }
    .admin-item { color: rgba(255,255,255,.85); text-decoration: none; padding: 8px 12px; border-radius: 6px; font-size: .875rem; white-space: nowrap; }
    .admin-item:hover, .admin-item.nav-active { background: rgba(255,255,255,.18); color: #fff; }
  `],
})
export class NavComponent {
  readonly isAdmin = inject(RoleService).isAdmin;
  @Input() role: 'resident' | 'admin' = 'resident';
  @Output() roleChange = new EventEmitter<'resident' | 'admin'>();
  adminOpen = false;

  setRole(role: 'resident' | 'admin') {
    this.role = role;
    this.roleChange.emit(role);
  }
}
