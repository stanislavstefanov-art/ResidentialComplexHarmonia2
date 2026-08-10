import { useEffect, useState } from 'react';

export function useSlowLoad(isLoading: boolean, delay = 5000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isLoading) { setSlow(false); return; }
    const timer = setTimeout(() => setSlow(true), delay);
    return () => clearTimeout(timer);
  }, [isLoading, delay]);
  return slow;
}
