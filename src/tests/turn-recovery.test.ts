import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TurnState } from '@/features/conversations/chat-turn';
import {
  clearPendingTurns,
  readPendingTurn,
  removePendingTurn,
  savePendingTurn,
} from '@/features/conversations/turn-storage';
import {
  historyConfirmsDone,
  readWithIdleTimeout,
  retryAfterDeadline,
} from '@/features/conversations/stream-utils';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/query-client';
import { generationKey } from '@/features/conversations/chat-turn';

const user = '4b2fa155-5b24-484a-8074-327dc91320df';
const id = '44f63555-953c-473f-bd09-dcf4b501d868';
const requestKey = '39a86855-e6e5-46b2-8144-dd87b8c8fa8b';
const assistant = '6e7609c7-5e77-4fa3-a5e8-8de0e861bebb';
const turn: TurnState = {
  userId: user,
  conversationId: id,
  key: requestKey,
  body: { content: 'Câu hỏi riêng' },
  phase: 'sending',
  partial: '',
};

afterEach(() => {
  clearPendingTurns();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Đối soát generation', () => {
  it('khôi phục cùng key và payload sau reload, không lưu token hay nội dung trả lời tạm', () => {
    expect(savePendingTurn({ ...turn, partial: 'bản tạm' })).toBe(true);
    const saved = sessionStorage.getItem(`documind-pending-turn:${user}:${id}`)!;
    expect(saved).not.toContain('bản tạm');
    expect(saved).not.toContain('accessToken');
    const restored = readPendingTurn(user, id);
    expect(restored).toMatchObject({
      key: requestKey,
      body: { content: 'Câu hỏi riêng' },
      phase: 'uncertain',
      canRetrySame: true,
    });
    expect(readPendingTurn('another-user', id)).toBeUndefined();
    removePendingTurn(user, id);
    expect(readPendingTurn(user, id)).toBeUndefined();
  });
  it('khôi phục trạng thái 429 và thời điểm được phép gửi', () => {
    expect(savePendingTurn({ ...turn, phase: 'failed', retryUntil: Date.now() + 30000 })).toBe(
      true,
    );
    expect(readPendingTurn(user, id)).toMatchObject({
      phase: 'failed',
      retryUntil: expect.any(Number),
    });
  });
  it('từ chối an toàn khi lưu hoặc đọc trạng thái không thành công', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(savePendingTurn(turn)).toBe(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readPendingTurn(user, id)?.phase).toBe('unavailable');
  });
  it('không xóa generation khi cache hội thoại bị xóa', () => {
    const client = new QueryClient();
    client.setQueryData(generationKey(user, id), turn);
    client.setQueryData(queryKeys.messages(user, id), { items: [] });
    client.removeQueries({ queryKey: queryKeys.conversations(user) });
    expect(client.getQueryData(generationKey(user, id))).toEqual(turn);
    client.clear();
  });
  it('chỉ thay done bằng lịch sử được yêu cầu sau done và đã terminal', () => {
    expect(historyConfirmsDone([{ id: assistant, status: 'COMPLETE' }], assistant, 20, 19)).toBe(
      false,
    );
    expect(historyConfirmsDone([{ id: assistant, status: 'GENERATING' }], assistant, 20, 21)).toBe(
      false,
    );
    expect(historyConfirmsDone([{ id: assistant, status: 'COMPLETE' }], assistant, 20, 21)).toBe(
      true,
    );
  });
  it('áp dụng Retry-After dạng giây, ngày HTTP và fallback', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(retryAfterDeadline('12', now)).toBe(now + 12000);
    expect(retryAfterDeadline('Thu, 01 Jan 2026 00:00:20 GMT', now)).toBe(now + 20000);
    expect(retryAfterDeadline(undefined, now)).toBe(now + 1000);
  });
  it('ngắt đọc stream khi quá thời gian không nhận dữ liệu', async () => {
    vi.useFakeTimers();
    const stream = new ReadableStream<Uint8Array>({ start() {} });
    const reader = stream.getReader();
    const timeout = vi.fn();
    const pending = readWithIdleTimeout(reader, 1000, timeout);
    const rejected = expect(pending).rejects.toThrow('SSE idle timeout');
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(timeout).toHaveBeenCalledOnce();
    await reader.cancel();
    reader.releaseLock();
  });
});
