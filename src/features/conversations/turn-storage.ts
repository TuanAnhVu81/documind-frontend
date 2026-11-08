import type { TurnState } from './chat-turn';

const prefix = 'documind-pending-turn:';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storageKey = (userId: string, id: string) => `${prefix}${userId}:${id}`;
const blockedTurn = (userId: string, id: string): TurnState => ({
  userId,
  conversationId: id,
  key: '',
  body: { content: '' },
  phase: 'unavailable',
  partial: '',
  notice:
    'Không thể đọc trạng thái lượt gửi đã lưu. Hãy kiểm tra dữ liệu phiên trong trình duyệt trước khi gửi tiếp.',
});

// Session storage is tab-scoped and contains the question, scope and idempotency key, never tokens.
export function savePendingTurn(state: TurnState): boolean {
  try {
    sessionStorage.setItem(
      storageKey(state.userId, state.conversationId),
      JSON.stringify({
        userId: state.userId,
        conversationId: state.conversationId,
        key: state.key,
        body: state.body,
        assistantId: state.assistantId,
        userMessageId: state.userMessageId,
        accepted: state.accepted,
        retryUntil: state.retryUntil,
        phase: state.phase,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function readPendingTurn(userId: string, id: string): TurnState | undefined {
  try {
    const raw = sessionStorage.getItem(storageKey(userId, id));
    if (!raw) return undefined;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return blockedTurn(userId, id);
    const item = value as Record<string, unknown>;
    const body = item.body as Record<string, unknown> | null;
    if (
      item.userId !== userId ||
      item.conversationId !== id ||
      typeof item.key !== 'string' ||
      !uuid.test(item.key) ||
      !body ||
      typeof body.content !== 'string' ||
      !body.content.trim() ||
      Array.from(body.content).length > 4000 ||
      (body.documentIds !== undefined &&
        (!Array.isArray(body.documentIds) ||
          !body.documentIds.length ||
          body.documentIds.length > 20 ||
          body.documentIds.some((x: unknown) => typeof x !== 'string' || !uuid.test(x)) ||
          new Set(body.documentIds).size !== body.documentIds.length))
    )
      return blockedTurn(userId, id);
    const assistantId =
      typeof item.assistantId === 'string' && uuid.test(item.assistantId)
        ? item.assistantId
        : undefined;
    const userMessageId =
      typeof item.userMessageId === 'string' && uuid.test(item.userMessageId)
        ? item.userMessageId
        : undefined;
    const retryUntil =
      typeof item.retryUntil === 'number' && Number.isFinite(item.retryUntil)
        ? item.retryUntil
        : undefined;
    const cooling = item.phase === 'failed' && retryUntil !== undefined;
    return {
      userId,
      conversationId: id,
      key: item.key,
      body:
        body.documentIds === undefined
          ? { content: body.content }
          : { content: body.content, documentIds: body.documentIds as string[] },
      assistantId,
      userMessageId,
      accepted: item.accepted === true,
      retryUntil,
      phase: cooling ? 'failed' : assistantId ? 'reconciling' : 'uncertain',
      partial: '',
      notice: cooling
        ? 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ trước khi thử lại.'
        : 'Đang đối soát lượt gửi trước khi tải lại trang.',
      canRetrySame: !cooling && !assistantId,
    };
  } catch {
    return blockedTurn(userId, id);
  }
}
export function removePendingTurn(userId: string, id: string) {
  try {
    sessionStorage.removeItem(storageKey(userId, id));
  } catch {
    /* storage unavailable */
  }
}
export function clearPendingTurns() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}
