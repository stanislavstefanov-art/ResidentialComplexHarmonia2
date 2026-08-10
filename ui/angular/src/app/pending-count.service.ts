import { Injectable, inject, signal } from '@angular/core';
import { AdminPendingService } from './admin-pending/admin-pending.service';

@Injectable({ providedIn: 'root' })
export class PendingCountService {
  private readonly svc = inject(AdminPendingService);
  readonly count = signal(0);
  private started = false;
  private intervalId?: ReturnType<typeof setInterval>;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.poll();
    this.intervalId = setInterval(() => this.poll(), 60_000);
  }

  refresh(): void { this.poll(); }

  private poll(): void {
    this.svc.listPending().subscribe({
      next: rows => this.count.set(rows.length),
      error: () => {},
    });
  }
}
