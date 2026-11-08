import { describe, expect, it } from 'vitest';
import { SseParser, type ServerEvent } from '@/features/conversations/sse-parser';

describe('SSE parser', () => {
  it('giải mã Unicode qua từng byte, CRLF tách đôi, heartbeat và nhiều sự kiện', () => {
    const events: ServerEvent[] = [];
    const parser = new SseParser((event) => events.push(event));
    const bytes = new TextEncoder().encode(
      ': ping\r\nevent: token\r\ndata: {"text":"Tiếng Việt 👋"}\r\n\r\nevent: heartbeat\ndata: {}\n\nevent: done\ndata: {"ok":true}\n\n',
    );
    for (const byte of bytes) parser.push(Uint8Array.of(byte));
    parser.finish();
    expect(events).toEqual([
      { event: 'token', data: '{"text":"Tiếng Việt 👋"}' },
      { event: 'heartbeat', data: '{}' },
      { event: 'done', data: '{"ok":true}' },
    ]);
  });
  it('gộp nhiều dòng data và không phát sự kiện chưa kết thúc', () => {
    const events: ServerEvent[] = [];
    const parser = new SseParser((event) => events.push(event));
    parser.push(new TextEncoder().encode('event: x\rdata: một\rdata: hai\r\rdata: dở'));
    parser.finish();
    expect(events).toEqual([{ event: 'x', data: 'một\nhai' }]);
  });
});
