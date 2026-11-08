import { describe, expect, it } from 'vitest';
import { makeSnapshot } from '@/features/conversations/chat-turn';

describe('Snapshot lượt chat', () => {
  it('chuẩn hóa nội dung, bỏ scope khi dùng toàn thư viện và tách bản sao danh sách', () => {
    expect(makeSnapshot('  Câu hỏi\r\n thứ hai  ', [])).toEqual({ content: 'Câu hỏi\n thứ hai' });
    const ids = ['b', 'a', 'a'];
    const result = makeSnapshot('hỏi', ids);
    ids.push('c');
    expect(result).toEqual({ content: 'hỏi', documentIds: ['a', 'b'] });
  });
  it('kiểm tra giới hạn theo Unicode code point', () => {
    expect(() => makeSnapshot('  ', [])).toThrow();
    expect(() => makeSnapshot('😀'.repeat(4000), [])).not.toThrow();
    expect(() => makeSnapshot('😀'.repeat(4001), [])).toThrow();
    expect(() =>
      makeSnapshot(
        'hỏi',
        Array.from({ length: 21 }, (_, index) => String(index)),
      ),
    ).toThrow();
  });
});
