import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { DatePicker } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { ReservationsService } from './reservations.service';
import { Slot } from './models';
import { RoleService } from '../role.service';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
    ToastModule,
    TagModule,
    DatePicker,
    TranslatePipe,
    LanguageSwitcherComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 {{ 'app.brand' | translate }}</span>
        <span class="harmonia-subtitle">{{ 'app.subtitle' | translate }}</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">{{ 'nav.directory' | translate }}</a>
        <a routerLink="/reservations" class="nav-link nav-active">{{ 'nav.reservations' | translate }}</a>
        <a routerLink="/financial" class="nav-link">{{ 'nav.finance' | translate }}</a>
        <a routerLink="/expenses" class="nav-link">{{ 'nav.expenses' | translate }}</a>
        <a routerLink="/maintenance-fees" class="nav-link">{{ 'nav.fees' | translate }}</a>
        <a routerLink="/payments" class="nav-link">{{ 'nav.payments' | translate }}</a>
        <a routerLink="/notifications" class="nav-link">{{ 'nav.notifications' | translate }}</a>
        <a routerLink="/privacy" class="nav-link">{{ 'nav.privacy' | translate }}</a>
        <a routerLink="/contact-edit" class="nav-link">{{ 'nav.contactEdit' | translate }}</a>
        @if (isAdmin) { <a routerLink="/admin-pending" class="nav-link">{{ 'nav.adminPending' | translate }}</a> }
        <app-language-switcher />
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>{{ 'reservation.bbqTitle' | translate }}</ng-template>
          <ng-template #content>

            <div class="date-row">
              <label class="date-label">{{ 'reservation.selectDate' | translate }}</label>
              <p-datepicker
                [(ngModel)]="selectedDate"
                [minDate]="today"
                [showIcon]="true"
                (ngModelChange)="onDateChange($event)"
              />
            </div>

            @if (loading()) {
              <div class="center-state">
                <p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" />
              </div>
            }

            @if (error() && !loading()) {
              <div class="center-state" data-testid="error-state">
                <p class="error-msg">{{ error() }}</p>
                <p-button
                  [label]="'common.retry' | translate"
                  icon="pi pi-refresh"
                  severity="secondary"
                  data-testid="retry-btn"
                  (click)="loadSlots()"
                />
              </div>
            }

            @if (!loading() && !error() && slots().length > 0) {
              <div class="slot-grid">
                @for (slot of slots(); track slot.slotKey) {
                  <div
                    class="slot-card slot-{{ slot.state }}"
                    [attr.data-testid]="'slot-card'"
                    [attr.data-state]="slot.state"
                  >
                    <div class="slot-key">{{ slot.slotKey }}</div>
                    <p-tag
                      [value]="stateLabel(slot.state)"
                      [severity]="stateSeverity(slot.state)"
                    />
                    @if (slot.state === 'free') {
                      <p-button
                        [label]="'reservation.claim' | translate"
                        size="small"
                        data-testid="claim-btn"
                        [loading]="claimInFlight() === slot.slotKey"
                        (click)="claim(slot.slotKey)"
                      />
                    }
                  </div>
                }
              </div>
            }

            @if (!loading() && !error() && slots().length === 0 && selectedDate) {
              <p class="no-slots">{{ 'reservation.noSlots' | translate }}</p>
            }

          </ng-template>
        </p-card>
      </main>
    </div>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: #f5f5f0; }
    .harmonia-header {
      display: flex; align-items: center; gap: 12px;
      background: #2e6b4f; color: white; padding: 12px 24px;
    }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; }
    .harmonia-subtitle { opacity: .7; font-size: .85rem; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .harmonia-content { max-width: 900px; margin: 0 auto; padding: 32px 16px; }
    .date-row { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .date-label { font-weight: 500; }
    .slot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-top: 8px; }
    .slot-card { background: white; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .slot-free { border-left: 4px solid #2e6b4f; }
    .slot-taken-mine { border-left: 4px solid #1976d2; }
    .slot-taken-other { border-left: 4px solid #9e9e9e; }
    .slot-key { font-weight: 600; text-transform: capitalize; }
    .center-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 48px 0; }
    .error-msg { color: #d32f2f; }
    .no-slots { color: #757575; text-align: center; padding: 32px 0; }
  `],
})
export class ReservationsComponent implements OnInit {
  private readonly svc = inject(ReservationsService);
  private readonly msg = inject(MessageService);
  private readonly t = inject(TranslateService);
  readonly isAdmin = inject(RoleService).isAdmin;

  readonly today = new Date();
  selectedDate: Date = new Date();

  readonly slots = signal<Slot[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly claimInFlight = signal<string | null>(null);

  private currentDay(): string {
    const d = this.selectedDate ?? this.today;
    return d.toISOString().slice(0, 10);
  }

  ngOnInit(): void {
    this.loadSlots();
  }

  loadSlots(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getSlots(this.currentDay()).subscribe({
      next: r => {
        this.slots.set(r.slots);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t.instant('reservation.errLoad'));
        this.loading.set(false);
      },
    });
  }

  onDateChange(_date: Date): void {
    this.loadSlots();
  }

  claim(slotKey: string): void {
    this.claimInFlight.set(slotKey);
    this.svc.claimSlot(this.currentDay(), slotKey).subscribe({
      next: r => {
        this.claimInFlight.set(null);
        if (r.outcome === 'confirmed-yours') {
          this.slots.update(list =>
            list.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-mine' as const } : s)
          );
          this.msg.add({
            severity: 'success',
            summary: this.t.instant('reservation.bookingConfirmedSummary'),
            detail: this.t.instant('reservation.confirmed', { slotKey }),
          });
        } else if (r.outcome === 'refused-already-taken') {
          this.slots.update(list =>
            list.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-other' as const } : s)
          );
          this.msg.add({
            severity: 'warn',
            summary: this.t.instant('reservation.slotTakenSummary'),
            detail: this.t.instant('reservation.errTaken'),
          });
        } else {
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: this.t.instant('reservation.errConfirm'),
          });
        }
      },
      error: () => {
        this.claimInFlight.set(null);
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: this.t.instant('reservation.errNetwork'),
        });
      },
    });
  }

  stateLabel(state: string): string {
    return state === 'free'
      ? this.t.instant('reservation.free')
      : state === 'taken-mine'
        ? this.t.instant('reservation.yours')
        : this.t.instant('reservation.taken');
  }

  stateSeverity(state: string): 'success' | 'info' | 'secondary' {
    return state === 'free' ? 'success' : state === 'taken-mine' ? 'info' : 'secondary';
  }
}
