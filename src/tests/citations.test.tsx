import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { Message, Source } from '@/api/types';
import { MessageBubble } from '@/features/conversations/ChatPage';
import { CitationPanel } from '@/features/conversations/CitationPanel';
import {
  citationSource,
  citationText,
  safeSources,
  sourceLocation,
} from '@/features/conversations/citation-utils';

const source: Source = {
  sourceId: 'S1',
  documentId: 'doc-1',
  filename: 'Chính sách.pdf',
  locationType: 'PAGE',
  pageNumber: 3,
  paragraphIndex: null,
  startOffset: null,
  endOffset: null,
  snippet: 'Nội dung quan trọng <không phải HTML>.',
  availability: 'AVAILABLE',
};
const base: Message = {
  id: 'message-1',
  conversationId: 'chat',
  ordinal: 1,
  role: 'ASSISTANT',
  content: 'Thông tin [S1], nhãn lạ [S9], `mã [S1]`.',
  status: 'COMPLETE',
  outcome: 'ANSWER',
  sources: [source],
  createdAt: '2026-01-01T00:00:00Z',
};

afterEach(cleanup);
describe('Nguồn trích dẫn', () => {
  it('biến nhãn khớp nguồn thành nút và giữ mã/nhãn lạ là văn bản', () => {
    const select = vi.fn();
    render(<MessageBubble item={base} onSelect={select} />);
    const chip = screen.getByRole('button', { name: /Xem nguồn S1/ });
    fireEvent.click(chip);
    expect(select).toHaveBeenCalledWith({ messageId: 'message-1', sourceId: 'S1' }, chip);
    expect(screen.getByText('mã [S1]').tagName).toBe('CODE');
    expect(screen.queryByRole('button', { name: /S9/ })).not.toBeInTheDocument();
  });
  it('không tạo nút từ nội dung đang stream hoặc lời từ chối không nguồn', () => {
    const select = vi.fn();
    const { rerender } = render(
      <MessageBubble item={{ ...base, status: 'GENERATING' }} onSelect={select} />,
    );
    expect(screen.queryByRole('button', { name: /Xem nguồn/ })).not.toBeInTheDocument();
    rerender(
      <MessageBubble
        item={{ ...base, outcome: 'NO_EVIDENCE', sources: [], content: 'Không tìm thấy tài liệu.' }}
        onSelect={select}
      />,
    );
    expect(screen.queryByRole('button', { name: /Xem nguồn/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('tra S1 theo từng message, không theo thứ tự mảng', () => {
    const second: Message = {
      ...base,
      id: 'message-2',
      sources: [
        {
          ...source,
          filename: 'Thứ hai.txt',
          locationType: 'PARAGRAPH',
          paragraphIndex: 2,
          pageNumber: null,
        },
      ],
    };
    expect(
      citationSource([second, base], { messageId: 'message-1', sourceId: 'S1' })?.filename,
    ).toBe('Chính sách.pdf');
    expect(
      citationSource([second, base], { messageId: 'message-2', sourceId: 'S1' })?.filename,
    ).toBe('Thứ hai.txt');
    expect(
      citationSource([second, base], { messageId: 'message-2', sourceId: 'S2' }),
    ).toBeUndefined();
  });
  it('nguồn đã xóa không để lộ tên hoặc snippet, kể cả khi dữ liệu cũ còn trong DTO', () => {
    const redacted = safeSources([source], new Set(['doc-1']))[0];
    render(<CitationPanel source={redacted} onClose={() => {}} />);
    expect(screen.getByText('Nguồn đã xóa')).toBeInTheDocument();
    expect(screen.queryByText('Chính sách.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nội dung quan trọng/)).not.toBeInTheDocument();
    expect(citationText({ ...source, availability: 'DELETED' })).not.toContain(source.snippet);
    expect(citationText({ ...source, availability: 'DELETED' })).not.toContain(source.filename);
  });
  it('hiển thị vị trí trang, đoạn, offsets và null đúng nghĩa', () => {
    expect(sourceLocation(source)).toBe('Trang 3');
    expect(sourceLocation({ ...source, pageNumber: null })).toBe('Trang chưa xác định');
    expect(
      sourceLocation({
        ...source,
        locationType: 'PARAGRAPH',
        paragraphIndex: 4,
        startOffset: 0,
        endOffset: 15,
      }),
    ).toContain('Đoạn 4 · Ký tự 0–15');
    expect(
      sourceLocation({
        ...source,
        locationType: 'PARAGRAPH',
        paragraphIndex: null,
        startOffset: null,
        endOffset: null,
      }),
    ).toBe('Đoạn chưa xác định');
  });
  it('cảnh báo ANSWER hoàn tất không nguồn nhưng không dựng citation giả', () => {
    render(<MessageBubble item={{ ...base, sources: [] }} onSelect={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('không có nguồn trích dẫn');
    expect(screen.queryByRole('button', { name: /Xem nguồn/ })).not.toBeInTheDocument();
  });
  it('cảnh báo khi có nguồn nhưng nội dung không có nhãn khớp hoặc có nhãn lạ', () => {
    const { rerender } = render(
      <MessageBubble
        item={{ ...base, content: 'Nội dung không có citation.' }}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('không có nguồn trích dẫn hợp lệ');
    rerender(
      <MessageBubble
        item={{ ...base, content: 'Nội dung [S1] và nhãn lạ [S9].' }}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Xem nguồn S1/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('nhãn nguồn không khớp');
    rerender(
      <MessageBubble
        item={{ ...base, content: 'Nguồn chỉ nằm trong `mã [S1]`.' }}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('không có nguồn trích dẫn hợp lệ');
  });
});
