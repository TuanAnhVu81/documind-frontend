import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '@/api/types';
import { MessageBubble } from '@/features/conversations/ChatPage';

const message: Message = {
  id: '1',
  conversationId: 'chat-1',
  ordinal: 1,
  role: 'ASSISTANT',
  content:
    'Một [liên kết](https://example.com)\n\n![ảnh](https://example.com/tracker.png)\n\n<script>alert(1)</script>\n\n```js\nconst x = 1;\n```',
  status: 'COMPLETE',
  outcome: 'ANSWER',
  sources: [],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Hiển thị lịch sử hội thoại', () => {
  it('render markdown an toàn và bảo vệ liên kết ngoài', () => {
    const { container } = render(<MessageBubble item={message} />);
    const link = screen.getByRole('link', { name: 'liên kết' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sao chép' })).toBeInTheDocument();
  });
});
