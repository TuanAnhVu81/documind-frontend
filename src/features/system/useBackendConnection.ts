import { useEffect, useState } from 'react';
import type { ConnectionState } from '@/components/feedback/BackendStatus';

export function useBackendConnection() {
  const [state, setState] = useState<ConnectionState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 6000);
    void fetch('/actuator/health', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('health request failed');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('status' in data) || data.status !== 'UP')
          throw new Error('health status unavailable');
        if (active) setState('connected');
      })
      .catch(() => {
        if (active) setState('unavailable');
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  function retry() {
    setState('checking');
    setAttempt((current) => current + 1);
  }
  return { state, retry };
}
