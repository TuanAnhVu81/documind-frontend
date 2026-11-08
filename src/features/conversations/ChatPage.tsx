import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageCircle,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { conversationsApi } from '@/api/conversations';
import { documentsApi } from '@/api/documents';
import { ApiError } from '@/api/errors';
import type { Message, MessagePage } from '@/api/types';
import type { InfiniteData } from '@tanstack/react-query';
import { queryKeys } from '@/app/query-client';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Dialog, Sheet } from '@/components/ui/Dialog';
import { useAuth } from '@/features/auth/use-auth';
import { authManager } from '@/features/auth/auth-manager';
import { documentToken } from '@/features/documents/document-auth';
import { deletionKey, type PendingDeletion } from '@/features/documents/document-sync';
import { hiddenDocumentSelections } from './conversation-utils';
import { CitationMarkdown } from './CitationMarkdown';
import { CitationPanel } from './CitationPanel';
import { citationSource, safeSources, type CitationSelection } from './citation-utils';
import {
  beginTurn,
  discardTurn,
  generationKey,
  markConversationUnavailable,
  makeSnapshot,
  reconcileTurn,
  retryNewTurn,
  retrySameTurn,
  stopTurn,
  type TurnState,
} from './chat-turn';
import { readPendingTurn } from './turn-storage';

const message = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
const scrollPositions = new Map<string, number>();

