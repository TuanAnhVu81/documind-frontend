import type { Document, DocumentStatus } from '@/api/types';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const extensions = ['pdf', 'docx', 'txt'];
export function validateFile(file: Pick<File, 'name' | 'size'>): string | null {
  const suffix = file.name.split('.').pop()?.toLowerCase();
  if (!file.name.includes('.') || !suffix || !extensions.includes(suffix))
    return 'Chỉ hỗ trợ tệp PDF, DOCX hoặc TXT.';
  if (file.size > MAX_FILE_BYTES) return 'Tệp vượt quá giới hạn 10 MiB.';
  if (file.size === 0) return 'Tệp đang trống. Vui lòng chọn tệp có nội dung.';
  return null;
}
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function formatDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}
const statusNames: Record<DocumentStatus, string> = {
  PENDING: 'Đang chờ',
  PROCESSING: 'Đang xử lý',
  READY: 'Sẵn sàng',
  FAILED: 'Xử lý thất bại',
  DELETING: 'Đang xóa',
};
export function statusLabel(doc: Pick<Document, 'status' | 'attempts' | 'nextRetryAt'>): string {
  if (doc.status === 'PENDING' && ((doc.attempts ?? 0) > 0 || doc.nextRetryAt))
    return 'Chờ thử lại';
  return statusNames[doc.status];
}
const failures: Record<string, string> = {
  NO_EXTRACTABLE_TEXT: 'Không trích xuất được văn bản; tài liệu scan chưa được hỗ trợ OCR.',
  PDF_PAGE_LIMIT: 'Tệp PDF vượt giới hạn số trang.',
  TEXT_LIMIT: 'Tài liệu vượt giới hạn văn bản.',
  DOCX_RESOURCE_LIMIT: 'Tệp DOCX vượt giới hạn tài nguyên.',
  CHUNK_LIMIT: 'Tài liệu vượt giới hạn số đoạn.',
  INVALID_TEXT_ENCODING: 'Tệp văn bản cần dùng mã hóa UTF-8.',
  INVALID_DOCUMENT: 'Tệp bị hỏng hoặc không thể đọc.',
  UNSUPPORTED_DOCUMENT: 'Định dạng tài liệu không được hỗ trợ.',
  PARSER_TIMEOUT: 'Quá thời gian đọc tài liệu.',
  EMBEDDING_INVALID: 'Không thể tạo dữ liệu tìm kiếm cho tài liệu.',
  PROVIDER_RATE_LIMIT: 'Dịch vụ AI đã đạt giới hạn. Vui lòng kiểm tra hạn mức.',
  INGESTION_FAILED: 'Không thể xử lý tài liệu. Vui lòng thử tải lại tệp.',
};
export function failureMessage(code: string | null): string | null {
  return code ? (failures[code] ?? 'Không thể xử lý tài liệu. Vui lòng thử lại sau.') : null;
}
export const isActive = (status: DocumentStatus) =>
  status === 'PENDING' || status === 'PROCESSING' || status === 'DELETING';
export const pollInterval = () => (document.hidden ? 15_000 : 3_000);
