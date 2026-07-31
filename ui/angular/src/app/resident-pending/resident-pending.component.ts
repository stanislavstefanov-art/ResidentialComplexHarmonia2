import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { MeService } from '../me.service';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-resident-pending',
  standalone: true,
  imports: [TranslatePipe, LanguageSwitcherComponent],
  template: `
    <div class="pending-shell">
      <div class="pending-lang">
        <app-language-switcher />
      </div>
      <i class="pi pi-home pending-icon"></i>
      <h2 data-testid="pending-heading" class="pending-heading">{{ 'residentPending.heading' | translate }}</h2>
      <p data-testid="pending-body" class="pending-body">
        {{ 'residentPending.body' | translate }}
      </p>
      <div class="pending-actions">
        <button
          data-testid="check-again-btn"
          class="btn-primary"
          [disabled]="checking()"
          (click)="checkAgain()"
        >
          @if (checking()) {
            <i class="pi pi-spin pi-spinner"></i>
          } @else {
            {{ 'residentPending.checkAgain' | translate }}
          }
        </button>
        <button data-testid="sign-out-btn" class="btn-secondary" (click)="signOut()">
          {{ 'residentPending.signOut' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pending-shell {
      display: flex; flex-direction: column; align-items: center; margin-top: 4rem; gap: 1rem;
    }
    .pending-lang { align-self: flex-end; margin-right: 1rem; }
    .pending-icon { font-size: 3rem; color: var(--p-primary-color, #2e6b4f); }
    .pending-heading { margin: 0; font-size: 1.5rem; font-weight: 700; }
    .pending-body {
      max-width: 480px; text-align: center; color: var(--p-text-muted-color, #666); margin: 0;
    }
    .pending-actions { display: flex; gap: 1rem; margin-top: 0.5rem; }
    .btn-primary {
      background: var(--p-primary-color, #2e6b4f); color: white; border: none;
      padding: 0.75rem 1.5rem; border-radius: 6px; font-size: 1rem; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary {
      background: transparent; color: var(--p-text-color, #333);
      border: 1px solid var(--p-surface-border, #ccc);
      padding: 0.75rem 1.5rem; border-radius: 6px; font-size: 1rem; cursor: pointer;
    }
  `],
})
export class ResidentPendingComponent {
  @Output() activated = new EventEmitter<void>();

  private readonly meService = inject(MeService);
  private readonly authService = inject(MsalService);

  checking = signal(false);

  checkAgain(): void {
    this.checking.set(true);
    this.meService.getStatus().subscribe({
      next: (res) => {
        this.checking.set(false);
        if (res.status !== 'pending') {
          this.activated.emit();
        }
      },
      error: () => {
        this.checking.set(false);
        this.activated.emit();
      },
    });
  }

  signOut(): void {
    this.authService.logoutRedirect();
  }
}
