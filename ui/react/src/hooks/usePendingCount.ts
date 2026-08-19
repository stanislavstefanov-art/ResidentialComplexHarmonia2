import { useCallback, useEffect, useRef, useState } from 'react';
import { listPending } from '../api/adminPending';

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
 *
 * `setCount` is returned so a screen that has just fetched the list itself can
 * report the fresh number instead of triggering a second request.
 */
export function usePendingCount(isAdmin: boolean) {
  const [count, setCount] = useState(0);
  const lastFetchedAt = useRef(0);

  const fetchNow = useCallback(() => {
    lastFetchedAt.current = Date.now();
    listPending().then(r => setCount(r.length)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchNow();

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchedAt.current < MIN_REFRESH_GAP_MS) return;
      fetchNow();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isAdmin, fetchNow]);

  return { count, setCount };
}
