import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/app/query-client';
import { hiddenDocumentSelections } from '@/features/conversations/conversation-utils';

describe('Trạng thái hội thoại', () => {
  it('giữ bản nháp khi cache lịch sử bị xóa và xóa riêng khi cần', () => {
    const client = new QueryClient();
    const draft = queryKeys.conversationDraft('user', 'chat');
    client.setQueryData(draft, { content: 'Bản nháp', selected: ['doc'] });
    client.setQueryData(queryKeys.messages('user', 'chat'), { items: [] });
    client.removeQueries({ queryKey: queryKeys.conversations('user') });
    expect(client.getQueryData(draft)).toEqual({ content: 'Bản nháp', selected: ['doc'] });
    client.removeQueries({ queryKey: draft });
    expect(client.getQueryData(draft)).toBeUndefined();
    client.clear();
  });
  it('giữ lựa chọn không hiển thị để người dùng có thể bỏ chọn', () => {
    expect(hiddenDocumentSelections(['ready', 'missing'], [{ id: 'ready' }])).toEqual(['missing']);
  });
});
