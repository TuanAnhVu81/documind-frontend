import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Element, ElementContent, Root, RootContent } from 'hast';
import type { Message } from '@/api/types';
import { sourceLocation, type CitationSelection } from './citation-utils';

function citationPlugin(ids: Set<string>, validateAnswer: boolean) {
  return () => (tree: Root) => {
    let matched = 0;
    let unknown = false;
    function visit(node: Root | Element) {
      if (node.type === 'element' && ['a', 'code', 'pre', 'button'].includes(node.tagName)) return;
      const result: RootContent[] = [];
      for (const child of node.children) {
        if (child.type !== 'text') {
          if (child.type === 'element') visit(child);
          result.push(child);
          continue;
        }
        const regex = /\[(S[1-9]\d*)\]/g;
        let cursor = 0;
        for (const match of child.value.matchAll(regex)) {
          if (!ids.has(match[1])) {
            unknown = true;
            continue;
          }
          matched++;
          const index = match.index;
          if (index > cursor)
            result.push({ type: 'text', value: child.value.slice(cursor, index) });
          result.push({
            type: 'element',
            tagName: 'button',
            properties: { type: 'button', dataCitationId: match[1] },
            children: [{ type: 'text', value: match[0] }],
          });
          cursor = index + match[0].length;
        }
        if (cursor < child.value.length)
          result.push({ type: 'text', value: child.value.slice(cursor) });
      }
      if (node.type === 'root') node.children = result;
      else node.children = result as ElementContent[];
    }
    visit(tree);
    if (validateAnswer && (matched === 0 || unknown))
      tree.children.push({
        type: 'element',
        tagName: 'p',
        properties: { className: ['citation-warning'], role: 'alert' },
        children: [
          {
            type: 'text',
            value:
              matched === 0
                ? 'Câu trả lời hoàn tất không có nguồn trích dẫn hợp lệ. Phản hồi không đáp ứng hợp đồng nguồn.'
                : 'Câu trả lời có nhãn nguồn không khớp với dữ liệu trích dẫn.',
          },
        ],
      });
  };
}
function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [notice, setNotice] = useState('');
  return (
    <div className="chat-code">
      <button
        type="button"
        onClick={(event) => {
          const code = event.currentTarget.parentElement?.querySelector('pre')?.textContent ?? '';
          void (async () => {
            try {
              await navigator.clipboard.writeText(code);
              setNotice('Đã sao chép');
            } catch {
              setNotice('Không thể sao chép. Hãy chọn và sao chép thủ công.');
            }
          })();
        }}
      >
        {notice === 'Đã sao chép' ? notice : 'Sao chép'}
      </button>
      <pre>{children}</pre>
      {notice && <span role="status">{notice}</span>}
    </div>
  );
}
const emptySources: Message['sources'] = [];
export function CitationMarkdown({
  item,
  onSelect,
}: {
  item: Message;
  onSelect?: (selection: CitationSelection, trigger: HTMLElement) => void;
}) {
  const eligible =
    item.role === 'ASSISTANT' && item.status === 'COMPLETE' && item.outcome === 'ANSWER';
  const sources = eligible ? item.sources : emptySources;
  const plugin = useMemo(
    () => citationPlugin(new Set(sources.map((source) => source.sourceId)), eligible),
    [sources, eligible],
  );
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[plugin]}
      components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        img: ({ alt }) => <span>{alt ?? ''}</span>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        button: ({ node, children }) => {
          const id = String(node?.properties?.dataCitationId ?? '');
          const source = sources.find((entry) => entry.sourceId === id);
          if (!source || !onSelect) return <span>{children}</span>;
          const label =
            source.availability === 'DELETED'
              ? 'Nguồn đã xóa'
              : `${source.filename ?? 'Tên tài liệu chưa có'} · ${sourceLocation(source)}`;
          return (
            <span className="citation-tooltip-wrap">
              <button
                type="button"
                className="citation-chip"
                data-citation-message-id={item.id}
                data-citation-source-id={id}
                title={label}
                aria-label={`Xem nguồn ${id}: ${label}`}
                onClick={(event) =>
                  onSelect({ messageId: item.id, sourceId: id }, event.currentTarget)
                }
              >
                {children}
              </button>
              <span className="citation-tooltip-content" aria-hidden="true">
                {label}
              </span>
            </span>
          );
        },
      }}
    >
      {item.content}
    </ReactMarkdown>
  );
}
