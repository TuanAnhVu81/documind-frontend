import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_BYTES,
  failureMessage,
  formatSize,
  statusLabel,
  validateFile,
} from '@/features/documents/document-utils';
import { QueryClient } from '@tanstack/react-query';
import {
  clearStoredDeletions,
  deletionKey,
  removeTrackedDeletion,
  restoreTrackedDeletions,
  trackDeletion,
} from '@/features/documents/document-sync';
describe('hỗ trợ thư viện tài liệu', () => {
  it('kiểm tra định dạng và chính xác ranh giới 10 MiB', () => {
    expect(validateFile({ name: 'Tài liệu.PDF', size: MAX_FILE_BYTES })).toBeNull();
    expect(validateFile({ name: 'tài liệu.txt', size: MAX_FILE_BYTES + 1 })).toContain('10 MiB');
    expect(validateFile({ name: 'bad.exe', size: 5 })).toContain('PDF');
    expect(validateFile({ name: 'empty.docx', size: 0 })).toContain('trống');
  });
  it('phân biệt tài liệu mới và chờ thử lại', () => {
    expect(statusLabel({ status: 'PENDING', attempts: 0, nextRetryAt: null })).toBe('Đang chờ');
    expect(statusLabel({ status: 'PENDING', attempts: 1, nextRetryAt: null })).toBe('Chờ thử lại');
  });
  it('định dạng dung lượng và không hiển thị lỗi thô không xác định', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(failureMessage('unknown-private-detail')).not.toContain('unknown-private-detail');
  });
  it('giữ trạng thái xóa đã tiếp nhận và tách theo tài khoản', () => {
    const client = new QueryClient();
    trackDeletion(client, 'a', 'doc', true);
    trackDeletion(client, 'a', 'doc', false);
    expect(client.getQueryData(deletionKey('a'))).toEqual([{ id: 'doc', accepted: true }]);
    expect(client.getQueryData(deletionKey('b'))).toBeUndefined();
    removeTrackedDeletion(client, 'a', 'doc');
    expect(client.getQueryData(deletionKey('a'))).toEqual([]);
  });
  it('khôi phục theo dõi khi reload và xóa dữ liệu lưu khi logout', () => {
    const id = '9d7f12ca-80a0-47f3-94d2-871caed468e4';
    trackDeletion(new QueryClient(), 'owner', id, true);
    const fresh = new QueryClient();
    restoreTrackedDeletions(fresh, 'owner');
    expect(fresh.getQueryData(deletionKey('owner'))).toEqual([{ id, accepted: true }]);
    clearStoredDeletions('owner');
    expect(sessionStorage.getItem('documind-document-deletions:owner')).toBeNull();
  });
});
