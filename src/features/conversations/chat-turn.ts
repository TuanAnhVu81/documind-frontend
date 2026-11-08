import { chatApi } from '@/api/chat';
import { ApiError } from '@/api/errors';
import type { ChatEvents, ChatRequest, GenerationUsage, Message } from '@/api/types';
import { queryClient, queryKeys } from '@/app/query-client';
import { authManager } from '@/features/auth/auth-manager';
import { documentToken } from '@/features/documents/document-auth';
import { SseParser } from './sse-parser';
import { historyConfirmsDone, readWithIdleTimeout, retryAfterDeadline } from './stream-utils';
import { removePendingTurn, savePendingTurn } from './turn-storage';

export type ChatPhase =
  'sending' | 'streaming' | 'reconciling' | 'uncertain' | 'failed' | 'complete' | 'unavailable';
export type TurnState = {
  userId: string;
  conversationId: string;
  key: string;
  body: ChatRequest;
  phase: ChatPhase;
  partial: string;
  assistantId?: string;
  userMessageId?: string;
  canonical?: Message;
  usage?: GenerationUsage;
  notice?: string;
  requestId?: string;
  retryAfter?: string;
  canRetrySame?: boolean;
  canRetryNew?: boolean;
  accepted?: boolean;
  retryUntil?: number;
  canonicalReceivedAt?: number;
};
const active = new Map<string, AbortController>();
const cacheKey = (user: string, id: string) => [...queryKeys.chatGenerations(user), id] as const;
export { cacheKey as generationKey };
function mapKey(user: string, id: string) {
  return `${user}:${id}`;
}
function current(user: string, id: string) {
  return queryClient.getQueryData<TurnState>(cacheKey(user, id));
}
function update(user: string, id: string, key: string, change: Partial<TurnState>) {
  if (authManager.getSnapshot().user?.id !== user) return;
  queryClient.setQueryData<TurnState>(cacheKey(user, id), (state) => {
    if (state?.key !== key) return state;
    const next = { ...state, ...change };
    if (
      next.phase === 'complete' ||
      next.phase === 'unavailable' ||
      (next.phase === 'failed' && !(next.retryUntil && next.retryUntil > Date.now()))
    )
      removePendingTurn(user, id);
    else savePendingTurn(next);
    return next;
  });
}
export function makeSnapshot(content: string, selected: string[]): ChatRequest {
  const text = content.replace(/\r\n?/g, '\n').trim();
  if (!text || Array.from(text).length > 4000) throw new Error('Câu hỏi cần từ 1 đến 4.000 ký tự.');
  const ids = [...new Set(selected)].sort();
  if (ids.length > 20) throw new Error('Chỉ được chọn tối đa 20 tài liệu.');
  return ids.length ? { content: text, documentIds: ids } : { content: text };
}
export function beginTurn(user: string, id: string, body: ChatRequest) {
  const existing = current(user, id);
  if (
    active.has(mapKey(user, id)) ||
    existing?.phase === 'reconciling' ||
    existing?.phase === 'uncertain' ||
    existing?.phase === 'unavailable' ||
    (existing?.retryUntil !== undefined && existing.retryUntil > Date.now())
  )
    return false;
  const snapshot: ChatRequest = body.documentIds
    ? { content: body.content, documentIds: [...body.documentIds] }
    : { content: body.content };
  const state: TurnState = {
    userId: user,
    conversationId: id,
    key: crypto.randomUUID(),
    body: snapshot,
    phase: 'sending',
    partial: '',
  };
  if (!savePendingTurn(state))
    throw new Error(
      'Không thể lưu trạng thái lượt gửi trong trình duyệt. Hãy cho phép lưu dữ liệu phiên rồi thử lại.',
    );
  queryClient.setQueryData(cacheKey(user, id), state);
  void run(state);
  return true;
}
export function retrySameTurn(user: string, id: string) {
  const state = current(user, id);
  if (
    !state?.canRetrySame ||
    active.has(mapKey(user, id)) ||
    (state.retryUntil !== undefined && state.retryUntil > Date.now())
  )
    return;
  void run({
    ...state,
    phase: 'sending',
    partial: '',
    canonical: undefined,
    notice: undefined,
    canRetrySame: false,
  });
}
export function retryNewTurn(user: string, id: string) {
  const state = current(user, id);
  if (!state?.canRetryNew || active.has(mapKey(user, id))) return;
  beginTurn(user, id, state.body);
}
export function stopTurn(user: string, id: string) {
  const state = current(user, id);
  if (!state || !active.has(mapKey(user, id))) return;
  update(user, id, state.key, {
    phase: 'reconciling',
    notice: 'Đã dừng nhận phản hồi. Đang kiểm tra trạng thái trên máy chủ.',
    canRetrySame: false,
  });
  active.get(mapKey(user, id))?.abort();
}
export function discardTurn(user: string, id: string) {
  active.get(mapKey(user, id))?.abort();
  active.delete(mapKey(user, id));
  queryClient.removeQueries({ queryKey: cacheKey(user, id) });
  removePendingTurn(user, id);
}
export function discardUserTurns(user: string) {
  for (const [key, controller] of active) if (key.startsWith(`${user}:`)) controller.abort();
  const turns = queryClient.getQueriesData<TurnState>({
    queryKey: queryKeys.chatGenerations(user),
  });
  for (const [key, value] of turns) {
    if (key.length === 4 && value?.key && value.phase !== 'unavailable') {
      const reconcile =
        value.phase === 'sending' ||
        value.phase === 'streaming' ||
        value.phase === 'reconciling' ||
        value.phase === 'complete';
      update(
        user,
        value.conversationId,
        value.key,
        reconcile
          ? {
              partial: '',
              canonical: undefined,
              phase: 'reconciling',
              notice: 'Nguồn tài liệu thay đổi. Đang kiểm tra lại lịch sử.',
              canRetrySame: false,
            }
          : { partial: '', canonical: undefined },
      );
    }
  }
}
export function reconcileTurn(user: string, id: string, messages: Message[], historyRequestAt = 0) {
  const state = current(user, id);
  if (!state || active.has(mapKey(user, id))) return;
  if (
    state.phase === 'complete' &&
    state.canonical &&
    state.canonicalReceivedAt !== undefined &&
    historyConfirmsDone(messages, state.canonical.id, state.canonicalReceivedAt, historyRequestAt)
  ) {
    update(user, id, state.key, { canonical: undefined, partial: '' });
    return;
  }
  if (state.phase !== 'reconciling') return;
  if (
    !state.assistantId &&
    messages.length &&
    !messages.some((item) => item.status === 'GENERATING')
  ) {
    update(user, id, state.key, {
      phase: 'uncertain',
      partial: '',
      notice: 'Không xác định được lượt đang theo dõi. Kiểm tra lại yêu cầu với cùng khóa.',
      canRetrySame: true,
    });
    return;
  }
  const assistant = state.assistantId
    ? messages.find((item) => item.id === state.assistantId)
    : undefined;
  if (assistant && assistant.status !== 'GENERATING') {
    if (!state.accepted) {
      update(user, id, state.key, {
        phase: 'uncertain',
        partial: '',
        notice: 'Lượt đang chạy đã kết thúc. Có thể kiểm tra lại yêu cầu của bạn với cùng khóa.',
        canRetrySame: true,
      });
      return;
    }
    update(user, id, state.key, {
      phase: assistant.status === 'COMPLETE' ? 'complete' : 'failed',
      partial: '',
      notice:
        assistant.status === 'COMPLETE'
          ? 'Đã nhận kết quả từ lịch sử.'
          : 'Lượt trả lời chưa hoàn tất. Bạn có thể chủ động thử lại.',
      canRetryNew: assistant.status !== 'COMPLETE',
      canRetrySame: false,
    });
  }
}
export function markConversationUnavailable(user: string, id: string) {
  const state = current(user, id);
  if (!state || state.phase === 'unavailable') return;
  active.get(mapKey(user, id))?.abort();
  update(user, id, state.key, {
    phase: 'unavailable',
    partial: '',
    canonical: undefined,
    canRetrySame: false,
    canRetryNew: false,
    notice: 'Hội thoại không còn tồn tại hoặc bạn không có quyền truy cập.',
  });
}
async function run(initial: TurnState) {
  const { userId: user, conversationId: id, key } = initial;
  const slot = mapKey(user, id);
  if (active.has(slot)) return;
  const controller = new AbortController();
  active.set(slot, controller);
  queryClient.setQueryData(cacheKey(user, id), initial);
  const untrack = authManager.trackStream(controller);
  let terminal = false;
  let started = false;
  let idleTimedOut = false;
  let pending = '';
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (pending) {
      const text = pending;
      pending = '';
      const old = current(user, id);
      update(user, id, key, { partial: (old?.partial ?? '') + text });
    }
  };
  try {
    const stream = await chatApi.stream(await documentToken(user), id, key, initial.body, {
      signal: controller.signal,
    });
    const reader = stream.getReader();
    const parser = new SseParser(({ event, data }) => {
      if (terminal || controller.signal.aborted) return;
      const value: unknown = JSON.parse(data);
      if (!value || typeof value !== 'object') throw new Error('Phản hồi SSE không hợp lệ.');
      if (event === 'heartbeat') return;
      if (event === 'start') {
        const start = value as ChatEvents['start'];
        if (
          started ||
          typeof start.assistantMessageId !== 'string' ||
          typeof start.userMessageId !== 'string'
        )
          throw new Error('Sự kiện start không hợp lệ.');
        started = true;
        update(user, id, key, {
          phase: 'streaming',
          assistantId: start.assistantMessageId,
          userMessageId: start.userMessageId,
          notice: undefined,
          accepted: true,
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.messages(user, id) });
      } else if (event === 'token') {
        const token = value as ChatEvents['token'];
        if (!started || typeof token.text !== 'string')
          throw new Error('Sự kiện token không hợp lệ.');
        pending += token.text;
        if (!flushTimer)
          flushTimer = setTimeout(() => {
            flushTimer = undefined;
            flush();
          }, 50);
      } else if (event === 'sources') {
        if (!started || !Array.isArray((value as ChatEvents['sources']).sources))
          throw new Error('Sự kiện nguồn không hợp lệ.');
      } else if (event === 'done') {
        const done = value as ChatEvents['done'];
        if (
          !started ||
          !done.message ||
          done.message.id !== current(user, id)?.assistantId ||
          done.message.conversationId !== id ||
          done.message.status !== 'COMPLETE' ||
          done.message.role !== 'ASSISTANT' ||
          typeof done.message.content !== 'string' ||
          !Array.isArray(done.message.sources)
        )
          throw new Error('Sự kiện done không hợp lệ.');
        terminal = true;
        pending = '';
        update(user, id, key, {
          phase: 'complete',
          partial: '',
          canonical: done.message,
          canonicalReceivedAt: performance.now(),
          usage: done.usage,
          notice: 'Đã hoàn tất.',
          canRetrySame: false,
        });
      } else if (event === 'error') {
        const error = value as ChatEvents['error'];
        terminal = true;
        if (error.discardPartial) {
          pending = '';
          update(user, id, key, { partial: '', canonical: undefined });
        } else flush();
        update(user, id, key, {
          phase: 'reconciling',
          assistantId:
            typeof error.assistantMessageId === 'string'
              ? error.assistantMessageId
              : current(user, id)?.assistantId,
          notice: 'Lượt trả lời gặp lỗi. Đang kiểm tra lịch sử.',
          requestId: error.requestId,
          canRetrySame: false,
        });
      }
    });
    try {
      while (!terminal) {
        const chunk = await readWithIdleTimeout(reader, 60000, () => {
          idleTimedOut = true;
          controller.abort();
        });
        if (chunk.done) {
          parser.finish();
          break;
        }
        parser.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!terminal && !controller.signal.aborted)
      update(user, id, key, {
        phase: started ? 'reconciling' : 'uncertain',
        notice: 'Kết nối kết thúc trước khi nhận kết quả. Đang kiểm tra lịch sử.',
        canRetrySame: !started,
      });
  } catch (error) {
    if (!controller.signal.aborted) {
      const api = error instanceof ApiError ? error : undefined;
      if (api?.code === 'GENERATION_IN_PROGRESS' || api?.code === 'GENERATION_NOT_REPLAYABLE') {
        update(user, id, key, {
          phase: 'reconciling',
          assistantId: api.assistantMessageId,
          accepted: api.code === 'GENERATION_NOT_REPLAYABLE' || initial.accepted,
          notice: api.message,
          requestId: api.requestId,
          retryAfter: api.retryAfter,
          canRetrySame: false,
        });
      } else if (api && api.status !== undefined && api.status < 500) {
        const text =
          api.status === 404
            ? 'Không tìm thấy hội thoại hoặc tài liệu đã chọn; hãy kiểm tra quyền truy cập.'
            : api.message;
        update(user, id, key, {
          phase: 'failed',
          notice: text,
          requestId: api.requestId,
          retryAfter: api.retryAfter,
          retryUntil: api.status === 429 ? retryAfterDeadline(api.retryAfter) : undefined,
          canRetrySame: false,
        });
      } else {
        update(user, id, key, {
          phase: started ? 'reconciling' : 'uncertain',
          notice: 'Kết nối gián đoạn; đang kiểm tra lịch sử trước khi thử lại.',
          canRetrySame: !started,
        });
      }
    }
  } finally {
    if (flushTimer) clearTimeout(flushTimer);
    pending = '';
    if (active.get(slot) === controller) active.delete(slot);
    untrack();
    if (authManager.getSnapshot().user?.id === user) {
      const state = current(user, id);
      if (
        state?.phase !== 'unavailable' &&
        controller.signal.aborted &&
        state?.key === key &&
        !state.assistantId
      )
        update(user, id, key, {
          phase: 'uncertain',
          notice: idleTimedOut
            ? 'Kết nối không còn phản hồi; chưa xác định yêu cầu đã được tiếp nhận.'
            : 'Đã dừng nhận phản hồi; chưa xác định yêu cầu đã được tiếp nhận.',
          canRetrySame: true,
        });
      else if (
        state?.phase !== 'unavailable' &&
        controller.signal.aborted &&
        state?.key === key &&
        state.phase !== 'reconciling'
      )
        update(user, id, key, {
          phase: 'reconciling',
          notice: idleTimedOut
            ? 'Kết nối không còn phản hồi. Đang kiểm tra trạng thái trên máy chủ.'
            : 'Đã dừng nhận phản hồi. Đang kiểm tra trạng thái trên máy chủ.',
        });
      if (state?.phase !== 'unavailable') {
        await queryClient.cancelQueries({ queryKey: queryKeys.messages(user, id) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.messages(user, id) });
        void queryClient.invalidateQueries({
          queryKey: [...queryKeys.conversations(user), 'sidebar'],
        });
      }
    }
  }
}
