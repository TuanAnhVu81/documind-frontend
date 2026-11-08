import type { QueryClient } from '@tanstack/react-query';
import { authManager } from '@/features/auth/auth-manager';
import { discardUserTurns } from '@/features/conversations/chat-turn';

export type PendingDeletion = { id: string; accepted: boolean };
type Change = {
  userId: string;
  kind: 'upload' | 'delete' | 'delete-cancel';
  id?: string;
  accepted?: boolean;
  operationId?: string;
  step?: number;
  nonce: string;
};
const channelName = 'documind-documents-v1';
const storageKey = 'documind-documents-change';
const pendingPrefix = 'documind-document-deletions:';
export const deletionKey = (userId: string) =>
  ['user', userId, 'document-deletion-pending'] as const;
export function trackDeletion(client: QueryClient, userId: string, id: string, accepted: boolean) {
  client.setQueryData<PendingDeletion[]>(deletionKey(userId), (current = []) => {
    const old = current.find((item) => item.id === id);
    const next = [
      ...current.filter((item) => item.id !== id),
      { id, accepted: accepted || !!old?.accepted },
    ];
    try {
      sessionStorage.setItem(`${pendingPrefix}${userId}`, JSON.stringify(next));
    } catch {
      /* memory fallback */
    }
    return next;
  });
}
export function removeTrackedDeletion(client: QueryClient, userId: string, id: string) {
  client.setQueryData<PendingDeletion[]>(deletionKey(userId), (current = []) => {
    const next = current.filter((item) => item.id !== id);
    try {
      if (next.length) sessionStorage.setItem(`${pendingPrefix}${userId}`, JSON.stringify(next));
      else sessionStorage.removeItem(`${pendingPrefix}${userId}`);
    } catch {
      /* memory fallback */
    }
    return next;
  });
}
export function restoreTrackedDeletions(client: QueryClient, userId: string) {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(`${pendingPrefix}${userId}`) ?? '[]');
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        /^[0-9a-f-]{36}$/i.test(item.id) &&
        typeof item.accepted === 'boolean'
      ) {
        trackDeletion(client, userId, item.id, item.accepted);
      }
    }
  } catch {
    /* no saved state */
  }
}
export function clearStoredDeletions(userId: string) {
  try {
    sessionStorage.removeItem(`${pendingPrefix}${userId}`);
  } catch {
    /* no stored state */
  }
}
export function notifyDocuments(
  userId: string,
  kind: Change['kind'],
  id?: string,
  accepted?: boolean,
  operationId?: string,
  step?: number,
) {
  if (kind === 'delete') discardUserTurns(userId);
  const message: Change = {
    userId,
    kind,
    id,
    accepted,
    operationId,
    step,
    nonce: crypto.randomUUID(),
  };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage(message);
      channel.close();
    }
  } catch {
    /* use storage fallback */
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(message));
    localStorage.removeItem(storageKey);
  } catch {
    /* no storage */
  }
}
export function listenDocuments(client: QueryClient, userId: string): () => void {
  const seen = new Set<string>();
  const steps = new Map<string, number>();
  function receive(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const message = value as Partial<Change>;
    if (
      message.userId !== userId ||
      authManager.getSnapshot().user?.id !== userId ||
      typeof message.nonce !== 'string' ||
      seen.has(message.nonce) ||
      (message.kind !== 'upload' && message.kind !== 'delete' && message.kind !== 'delete-cancel')
    )
      return;
    if (message.operationId && typeof message.step === 'number') {
      const previous = steps.get(message.operationId);
      if (previous !== undefined && message.step <= previous) return;
      steps.set(message.operationId, message.step);
      if (steps.size > 100) steps.delete(steps.keys().next().value!);
    }
    seen.add(message.nonce);
    if (seen.size > 100) seen.delete(seen.values().next().value!);
    if (message.kind === 'delete') {
      discardUserTurns(userId);
      client.removeQueries({ queryKey: ['user', userId, 'conversations'] });
      if (typeof message.id === 'string')
        trackDeletion(client, userId, message.id, message.accepted === true);
    }
    if (message.kind === 'delete-cancel' && typeof message.id === 'string')
      removeTrackedDeletion(client, userId, message.id);
    void client.invalidateQueries({ queryKey: ['user', userId, 'documents'] });
  }
  let channel: BroadcastChannel | null = null;
  try {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName);
  } catch {
    /* use storage fallback */
  }
  if (channel) channel.onmessage = (event: MessageEvent<unknown>) => receive(event.data);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue) as unknown);
    } catch {
      /* ignore malformed messages */
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}
