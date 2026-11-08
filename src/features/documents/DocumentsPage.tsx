import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, FileText, FolderOpen, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { documentsApi } from '@/api/documents';
import type { Document as DocumentDto } from '@/api/types';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState, Progress, Skeleton, Toast } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Input';
import { authManager } from '@/features/auth/auth-manager';
import { useAuth } from '@/features/auth/use-auth';
import { documentToken } from './document-auth';
import {
  deletionKey,
  notifyDocuments,
  removeTrackedDeletion,
  refreshConversationSources,
  trackDeletion,
  type PendingDeletion,
} from './document-sync';
import {
  failureMessage,
  formatDate,
  formatSize,
  isActive,
  pollInterval,
  statusLabel,
  validateFile,
} from './document-utils';

type UploadItem = {
  id: string;
  name: string;
  state: 'waiting' | 'uploading' | 'accepted' | 'error';
  message?: string;
};
function errorText(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}
function errorRequestId(error: unknown) {
  return error instanceof ApiError ? error.requestId : undefined;
}
function Status({ item }: { item: DocumentDto }) {
  return (
    <span className={`document-status document-status--${item.status.toLowerCase()}`}>
      <span aria-hidden="true" />
      {statusLabel(item)}
    </span>
  );
}
function DeletionWatcher({
  id,
  userId,
  onComplete,
  onAccepted,
  onDismiss,
  accepted,
}: {
  id: string;
  userId: string;
  onComplete: (id: string, accepted: boolean) => void;
  onAccepted: (id: string) => void;
  onDismiss: (id: string) => void;
  accepted: boolean;
}) {
  const query = useQuery({
    queryKey: ['user', userId, 'document-deletion', id],
    networkMode: 'always',
    queryFn: async ({ signal }) => documentsApi.detail(await documentToken(userId), id, { signal }),
    retry: false,
    refetchInterval: (current) =>
      current.state.error instanceof ApiError && current.state.error.status === 404
        ? false
        : pollInterval(),
    refetchIntervalInBackground: true,
  });
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 404) onComplete(id, accepted);
  }, [query.error, id, accepted, onComplete]);
  useEffect(() => {
    if (!accepted && query.data?.status === 'DELETING') onAccepted(id);
  }, [accepted, query.data?.status, id, onAccepted]);
  if (query.error && !(query.error instanceof ApiError && query.error.status === 404)) {
    return (
      <div className="detail-failure" role="status">
        Chưa thể xác nhận kết quả xóa. {errorText(query.error)}{' '}
        <button type="button" onClick={() => void query.refetch()}>
          Thử lại
        </button>
      </div>
    );
  }
  if (!accepted && query.data && query.data.status !== 'DELETING') {
    return (
      <div className="detail-failure" role="status">
        Chưa xác nhận được yêu cầu xóa. Tài liệu vẫn còn; hệ thống tiếp tục kiểm tra.{' '}
        <button type="button" onClick={() => onDismiss(id)}>
          Ngừng theo dõi
        </button>
      </div>
    );
  }
  return null;
}
export default function DocumentsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [completedDeletions, setCompletedDeletions] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Set<AbortController>());
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const pending = controllers.current;
    return () => {
      active.current = false;
      pending.forEach((controller) => controller.abort());
    };
  }, []);
  const isCurrent = () => active.current && authManager.getSnapshot().user?.id === userId;
  const pendingDeletions = useQuery<PendingDeletion[]>({
    queryKey: deletionKey(userId),
    queryFn: async () => [],
    enabled: false,
    initialData: [],
    staleTime: Infinity,
  }).data;
  const list = useQuery({
    queryKey: ['user', userId, 'documents', 'list', { page, size: 20 }],
    networkMode: 'always',
    enabled: Boolean(userId),
    queryFn: async ({ signal }) =>
      documentsApi.list(await documentToken(userId), { page, size: 20 }, { signal }),
    refetchInterval: (current) =>
      current.state.data?.items.some((item) => isActive(item.status)) ? pollInterval() : false,
    refetchIntervalInBackground: true,
  });
  const detail = useQuery({
    queryKey: ['user', userId, 'documents', 'detail', selectedId],
    networkMode: 'always',
    enabled: Boolean(userId && selectedId),
    queryFn: async ({ signal }) =>
      documentsApi.detail(await documentToken(userId), selectedId!, { signal }),
    retry: false,
    refetchInterval: (current) =>
      current.state.error instanceof ApiError && current.state.error.status === 404
        ? false
        : current.state.data && isActive(current.state.data.status)
          ? pollInterval()
          : false,
    refetchIntervalInBackground: true,
  });
  useEffect(() => {
    if (authManager.getSnapshot().user?.id !== userId) return;
    for (const item of list.data?.items ?? []) {
      if (item.status === 'DELETING' && !completedDeletions.includes(item.id)) {
        trackDeletion(queryClient, userId, item.id, true);
      }
    }
  }, [list.data, completedDeletions, queryClient, userId]);
  useEffect(() => {
    if (!list.data || page === 0) return;
    const lastPage = Math.max(0, list.data.totalPages - 1);
    if (page <= lastPage) return;
    const timer = window.setTimeout(() => setPage(lastPage), 0);
    return () => window.clearTimeout(timer);
  }, [list.data, page]);
  const acceptDeletion = useCallback(
    (id: string) => {
      if (!active.current || authManager.getSnapshot().user?.id !== userId) return;
      trackDeletion(queryClient, userId, id, true);
      if (selectedId === id) {
        setDetailError(null);
        setConfirmDelete(false);
      }
    },
    [queryClient, userId, selectedId],
  );
  const dismissDeletion = useCallback(
    (id: string) => {
      if (active.current && authManager.getSnapshot().user?.id === userId)
        removeTrackedDeletion(queryClient, userId, id);
    },
    [queryClient, userId],
  );
  const finishDeletion = useCallback(
    (id: string, accepted: boolean) => {
      if (!active.current || authManager.getSnapshot().user?.id !== userId) return;
      setCompletedDeletions((current) => (current.includes(id) ? current : [...current, id]));
      refreshConversationSources(queryClient, userId, id);
      removeTrackedDeletion(queryClient, userId, id);
      notifyDocuments(userId, 'delete-complete', id);
      setSelectedId((current) => (current === id ? null : current));
      setToast({
        title: accepted ? 'Đã xóa tài liệu' : 'Tài liệu không còn trong thư viện',
        description: accepted
          ? 'Tệp và dữ liệu tìm kiếm đã được dọn dẹp.'
          : 'Máy chủ đã xác nhận không còn tài liệu này.',
      });
      void queryClient.invalidateQueries({ queryKey: ['user', userId, 'documents'] });
    },
    [queryClient, userId],
  );
  async function uploadFiles(files: FileList | File[]) {
    if (busy || !userId) return;
    const chosen = Array.from(files);
    if (!chosen.length) return;
    const jobs = chosen.map((file) => ({
      id: crypto.randomUUID(),
      file,
      error: validateFile(file),
    }));
    setUploads(
      jobs.map(({ id, file, error }) => ({
        id,
        name: file.name,
        state: error ? 'error' : 'waiting',
        message: error ?? undefined,
      })),
    );
    setBusy(true);
    let accepted = 0;
    for (const job of jobs) {
      if (job.error || !isCurrent()) continue;
      const controller = new AbortController();
      let submitted = false;
      controllers.current.add(controller);
      const untrack = authManager.trackStream(controller);
      setUploads((items) =>
        items.map((item) => (item.id === job.id ? { ...item, state: 'uploading' } : item)),
      );
      try {
        const token = await documentToken(userId);
        if (controller.signal.aborted) break;
        submitted = true;
        await documentsApi.upload(token, job.file, { signal: controller.signal });
        if (!isCurrent()) break;
        accepted++;
        setUploads((items) =>
          items.map((item) => (item.id === job.id ? { ...item, state: 'accepted' } : item)),
        );
      } catch (error) {
        if (!isCurrent() || controller.signal.aborted) break;
        const requestId = errorRequestId(error);
        const uncertain =
          error instanceof ApiError &&
          (error.code === 'NETWORK_ERROR' ||
            error.code === 'TIMEOUT' ||
            (error.status !== undefined && error.status >= 500));
        setUploads((items) =>
          items.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  state: 'error',
                  message: `${uncertain ? 'Chưa xác định tệp đã được tiếp nhận hay chưa. Hãy kiểm tra thư viện trước khi tải lại.' : errorText(error)}${requestId ? ` Mã yêu cầu: ${requestId}` : ''}`,
                }
              : item,
          ),
        );
      } finally {
        if (submitted && authManager.getSnapshot().user?.id === userId) {
          void queryClient.invalidateQueries({ queryKey: ['user', userId, 'documents'] });
          notifyDocuments(userId, 'upload');
        }
        untrack();
        controllers.current.delete(controller);
      }
    }
    if (!isCurrent()) return;
    setBusy(false);
    if (accepted) {
      setPage(0);
      setToast({
        title: 'Đã tiếp nhận tài liệu',
        description: `${accepted} tệp đã được tải lên và đang chờ xử lý.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['user', userId, 'documents'] });
    }
  }
  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void uploadFiles(event.target.files);
    event.target.value = '';
  }
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) void uploadFiles(event.dataTransfer.files);
  }
  async function removeDocument() {
    if (
      !selectedId ||
      deleteBusy ||
      pendingDeletions.some((item) => item.id === selectedId && item.accepted)
    )
      return;
    const id = selectedId;
    const operationId = crypto.randomUUID();
    const controller = new AbortController();
    let submitted = false;
    let accepted = false;
    let track = true;
    controllers.current.add(controller);
    const untrack = authManager.trackStream(controller);
    setDeleteBusy(true);
    setDetailError(null);
    try {
      const token = await documentToken(userId);
      if (controller.signal.aborted) return;
      trackDeletion(queryClient, userId, id, false);
      refreshConversationSources(queryClient, userId, id);
      submitted = true;
      notifyDocuments(userId, 'delete', id, false, operationId, 0);
      await documentsApi.delete(token, id, { signal: controller.signal });
      accepted = true;
      if (authManager.getSnapshot().user?.id !== userId) return;
      trackDeletion(queryClient, userId, id, true);
      if (!isCurrent()) return;
      setConfirmDelete(false);
      setToast({
        title: 'Đã yêu cầu xóa',
        description: 'Tài liệu đang được dọn dẹp. Bạn có thể tiếp tục sử dụng thư viện.',
      });
      await queryClient.invalidateQueries({ queryKey: ['user', userId, 'documents'] });
    } catch (error) {
      if (
        submitted &&
        error instanceof ApiError &&
        error.status !== undefined &&
        error.status < 500 &&
        error.status !== 404 &&
        authManager.getSnapshot().user?.id === userId
      ) {
        track = false;
        removeTrackedDeletion(queryClient, userId, id);
        refreshConversationSources(queryClient, userId);
      }
      if (isCurrent() && !controller.signal.aborted)
        setDetailError(
          `${submitted && (!(error instanceof ApiError) || error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || (error.status !== undefined && error.status >= 500)) ? 'Chưa xác nhận được yêu cầu xóa. Hệ thống đang kiểm tra trạng thái tài liệu.' : errorText(error)}${errorRequestId(error) ? ` Mã yêu cầu: ${errorRequestId(error)}` : ''}`,
        );
    } finally {
      if (submitted && authManager.getSnapshot().user?.id === userId) {
        void queryClient.invalidateQueries({ queryKey: ['user', userId, 'documents'] });
        notifyDocuments(userId, track ? 'delete' : 'delete-cancel', id, accepted, operationId, 1);
      }
      untrack();
      controllers.current.delete(controller);
      if (isCurrent()) setDeleteBusy(false);
    }
  }
  const observedDeletions = new Map(pendingDeletions.map((item) => [item.id, item]));
  for (const item of list.data?.items ?? []) {
    if (item.status === 'DELETING') observedDeletions.set(item.id, { id: item.id, accepted: true });
  }
  const watchedDeletions = [...observedDeletions.values()].filter(
    (item) => !completedDeletions.includes(item.id),
  );
  const deletingIds = watchedDeletions.filter((item) => item.accepted).map((item) => item.id);
  const items =
    list.data?.items.filter(
      (item) =>
        !completedDeletions.includes(item.id) &&
        item.filename.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
    ) ?? [];
  const selected = detail.data;
  const selectedDeleting =
    selected?.status === 'DELETING' || (!!selectedId && deletingIds.includes(selectedId));
  return (
    <AppShell>
      <div className="library-page">
        <div className="library-heading">
          <div>
            <p className="section-kicker">KHÔNG GIAN CỦA BẠN</p>
            <h1>
              Thư viện tài liệu<span className="heading-dot">.</span>
            </h1>
            <p>Quản lý tài liệu và theo dõi trạng thái xử lý tại một nơi.</p>
          </div>
          <Button onClick={() => input.current?.click()} disabled={busy}>
            <FilePlus2 size={17} aria-hidden="true" /> Tải tài liệu
          </Button>
        </div>
        <section
          className={`library-dropzone ${dragging ? 'library-dropzone--active' : ''}`}
          aria-labelledby="upload-title"
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <span className="library-upload-icon">
            <UploadCloud size={24} aria-hidden="true" />
          </span>
          <div>
            <h2 id="upload-title">Thêm tài liệu vào thư viện</h2>
            <p>
              Kéo thả tệp vào đây hoặc chọn từ thiết bị. Hỗ trợ PDF, DOCX, TXT tối đa 10 MiB mỗi
              tệp.
            </p>
            <Button
              variant="secondary"
              size="small"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              Chọn tệp
            </Button>
          </div>
          <input
            ref={input}
            className="sr-only"
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            aria-label="Chọn tài liệu PDF, DOCX hoặc TXT"
            onChange={handleInput}
          />
        </section>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {uploads
            .filter((item) => item.state === 'error')
            .map((item) => `${item.name}: ${item.message}`)
            .join('. ')}
        </div>
        {uploads.length > 0 && (
          <section className="upload-results" aria-label="Kết quả tải tệp">
            <div className="upload-results-heading">
              <strong>Tải tài liệu</strong>
              {!busy && (
                <button
                  type="button"
                  onClick={() => setUploads([])}
                  aria-label="Đóng kết quả tải tệp"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <ul>
              {uploads.map((item) => (
                <li key={item.id}>
                  <span className="upload-name">{item.name}</span>
                  <span>
                    {item.state === 'waiting'
                      ? 'Đang chờ tải'
                      : item.state === 'uploading'
                        ? 'Đang truyền tệp…'
                        : item.state === 'accepted'
                          ? 'Đã tiếp nhận · Chờ xử lý'
                          : item.message}
                  </span>
                  {item.state === 'uploading' && (
                    <Progress label={`Đang truyền ${item.name}`} value={null} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="library-content" aria-labelledby="library-list-title">
          <div className="library-toolbar">
            <div>
              <p className="section-kicker">TÀI LIỆU CỦA BẠN</p>
              <h2 id="library-list-title">Tất cả tài liệu</h2>
              <p>
                {list.data
                  ? `${list.data.totalElements} tài liệu trong thư viện`
                  : 'Theo dõi các tài liệu đã tải lên.'}
              </p>
            </div>
            <div className="library-search">
              <Search size={17} aria-hidden="true" />
              <Input
                aria-label="Tìm theo tên trong trang hiện tại"
                placeholder="Tìm trong trang này"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          {list.isPending ? (
            <div className="document-loading" role="status" aria-label="Đang tải tài liệu">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : list.isError ? (
            <ErrorState
              title="Chưa tải được tài liệu"
              description={`${errorText(list.error)}${errorRequestId(list.error) ? ` Mã yêu cầu: ${errorRequestId(list.error)}` : ''}`}
              onRetry={() => void list.refetch()}
            />
          ) : items.length === 0 ? (
            <div className="document-empty">
              <span>
                <FolderOpen size={25} aria-hidden="true" />
              </span>
              <h3>
                {search
                  ? 'Không tìm thấy trong trang này'
                  : list.data?.totalElements
                    ? 'Trang này không còn tài liệu'
                    : 'Thư viện của bạn đang trống'}
              </h3>
              <p>
                {search
                  ? 'Thử một tên khác hoặc xem trang khác.'
                  : list.data?.totalElements
                    ? 'Đang chuyển về trang có tài liệu.'
                    : 'Hãy tải tài liệu đầu tiên để bắt đầu khám phá nội dung.'}
              </p>
              {!search && !list.data?.totalElements && (
                <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
                  Chọn tài liệu
                </Button>
              )}
            </div>
          ) : (
            <div className="document-grid">
              {items.map((item) => (
                <article className="document-card" key={item.id}>
                  <div className="document-card-top">
                    <span className="document-file-icon">
                      <FileText size={21} aria-hidden="true" />
                    </span>
                    <Status
                      item={deletingIds.includes(item.id) ? { ...item, status: 'DELETING' } : item}
                    />
                  </div>
                  <h3 title={item.filename}>{item.filename}</h3>
                  <p>
                    {item.filename.split('.').pop()?.toUpperCase()}{' '}
                    <span aria-hidden="true">·</span> {formatSize(item.sizeBytes)}
                  </p>
                  <div className="document-card-bottom">
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => {
                        setSelectedId(item.id);
                        setConfirmDelete(false);
                        setDetailError(null);
                      }}
                    >
                      Chi tiết<span className="sr-only"> {item.filename}</span>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {list.data && (list.data.totalPages > 1 || page > 0) && (
            <nav className="library-pagination" aria-label="Phân trang tài liệu">
              <span>
                Trang {page + 1} / {list.data.totalPages}
              </span>
              <div>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={page === 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  Trước
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={page + 1 >= list.data.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Tiếp
                </Button>
              </div>
            </nav>
          )}
        </section>
      </div>
      {watchedDeletions.map(({ id, accepted }) => (
        <DeletionWatcher
          key={id}
          id={id}
          userId={userId}
          accepted={accepted}
          onComplete={finishDeletion}
          onAccepted={acceptDeletion}
          onDismiss={dismissDeletion}
        />
      ))}
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) {
            setSelectedId(null);
            setConfirmDelete(false);
            setDetailError(null);
          }
        }}
        title="Chi tiết tài liệu"
        description="Thông tin và trạng thái xử lý tài liệu của bạn."
      >
        {detail.isPending ? (
          <div className="detail-loading" role="status">
            Đang tải chi tiết…
          </div>
        ) : detail.isError ? (
          <ErrorState
            title={selectedDeleting ? 'Đang xác nhận xóa' : 'Chưa tải được chi tiết'}
            description={
              selectedDeleting ? 'Hệ thống đang kiểm tra kết quả dọn dẹp.' : errorText(detail.error)
            }
            onRetry={() => void detail.refetch()}
          />
        ) : (
          selected && (
            <div className="document-detail">
              <div className="detail-title">
                <span className="document-file-icon">
                  <FileText size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3>{selected.filename}</h3>
                  <Status
                    item={selectedDeleting ? { ...selected, status: 'DELETING' } : selected}
                  />
                </div>
              </div>
              <dl>
                <div>
                  <dt>Dung lượng</dt>
                  <dd>{formatSize(selected.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>Loại tệp</dt>
                  <dd>{selected.mediaType}</dd>
                </div>
                <div>
                  <dt>Ngày tải lên</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                </div>
                <div>
                  <dt>Số trang</dt>
                  <dd>{selected.pageCount ?? 'Chưa có'}</dd>
                </div>
                <div>
                  <dt>Số đoạn</dt>
                  <dd>{selected.paragraphCount ?? 'Chưa có'}</dd>
                </div>
                <div>
                  <dt>Số chunk</dt>
                  <dd>{selected.chunkCount ?? 'Chưa có'}</dd>
                </div>
                <div>
                  <dt>Lần xử lý</dt>
                  <dd>{selected.attempts ?? 0} / 3</dd>
                </div>
                {selected.nextRetryAt && (
                  <div>
                    <dt>Thử lại sau</dt>
                    <dd>{formatDate(selected.nextRetryAt)}</dd>
                  </div>
                )}
              </dl>
              {selected.errorCode && (
                <div className="detail-failure" role="status">
                  {failureMessage(selected.errorCode)}
                </div>
              )}
              {detailError && (
                <div className="detail-failure" role="alert">
                  {detailError}
                </div>
              )}
              {selectedDeleting ? (
                <p className="detail-note">
                  Tài liệu đang được xóa. Hệ thống sẽ xác nhận khi dọn dẹp hoàn tất.
                </p>
              ) : confirmDelete ? (
                <div className="delete-confirm">
                  <strong>Xóa tài liệu này?</strong>
                  <p>
                    File, các đoạn và trích đoạn nguồn sẽ bị xóa. Nội dung hội thoại cũ vẫn được
                    giữ; để xóa nội dung đó, bạn cần xóa hội thoại.
                  </p>
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleteBusy}
                    >
                      Giữ tài liệu
                    </Button>
                    <Button
                      variant="danger"
                      loading={deleteBusy}
                      onClick={() => void removeDocument()}
                    >
                      Xác nhận xóa
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="detail-actions">
                  <Button
                    variant="secondary"
                    disabled
                    title="Hội thoại sẽ khả dụng ở bước tiếp theo"
                  >
                    Bắt đầu hội thoại · Sắp có
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={16} aria-hidden="true" /> Xóa tài liệu
                  </Button>
                </div>
              )}
              <p className="detail-note">Xem trước tệp gốc chưa khả dụng.</p>
            </div>
          )
        )}
      </Dialog>
      {toast && (
        <Toast
          open={true}
          onOpenChange={(open) => {
            if (!open) setToast(null);
          }}
          title={toast.title}
          description={toast.description}
        />
      )}
    </AppShell>
  );
}
