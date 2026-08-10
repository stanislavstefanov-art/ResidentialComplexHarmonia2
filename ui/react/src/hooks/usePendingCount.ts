import { useEffect, useState } from 'react';
import { listPending } from '../api/adminPending';

export function usePendingCount(isAdmin: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    const poll = () => listPending().then(r => setCount(r.length)).catch(() => {});
    poll();
    const timer = setInterval(poll, 60_000);
    return () => clearInterval(timer);
  }, [isAdmin]);
  return count;
}
