import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import type { PageParams } from '@/api/types';

// Include the authenticated user in every private key; never put tokens in query keys.
export const queryKeys = {
  documents: (userId: string) => ['user', userId, 'documents'] as const,
  documentList: (userId: string, page: PageParams) =>
    [...queryKeys.documents(userId), 'list', page] as const,
  document: (userId: string, id: string) => [...queryKeys.documents(userId), 'detail', id] as const,
  conversations: (userId: string) => ['user', userId, 'conversations'] as const,
  conversationList: (userId: string, page: PageParams) =>
    [...queryKeys.conversations(userId), 'list', page] as const,
  messages: (userId: string, id: string) =>
    [...queryKeys.conversations(userId), id, 'messages'] as const,
  conversationDraft: (userId: string, id: string) => ['user', userId, 'chat-drafts', id] as const,
  usage: (userId: string) => ['user', userId, 'usage'] as const,
};
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        count < 1 &&
        error instanceof ApiError &&
        (error.code === 'NETWORK_ERROR' ||
          error.code === 'TIMEOUT' ||
          (error.status !== undefined && error.status >= 500)),
    },
    mutations: { retry: false },
  },
});
export async function clearSessionCache(): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
}
export const invalidateUserData = {
  documents: (userId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.documents(userId) }),
  conversations: (userId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.conversations(userId) }),
  usage: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.usage(userId) }),
};
