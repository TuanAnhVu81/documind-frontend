import { useState } from 'react';
import { BookOpenText, Copy, X } from 'lucide-react';
import type { Source } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { citationText, sourceLocation } from './citation-utils';

export function CitationPanel({
  source,
  onClose,
  showClose = true,
}: {
  source: Source;
  onClose: () => void;
  showClose?: boolean;
}) {
  const [notice, setNotice] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(citationText(source));
      setNotice('Đã sao chép trích dẫn.');
    } catch {
      setNotice('Không thể sao chép. Hãy chọn và sao chép thủ công.');
    }
  }
  return (
    <div className="citation-panel-body">
      <header className="citation-panel-heading">
        <div>
          <span className="citation-eyebrow">NGUỒN TRÍCH DẪN</span>
          <h2>
            <BookOpenText size={18} aria-hidden="true" /> Nguồn [{source.sourceId}]
          </h2>
        </div>
        {showClose && (
          <Button variant="ghost" size="icon" aria-label="Đóng nguồn trích dẫn" onClick={onClose}>
            <X size={18} />
          </Button>
        )}
      </header>
      <div className="citation-info">
        <span className="citation-source-label">TÀI LIỆU</span>
        <strong>
          {source.availability === 'DELETED'
            ? 'Nguồn đã xóa'
            : (source.filename ?? 'Tên tài liệu chưa có')}
        </strong>
        <span>{sourceLocation(source)}</span>
      </div>
      {source.availability === 'DELETED' ? (
        <p className="citation-explanation">
          Tài liệu gốc đã bị xóa. Tên tệp và trích đoạn không còn khả dụng; nội dung hội thoại vẫn
          được giữ.
        </p>
      ) : (
        <>
          <p className="citation-source-label">TRÍCH ĐOẠN</p>
          {source.snippet !== null ? (
            <blockquote className="citation-excerpt">
              <mark>{source.snippet}</mark>
            </blockquote>
          ) : (
            <p className="citation-explanation">Không có trích đoạn trong phản hồi.</p>
          )}
          <p className="citation-explanation">
            Hãy đối chiếu trích đoạn với câu trả lời để tự đánh giá nội dung.
          </p>
        </>
      )}
      <Button variant="secondary" onClick={() => void copy()}>
        <Copy size={15} aria-hidden="true" /> Sao chép trích dẫn
      </Button>
      {notice && (
        <p className="chat-hint" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
