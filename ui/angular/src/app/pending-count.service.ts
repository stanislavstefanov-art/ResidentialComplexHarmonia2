import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AdminPendingService } from './admin-pending/admin-pending.service';

/**
 * Shortest gap between two automatic refreshes. Tab switching is bursty, and
 * without this a few flips back and forth would each cost a request.
 */
const MIN_REFRESH_GAP_MS = 60_000;

/**
 * Tracks how many sign-ups are waiting for admin approval.
 *
 * Refreshes when the admin comes back to the tab — deliberately NOT on an
 * interval. The previous `setInterval(poll, 60_000)` kept the serverless
 * database awake around the clock: its auto-pause delay is 60 minutes (Azure's
 * hard minimum), so any poll faster than that reset the countdown before it
 * could ever fire. An idle database still bills ~2,435 vCore-seconds per hour,
 * which exhausted the whole monthly free allowance in about 41 hours of uptime.
 */
@Injectable({ providedIn: 'root' })
export class PendingCountService {
  private readonly svc = inject(AdminPendingService);
  private readonly destroyRef = inject(DestroyRef);
  readonly count = signal(0);
  private started = false;
  private lastFetchedAt = 0;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.poll();

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.lastFetchedAt < MIN_REFRESH_GAP_MS) return;
      this.poll();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', onVisibilityChange));
  }

  /** Forced refresh after an explicit admin action — deliberately skips the throttle. */
  refresh(): void { this.poll(); }

  private poll(): void {
    this.lastFetchedAt = Date.now();
    this.svc.listPending().subscribe({
      next: rows => this.count.set(rows.length),
      error: () => {},
    });
  }
}
