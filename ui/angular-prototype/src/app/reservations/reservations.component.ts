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
import { ReservationsService } from './reservations.service';
import { Slot } from './models';

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
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 Harmonia</span>
        <span class="harmonia-subtitle">Resident Portal</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link nav-active">Reservations</a>
        <a routerLink="/financial" class="nav-link">Finance</a>
        <a routerLink="/expenses" class="nav-link">Expenses</a>
        <a routerLink="/maintenance-fees" class="nav-link">Fees</a>
        <a routerLink="/payments" class="nav-link">Payments</a>
        <a routerLink="/notifications" class="nav-link">Notifications</a>
        <a routerLink="/privacy" class="nav-link">Privacy</a>
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>BBQ Reservations</ng-template>
          <ng-template #content>

            <div class="date-row">
              <label class="date-label">Select date:</label>
              <p-datepicker
                [(ngModel)]="selectedDate"
                [minDate]="today"
                dateFormat="yy-mm-dd"
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
                  label="Retry"
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
                        label="Claim"
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
              <p class="no-slots">No slots available for this day.</p>
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
        this.error.set('Could not load slots. Check your connection and try again.');
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
          this.msg.add({ severity: 'success', summary: 'Booking confirmed', detail: `Slot "${slotKey}" is now yours.` });
        } else if (r.outcome === 'refused-already-taken') {
          this.slots.update(list =>
            list.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-other' as const } : s)
          );
          this.msg.add({ severity: 'warn', summary: 'Slot taken', detail: 'Someone else just claimed this slot.' });
        } else {
          this.msg.add({ severity: 'error', summary: 'Could not confirm', detail: 'Please try again in a moment.' });
        }
      },
      error: () => {
        this.claimInFlight.set(null);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not reach the server. Please try again.' });
      },
    });
  }

  stateLabel(state: string): string {
    return state === 'free' ? 'Free' : state === 'taken-mine' ? 'Yours' : 'Taken';
  }

  stateSeverity(state: string): 'success' | 'info' | 'secondary' {
    return state === 'free' ? 'success' : state === 'taken-mine' ? 'info' : 'secondary';
  }
}
