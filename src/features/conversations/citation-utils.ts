import type { Message, Source } from '@/api/types';

export type CitationSelection = { messageId: string; sourceId: string };
export function citationSource(
  messages: Message[],
  selection: CitationSelection | null,
): Source | undefined {
  if (!selection) return undefined;
  const item = messages.find(
    (entry) =>
      entry.id === selection.messageId && entry.role === 'ASSISTANT' && entry.status === 'COMPLETE',
  );
  return item?.sources.find((source) => source.sourceId === selection.sourceId);
}
export function safeSources(sources: Source[], deletingIds: ReadonlySet<string>): Source[] {
  return sources.map((source) =>
    source.availability === 'DELETED' || deletingIds.has(source.documentId)
      ? { ...source, filename: null, snippet: null, availability: 'DELETED' }
      : source,
  );
}
export function sourceLocation(source: Source): string {
  if (source.locationType === 'PAGE')
    return source.pageNumber === null ? 'Trang chưa xác định' : `Trang ${source.pageNumber}`;
  const paragraph =
    source.paragraphIndex === null ? 'Đoạn chưa xác định' : `Đoạn ${source.paragraphIndex}`;
  return source.startOffset !== null && source.endOffset !== null
    ? `${paragraph} · Ký tự ${source.startOffset}–${source.endOffset} (không gồm cuối)`
    : paragraph;
}
export function citationText(source: Source): string {
  if (source.availability === 'DELETED')
    return `[${source.sourceId}] · Nguồn đã xóa · ${sourceLocation(source)}`;
  return `[${source.sourceId}] · ${source.filename ?? 'Tên tài liệu chưa có'} · ${sourceLocation(source)}${source.snippet ? `\n${source.snippet}` : ''}`;
}
