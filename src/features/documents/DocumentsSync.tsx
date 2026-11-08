import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/use-auth';
import { authManager } from '@/features/auth/auth-manager';
import { clearStoredDeletions, listenDocuments, restoreTrackedDeletions } from './document-sync';

export function DocumentsSync() {
  const { user, status } = useAuth();
  const client = useQueryClient();
  const userId = status === 'authenticated' ? user?.id : undefined;
  useEffect(() => {
    if (!userId) return;
    restoreTrackedDeletions(client, userId);
    const stop = listenDocuments(client, userId);
    return () => {
      stop();
      const state = authManager.getSnapshot();
      if (state.status !== 'authenticated' || state.user?.id !== userId)
        clearStoredDeletions(userId);
    };
  }, [client, userId]);
  return null;
}
