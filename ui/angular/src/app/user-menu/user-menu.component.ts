import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [RouterModule, TranslatePipe],
  template: `
    <div class="user-menu-wrapper">
      <button class="avatar-btn" (click)="toggle($event)">
        <span class="avatar-circle">{{ initial }}</span>
        <span class="user-name-label">{{ displayName }}</span>
      </button>
      @if (open) {
        <div class="user-dropdown">
          <div class="dropdown-user-info">
            <span class="avatar-lg">{{ initial }}</span>
            <div class="dropdown-user-text">
              <div class="dropdown-full-name">{{ displayName }}</div>
              <div class="dropdown-email">{{ email }}</div>
            </div>
          </div>
          <hr class="dropdown-hr" />
          <a routerLink="/contact-edit" class="dropdown-item" (click)="open = false">
            <i class="pi pi-user-edit"></i>
            {{ 'nav.contactEdit' | translate }}
          </a>
          <hr class="dropdown-hr" />
          <button class="dropdown-item dropdown-signout" (click)="signOut()">
            <i class="pi pi-sign-out"></i>
            {{ 'app.signOut' | translate }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .user-menu-wrapper { position: relative; display: flex; align-items: center; }

    .avatar-btn {
      display: flex; align-items: center; gap: 0.5rem;
      background: transparent; border: none; cursor: pointer; padding: 4px 8px;
      border-radius: 6px; color: rgba(255,255,255,.85);
    }
    .avatar-btn:hover { background: rgba(255,255,255,.1); }

    .avatar-circle {
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(255,255,255,.2); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8125rem; font-weight: 700; flex-shrink: 0;
    }

    .user-name-label {
      font-size: 0.8125rem; max-width: 160px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .user-dropdown {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: white; border-radius: 8px; min-width: 240px;
      box-shadow: 0 4px 20px rgba(0,0,0,.18); z-index: 9999;
      overflow: hidden; display: flex; flex-direction: column;
    }

    .dropdown-user-info {
      display: flex; align-items: center; gap: 0.875rem;
      padding: 1rem 1.125rem;
    }

    .avatar-lg {
      width: 48px; height: 48px; border-radius: 50%;
      background: var(--p-primary-color, #2e6b4f); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; font-weight: 700; flex-shrink: 0;
    }

    .dropdown-user-text { overflow: hidden; }
    .dropdown-full-name { font-weight: 600; font-size: 0.9375rem; color: #1a1a1a; }
    .dropdown-email { font-size: 0.8125rem; color: #666; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .dropdown-hr { border: none; border-top: 1px solid #e5e7eb; margin: 0; }

    .dropdown-item {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.625rem 1.125rem; font-size: 0.875rem; color: #374151;
      text-decoration: none; background: transparent; border: none;
      cursor: pointer; width: 100%; text-align: left;
    }
    .dropdown-item:hover { background: #f3f4f6; }
    .dropdown-item i { font-size: 1rem; color: #6b7280; }

    .dropdown-signout { color: #374151; }
  `],
})
export class UserMenuComponent {
  private readonly auth = inject(MsalService, { optional: true });
  open = false;

  private get account() {
    return this.auth?.instance.getActiveAccount()
      ?? this.auth?.instance.getAllAccounts()[0]
      ?? null;
  }

  get displayName(): string {
    const acc = this.account;
    return acc?.name ?? acc?.username ?? '';
  }

  get email(): string {
    return this.account?.username ?? '';
  }

  get initial(): string {
    return this.displayName.charAt(0).toUpperCase();
  }

  toggle(e: MouseEvent) {
    e.stopPropagation();
    this.open = !this.open;
  }

  @HostListener('document:click')
  onDocumentClick() { this.open = false; }

  signOut() {
    this.open = false;
    this.auth?.logoutRedirect();
  }
}