export function MessageBubble({
  item,
  onSelect,
}: {
  item: Message;
  onSelect?: (selection: CitationSelection, trigger: HTMLElement) => void;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopyStatus('Đã sao chép câu trả lời.');
    } catch {
      setCopyStatus('Không thể sao chép. Hãy chọn và sao chép thủ công.');
    }
  }
  return (
    <article className={`chat-message chat-message--${item.role.toLowerCase()}`}>
      <div className="chat-message-meta">
        <strong>{item.role === 'USER' ? 'Bạn' : 'DocuMind'}</strong>
        <time dateTime={item.createdAt}>
          {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
            new Date(item.createdAt),
          )}
        </time>
      </div>
      <div className="chat-markdown">
        <CitationMarkdown item={item} onSelect={onSelect} />
      </div>
      {item.status !== 'COMPLETE' && (
        <p className="chat-message-status">
          {item.status === 'GENERATING' ? 'Đang tạo câu trả lời' : 'Câu trả lời chưa hoàn tất'}
        </p>
      )}
      {item.role === 'ASSISTANT' && item.status === 'COMPLETE' && (
        <div className="citation-message-actions">
          <button type="button" onClick={() => void copyAnswer()}>
            Sao chép câu trả lời
          </button>
          {copyStatus && <span role="status">{copyStatus}</span>}
        </div>
      )}
    </article>
  );
}
function subscribeNarrow(listener: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(max-width: 1100px)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
function isNarrow() {
  return (
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1100px)').matches
  );
}
function History({
  userId,
  id,
  turn,
}: {
  userId: string;
  id: string;
  turn: TurnState | undefined;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const before = useRef<{ height: number; top: number } | null>(null);
  const initialized = useRef(false);
  const nearBottom = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const [selection, setSelection] = useState<CitationSelection | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => true);
  const pending = useQuery<PendingDeletion[]>({
    queryKey: deletionKey(userId),
    queryFn: async () => [],
    enabled: false,
    initialData: [],
    staleTime: Infinity,
  });
  const deleting = useMemo(
    () => new Set((pending.data ?? []).map((entry) => entry.id)),
    [pending.data],
  );
  const history = useInfiniteQuery({
    queryKey: queryKeys.messages(userId, id),
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const requestStartedAt = performance.now();
      const result = await conversationsApi.messages(
        await documentToken(userId),
        id,
        { beforeOrdinal: pageParam, limit: 50 },
        { signal },
      );
      return { ...result, requestStartedAt };
    },
    getNextPageParam: (last) => (last.hasMore ? (last.nextBeforeOrdinal ?? undefined) : undefined),
    retry: false,
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 404
        ? false
        : turn?.phase === 'reconciling' ||
            query.state.data?.pages.some((page) =>
              page.items.some((item) => item.status === 'GENERATING'),
            )
          ? 2000
          : false,
  });
  const items = useMemo(
    () =>
      Array.from(
        new Map(
          (history.data?.pages ?? []).flatMap((page) => page.items).map((item) => [item.id, item]),
        ).values(),
      ).sort((a, b) => a.ordinal - b.ordinal),
    [history.data],
  );
  useEffect(() => {
    if (history.error instanceof ApiError && history.error.status === 404)
      markConversationUnavailable(userId, id);
    else reconcileTurn(userId, id, items, history.data?.pages[0]?.requestStartedAt);
  }, [userId, id, items, history.data, history.dataUpdatedAt, history.error, turn?.phase]);
  const unavailable = history.error instanceof ApiError && history.error.status === 404;
  const shown = (unavailable ? [] : items).map((item) =>
    turn?.canonical?.id === item.id
      ? turn.canonical
      : item.status === 'GENERATING' &&
          turn?.assistantId === item.id &&
          (turn.phase === 'streaming' || turn.phase === 'reconciling')
        ? { ...item, content: turn.partial || item.content }
        : item,
  );
  const now = new Date().toISOString();
  if (!unavailable && turn?.userMessageId && !shown.some((item) => item.id === turn.userMessageId))
    shown.push({
      id: turn.userMessageId,
      conversationId: id,
      ordinal: Number.MAX_SAFE_INTEGER - 1,
      role: 'USER',
      content: turn.body.content,
      status: 'COMPLETE',
      outcome: null,
      sources: [],
      createdAt: now,
    });
  if (
    !unavailable &&
    turn?.assistantId &&
    !shown.some((item) => item.id === turn.assistantId) &&
    (turn.canonical || turn.phase === 'streaming' || turn.phase === 'reconciling')
  )
    shown.push(
      turn.canonical ?? {
        id: turn.assistantId,
        conversationId: id,
        ordinal: Number.MAX_SAFE_INTEGER,
        role: 'ASSISTANT',
        content: turn.partial,
        status: 'GENERATING',
        outcome: null,
        sources: [],
        createdAt: now,
      },
    );
  const displayMessages = shown.map((item) => ({
    ...item,
    sources: safeSources(item.sources, deleting),
  }));
  const selectedSource = citationSource(displayMessages, selection);
  const hasSelectedSource = !!selectedSource;
  function closeSource() {
    setSelection(null);
    requestAnimationFrame(() => {
      const fallback = Array.from(
        viewport.current?.querySelectorAll<HTMLButtonElement>('.citation-chip') ?? [],
      ).find(
        (button) =>
          button.dataset.citationMessageId === selection?.messageId &&
          button.dataset.citationSourceId === selection?.sourceId,
      );
      const target = triggerRef.current?.isConnected ? triggerRef.current : fallback;
      target?.focus();
    });
  }
  useLayoutEffect(() => {
    if (!narrow && hasSelectedSource) panelRef.current?.focus();
  }, [narrow, hasSelectedSource, selection?.messageId, selection?.sourceId]);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el || !history.data) return;
    if (before.current) {
      el.scrollTop = before.current.top + el.scrollHeight - before.current.height;
      before.current = null;
    } else if (!initialized.current) {
      el.scrollTop = scrollPositions.get(`${userId}:${id}`) ?? el.scrollHeight;
      initialized.current = true;
    }
  }, [history.data, userId, id]);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (el && initialized.current && nearBottom.current && !before.current)
      el.scrollTop = el.scrollHeight;
  }, [turn?.partial, turn?.canonical]);
  return (
    <div className="chat-history-layout">
      <div className="chat-history-container">
        <div
          className="chat-history"
          ref={viewport}
          onScroll={(event) => {
            const el = event.currentTarget;
            scrollPositions.set(`${userId}:${id}`, el.scrollTop);
            nearBottom.current = el.scrollHeight - el.clientHeight - el.scrollTop < 100;
            setShowLatest(!nearBottom.current);
          }}
        >
          {history.isPending && <p role="status">Đang tải lịch sử…</p>}
          {history.isError && (
            <div role="alert">
              <p>
                {history.error instanceof ApiError && history.error.status === 404
                  ? 'Không tìm thấy hội thoại hoặc bạn không có quyền truy cập.'
                  : message(history.error)}
              </p>
              <Button variant="secondary" onClick={() => void history.refetch()}>
                Thử lại
              </Button>
            </div>
          )}
          {history.hasNextPage && (
            <Button
              variant="secondary"
              loading={history.isFetchingNextPage}
              onClick={() => {
                const el = viewport.current;
                if (el) before.current = { height: el.scrollHeight, top: el.scrollTop };
                void history.fetchNextPage();
              }}
            >
              Tải tin nhắn cũ hơn
            </Button>
          )}
          {history.isFetchNextPageError && (
            <p role="alert">Chưa tải được tin nhắn cũ. Hãy thử lại.</p>
          )}
          {history.isSuccess && shown.length === 0 && !turn?.userMessageId && (
            <div className="chat-welcome">
              <span className="chat-welcome-icon">
                <MessageCircle size={25} />
              </span>
              <h2>Bắt đầu từ một câu hỏi</h2>
              <p>Đặt câu hỏi để khám phá thông tin trong tài liệu của bạn.</p>
              <div className="chat-suggestions">
                <span>Những điểm chính trong tài liệu là gì?</span>
                <span>Hãy tóm tắt các nội dung quan trọng.</span>
              </div>
            </div>
          )}
          <div className="chat-message-list">
            {displayMessages.map((item) => (
              <MessageBubble
                key={item.id}
                item={item}
                onSelect={(next, trigger) => {
                  triggerRef.current = trigger;
                  setSelection(next);
                }}
              />
            ))}
            {(turn?.phase === 'streaming' || (turn?.phase === 'reconciling' && turn.partial)) && (
              <p className="chat-message-status" role="status">
                Nội dung đang nhận là bản tạm, chưa kiểm tra trích dẫn.
              </p>
            )}
          </div>
        </div>
        {showLatest && (
          <Button
            className="chat-scroll-latest"
            variant="secondary"
            onClick={() => {
              if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
            }}
          >
            Xuống tin nhắn mới
          </Button>
        )}
      </div>
      {!narrow && selectedSource && (
        <aside
          ref={panelRef}
          tabIndex={-1}
          className="citation-panel-desktop"
          aria-label="Chi tiết nguồn trích dẫn"
        >
          <CitationPanel
            key={`${selection?.messageId}:${selection?.sourceId}:${selectedSource.availability}`}
            source={selectedSource}
            onClose={closeSource}
          />
        </aside>
      )}
      <Sheet
        open={narrow && !!selectedSource}
        onOpenChange={(open) => {
          if (!open) closeSource();
        }}
        title="Nguồn trích dẫn"
        description="Xem vị trí và trích đoạn của nguồn trong câu trả lời."
        side="bottom"
      >
        {selectedSource && (
          <CitationPanel
            key={`${selection?.messageId}:${selection?.sourceId}:${selectedSource.availability}`}
            source={selectedSource}
            onClose={closeSource}
            showClose={false}
          />
        )}
      </Sheet>
    </div>
  );
}
function ScopePicker({
  userId,
  selected,
  setSelected,
}: {
  userId: string;
  selected: string[];
  setSelected: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const docs = useInfiniteQuery({
    queryKey: [...queryKeys.documents(userId), 'chat-scope'],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) =>
      documentsApi.list(await documentToken(userId), { page: pageParam, size: 100 }, { signal }),
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: open,
  });
  const ready = (docs.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((doc) => doc.status === 'READY');
  const hiddenSelections = hiddenDocumentSelections(selected, ready);
  return (
    <>
      <button type="button" className="chat-scope-button" onClick={() => setOpen(true)}>
        <BookOpen size={16} />
        {selected.length ? `${selected.length} tài liệu đã chọn` : 'Toàn bộ thư viện'}
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Phạm vi tài liệu"
        description="Chỉ chọn tài liệu đã sẵn sàng. Bỏ chọn tất cả để dùng toàn bộ thư viện."
      >
        <div className="chat-scope-list">
          {hiddenSelections.map((id) => (
            <div key={id} className="chat-unavailable-selection">
              <span>Tài liệu {id} chưa có trong trang đã tải hoặc không còn khả dụng.</span>
              <Button
                variant="ghost"
                onClick={() => setSelected(selected.filter((value) => value !== id))}
              >
                Bỏ chọn
              </Button>
            </div>
          ))}
          {docs.isPending && <p role="status">Đang tải tài liệu…</p>}
          {docs.isError && (
            <p role="alert">
              {message(docs.error)} <button onClick={() => void docs.refetch()}>Thử lại</button>
            </p>
          )}
          {docs.isSuccess && ready.length === 0 && (
            <p>Chưa có tài liệu sẵn sàng trong các trang đã tải.</p>
          )}
          {ready.map((doc) => (
            <label key={doc.id}>
              <input
                type="checkbox"
                checked={selected.includes(doc.id)}
                disabled={!selected.includes(doc.id) && selected.length >= 20}
                onChange={() =>
                  setSelected(
                    selected.includes(doc.id)
                      ? selected.filter((id) => id !== doc.id)
                      : [...selected, doc.id],
                  )
                }
              />
              {doc.filename}
            </label>
          ))}
          {docs.hasNextPage && (
            <Button
              variant="secondary"
              loading={docs.isFetchingNextPage}
              onClick={() => void docs.fetchNextPage()}
            >
              Tải thêm tài liệu
            </Button>
          )}
        </div>
        <p className="chat-hint">
          Tối đa 20 tài liệu. Trạng thái sẽ được kiểm tra lại khi gửi câu hỏi.
        </p>
        <Button onClick={() => setOpen(false)}>Xong</Button>
      </Dialog>
    </>
  );
}
function ChatComposer({
  userId,
  id,
  turn,
  historyGenerating,
  historyUnavailable,
}: {
  userId: string;
  id: string;
  turn: TurnState | undefined;
  historyGenerating: boolean;
  historyUnavailable: boolean;
}) {
  const cache = useQueryClient();
  const key = queryKeys.conversationDraft(userId, id);
  useQuery({ queryKey: key, queryFn: () => null, enabled: false, gcTime: Infinity });
  const [draft, setDraft] = useState(
    () => cache.getQueryData<{ content: string; selected: string[] }>(key)?.content ?? '',
  );
  const [selected, setSelected] = useState<string[]>(
    () => cache.getQueryData<{ content: string; selected: string[] }>(key)?.selected ?? [],
  );
  function select(ids: string[]) {
    setSelected(ids);
    cache.setQueryData(key, { content: draft, selected: ids });
  }
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!turn?.retryUntil) return;
    const retryUntil = turn.retryUntil;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= retryUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [turn?.retryUntil]);
  const cooldown = !!turn?.retryUntil && turn.retryUntil > clock;
  const locked =
    historyUnavailable ||
    cooldown ||
    turn?.phase === 'unavailable' ||
    historyGenerating ||
    turn?.phase === 'sending' ||
    turn?.phase === 'streaming' ||
    turn?.phase === 'reconciling' ||
    turn?.phase === 'uncertain';
  function submit() {
    if (locked) return;
    try {
      const body = makeSnapshot(draft, selected);
      if (beginTurn(userId, id, body)) {
        setDraft('');
        cache.setQueryData(key, { content: '', selected });
      }
    } catch (error) {
      setValidation(error instanceof Error ? error.message : 'Câu hỏi chưa hợp lệ.');
    }
  }
  const [validation, setValidation] = useState('');
  return (
    <div className="chat-composer">
      <ScopePicker userId={userId} selected={selected} setSelected={select} />
      <label className="sr-only" htmlFor="chat-draft">
        Câu hỏi của bạn
      </label>
      <textarea
        id="chat-draft"
        rows={2}
        value={draft}
        onChange={(event) => {
          const content = Array.from(event.target.value).slice(0, 4000).join('');
          setDraft(content);
          setValidation('');
          cache.setQueryData(key, { content, selected });
          event.target.style.height = 'auto';
          event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Nhập câu hỏi về tài liệu của bạn…"
      />
      <div className="chat-compose-footer">
        <span>
          {validation ||
            `${Array.from(draft).length}/4.000 ký tự · Enter để gửi, Shift+Enter xuống dòng`}
        </span>
        {turn?.phase === 'sending' || turn?.phase === 'streaming' ? (
          <Button variant="secondary" onClick={() => stopTurn(userId, id)}>
            Dừng nhận
          </Button>
        ) : (
          <Button disabled={locked || !draft.trim()} onClick={submit} aria-label="Gửi câu hỏi">
            <Send size={16} /> Gửi
          </Button>
        )}
      </div>
      {validation && (
        <p role="alert" className="chat-hint">
          {validation}
        </p>
      )}
      {turn?.notice && (
        <div className="chat-turn-notice" role="status">
          {turn.notice}{' '}
          {cooldown && `Thử lại sau ${Math.ceil((turn.retryUntil! - clock) / 1000)} giây.`}{' '}
          {turn.requestId && `Mã yêu cầu: ${turn.requestId}`}{' '}
          {turn.canRetrySame && (
            <Button variant="secondary" onClick={() => retrySameTurn(userId, id)}>
              Kiểm tra lại yêu cầu
            </Button>
          )}{' '}
          {turn.canRetryNew && (
            <Button variant="secondary" onClick={() => retryNewTurn(userId, id)}>
              Thử lại lượt trả lời
            </Button>
          )}
          {turn.phase === 'failed' && !turn.canRetryNew && (
            <Button
              variant="ghost"
              onClick={() => {
                const ids = turn.body.documentIds ?? [];
                setDraft(turn.body.content);
                setSelected(ids);
                cache.setQueryData(key, { content: turn.body.content, selected: ids });
              }}
            >
              Khôi phục câu hỏi
            </Button>
          )}
        </div>
      )}
      {turn?.usage && (
        <p className="chat-hint">
          Sử dụng:{' '}
          {turn.usage.promptTokens === null && turn.usage.completionTokens === null
            ? 'chưa có số liệu token'
            : `${turn.usage.promptTokens ?? 'chưa có'} token đầu vào, ${turn.usage.completionTokens ?? 'chưa có'} token đầu ra`}
          {turn.usage.estimated ? ' (ước tính)' : ''} · Chi phí{' '}
          {turn.usage.estimatedCostUsd === null ? 'chưa có' : `${turn.usage.estimatedCostUsd} USD`}
        </p>
      )}
    </div>
  );
}
export default function ChatPage() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const navigate = useNavigate();
  const cache = useQueryClient();
  const historyData = useSyncExternalStore(
    (listener) => cache.getQueryCache().subscribe(listener),
    () =>
      cache.getQueryData<InfiniteData<MessagePage>>(
        queryKeys.messages(userId, conversationId ?? ''),
      ),
    () => undefined,
  );
  const historyError = useSyncExternalStore(
    (listener) => cache.getQueryCache().subscribe(listener),
    () =>
      cache.getQueryState<InfiniteData<MessagePage>>(
        queryKeys.messages(userId, conversationId ?? ''),
      )?.error,
    () => null,
  );
  const historyUnavailable = historyError instanceof ApiError && historyError.status === 404;
  const historyGenerating =
    historyData?.pages.some((page) => page.items.some((item) => item.status === 'GENERATING')) ??
    false;
  const turnQuery = useQuery<TurnState | null>({
    queryKey: generationKey(userId, conversationId ?? ''),
    queryFn: () => null,
    enabled: false,
    gcTime: Infinity,
    initialData: () => (conversationId ? readPendingTurn(userId, conversationId) : undefined),
  });
  const turn = turnQuery.data ?? undefined;
  const [drawer, setDrawer] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useInfiniteQuery({
    queryKey: [...queryKeys.conversations(userId), 'sidebar'],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) =>
      conversationsApi.list(await documentToken(userId), { page: pageParam, size: 20 }, { signal }),
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });
  const items = (list.data?.pages ?? []).flatMap((p) => p.items);
  async function create() {
    setBusy(true);
    setError('');
    let submitted = false;
    try {
      const token = await documentToken(userId);
      submitted = true;
      const created = await conversationsApi.create(token);
      if (authManager.getSnapshot().user?.id !== userId) return;
      setDrawer(false);
      void navigate(`/app/chat/${created.id}`);
    } catch (e) {
      const uncertain =
        submitted && e instanceof ApiError && (e.status === undefined || e.status >= 500);
      setError(
        uncertain
          ? 'Chưa xác định được hội thoại đã tạo hay chưa. Hãy kiểm tra danh sách trước khi tạo lại.'
          : message(e),
      );
    } finally {
      if (submitted && authManager.getSnapshot().user?.id === userId)
        void cache.invalidateQueries({ queryKey: queryKeys.conversations(userId) });
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirmId) return;
    setBusy(true);
    setError('');
    const id = confirmId;
    let submitted = false;
    let confirmed = false;
    try {
      const token = await documentToken(userId);
      submitted = true;
      try {
        await conversationsApi.delete(token, id);
        confirmed = true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) confirmed = true;
        else if (e instanceof ApiError && (e.status === undefined || e.status >= 500)) {
          let exists = false;
          try {
            await conversationsApi.messages(await documentToken(userId), id, { limit: 1 });
            exists = true;
          } catch (check) {
            if (check instanceof ApiError && check.status === 404) confirmed = true;
            else
              throw new Error(
                'Chưa xác định được kết quả xóa. Hãy kiểm tra lại hội thoại trước khi thử lại.',
                { cause: check },
              );
          }
          if (exists)
            throw new Error(
              'Chưa xác nhận được yêu cầu xóa. Hội thoại vẫn còn; hãy kiểm tra trước khi thử lại.',
              { cause: e },
            );
        } else throw e;
      }
      if (authManager.getSnapshot().user?.id !== userId) return;
      discardTurn(userId, id);
      const conversationKey = [...queryKeys.conversations(userId), id];
      await cache.cancelQueries({ queryKey: conversationKey });
      cache.removeQueries({ queryKey: conversationKey });
      cache.removeQueries({ queryKey: queryKeys.conversationDraft(userId, id) });
      scrollPositions.delete(`${userId}:${id}`);
      if (window.location.pathname === `/app/chat/${id}`)
        void navigate('/app/chat', { replace: true });
      setConfirmId(null);
    } catch (e) {
      setError(e instanceof Error && !(e instanceof ApiError) ? e.message : message(e));
    } finally {
      if (submitted && authManager.getSnapshot().user?.id === userId) {
        if (!confirmed) {
          await cache.cancelQueries({ queryKey: queryKeys.messages(userId, id) });
          cache.removeQueries({ queryKey: queryKeys.messages(userId, id) });
          if (window.location.pathname === `/app/chat/${id}`)
            void navigate('/app/chat', { replace: true });
        }
        void cache.invalidateQueries({ queryKey: queryKeys.conversations(userId) });
      }
      setBusy(false);
    }
  }
  const sidebar = (
    <div className="chat-sidebar-inner">
      <div className="chat-sidebar-title">
        <div>
          <span>KHÔNG GIAN HỎI ĐÁP</span>
          <h1>Hội thoại</h1>
        </div>
        <Button
          size="icon"
          aria-label="Tạo hội thoại mới"
          loading={busy}
          onClick={() => void create()}
        >
          <Plus size={18} />
        </Button>
      </div>
      <p className="chat-sidebar-caption">Những cuộc trao đổi của bạn</p>
      {list.isPending && <p role="status">Đang tải hội thoại…</p>}
      {list.isError && (
        <p role="alert">
          {message(list.error)} <button onClick={() => void list.refetch()}>Thử lại</button>
        </p>
      )}
      {list.isSuccess && items.length === 0 && (
        <p className="chat-hint">Chưa có hội thoại nào. Tạo một hội thoại để bắt đầu.</p>
      )}
      <nav aria-label="Danh sách hội thoại" className="chat-conversation-list">
        {items.map((item) => (
          <div
            key={item.id}
            className={`chat-conversation ${item.id === conversationId ? 'is-active' : ''}`}
          >
            <Link
              to={`/app/chat/${item.id}`}
              aria-current={item.id === conversationId ? 'page' : undefined}
              onClick={() => setDrawer(false)}
            >
              <MessageCircle size={16} />
              <span>{item.title}</span>
            </Link>
            <button
              type="button"
              aria-label={`Xóa ${item.title}`}
              onClick={() => setConfirmId(item.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </nav>
      {list.hasNextPage && (
        <Button
          variant="ghost"
          loading={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          Xem thêm <ChevronRight size={14} />
        </Button>
      )}
    </div>
  );
  return (
    <AppShell>
      <section className="chat-layout" aria-label="Không gian hội thoại">
        <aside className="chat-sidebar">{sidebar}</aside>
        <Sheet
          open={drawer}
          onOpenChange={setDrawer}
          title="Hội thoại"
          description="Chọn hoặc tạo một hội thoại."
          side="left"
        >
          {sidebar}
        </Sheet>
        <div className="chat-main">
          <h1 className="sr-only">Hội thoại</h1>
          <header className="chat-header">
            <Button
              className="chat-drawer-button"
              size="icon"
              variant="ghost"
              aria-label="Mở danh sách hội thoại"
              onClick={() => setDrawer(true)}
            >
              <Menu size={19} />
            </Button>
            <div>
              <strong>
                {items.find((item) => item.id === conversationId)?.title ??
                  (conversationId ? 'Hội thoại' : 'Không gian hội thoại')}
              </strong>
              <p>Lịch sử và ngữ cảnh của bạn</p>
            </div>
            {conversationId && (
              <Link className="chat-back" to="/app/chat">
                <ChevronLeft size={16} /> Tất cả
              </Link>
            )}
          </header>
          {error && (
            <p className="detail-failure" role="alert">
              {error}
            </p>
          )}
          {conversationId ? (
            <>
              <History
                key={`history:${userId}:${conversationId}`}
                userId={userId}
                id={conversationId}
                turn={turn}
              />
              <ChatComposer
                key={`composer:${userId}:${conversationId}`}
                userId={userId}
                id={conversationId}
                turn={turn}
                historyGenerating={historyGenerating}
                historyUnavailable={historyUnavailable}
              />
            </>
          ) : (
            <div className="chat-welcome chat-no-selection">
              <span className="chat-welcome-icon">
                <MessageCircle size={25} />
              </span>
              <h2>Kiến thức của bạn, trong tầm tay</h2>
              <p>Chọn một hội thoại hoặc tạo mới để bắt đầu khám phá tài liệu.</p>
              <Button loading={busy} onClick={() => void create()}>
                <Plus size={16} /> Tạo hội thoại
              </Button>
            </div>
          )}
        </div>
      </section>
      <Dialog
        open={!!confirmId}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
        title="Xóa hội thoại?"
        description="Hội thoại và toàn bộ lịch sử tin nhắn sẽ bị xóa. Tài liệu của bạn vẫn được giữ lại."
      >
        <div className="chat-confirm">
          {error && <p role="alert">{error}</p>}
          <Button variant="secondary" onClick={() => setConfirmId(null)}>
            Hủy
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void remove()}>
            Xóa hội thoại
          </Button>
        </div>
      </Dialog>
    </AppShell>
  );
}
